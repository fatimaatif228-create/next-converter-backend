const { Processor, WorkerHost } = require('@nestjs/bullmq');
const { Dependencies, Logger } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { createClient } = require('@supabase/supabase-js');
const { TemplateConverter } = require('./template-converter');
const { ProjectScaffolder } = require('./project-scaffolder');
const { OutputPackager } = require('./output-packager');
const { EMAIL_SERVICE } = require('../email/email.tokens');
const { conversionCompleteEmail, conversionFailedEmail } = require('../email/templates');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const CONVERSION_QUEUE_NAME = 'conversion';
const UPLOADS_BUCKET = 'uploads';
const CONVERSIONS_TABLE = 'conversions';
const CONVERSION_LOGS_TABLE = 'conversion_logs';
const TEMP_CONVERSIONS_ROOT = '/tmp/conversions';

const TEMPLATE_PATH_MAP = {
  'front-page.php': {
    wpRole: 'front-page',
    nextPage: 'app/page.tsx',
  },
  'home.php': {
    wpRole: 'home',
    nextPage: 'app/blog/page.tsx',
  },
  'index.php': {
    wpRole: 'index',
    nextPage: 'app/page.tsx',
  },
  'single.php': {
    wpRole: 'single',
    nextPage: 'app/blog/[slug]/page.tsx',
  },
  'page.php': {
    wpRole: 'page',
    nextPage: 'app/[slug]/page.tsx',
  },
  'archive.php': {
    wpRole: 'archive',
    nextPage: 'app/archive/page.tsx',
  },
  'category.php': {
    wpRole: 'category',
    nextPage: 'app/category/[slug]/page.tsx',
  },
  'tag.php': {
    wpRole: 'tag',
    nextPage: 'app/tag/[slug]/page.tsx',
  },
  'author.php': {
    wpRole: 'author',
    nextPage: 'app/author/[slug]/page.tsx',
  },
  'date.php': {
    wpRole: 'date',
    nextPage: 'app/archive/[year]/page.tsx',
  },
  'search.php': {
    wpRole: 'search',
    nextPage: 'app/search/page.tsx',
  },
  '404.php': {
    wpRole: '404',
    nextPage: 'app/not-found.tsx',
  },
  'header.php': {
    wpRole: 'header',
    nextPage: 'components/Header.tsx',
  },
  'footer.php': {
    wpRole: 'footer',
    nextPage: 'components/Footer.tsx',
  },
  'sidebar.php': {
    wpRole: 'sidebar',
    nextPage: 'components/Sidebar.tsx',
  },
  'comments.php': {
    wpRole: 'comments',
    nextPage: 'components/Comments.tsx',
  },
};

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.bmp',
  '.avif',
]);

const FONT_EXTENSIONS = new Set([
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function toComponentName(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));

  return baseName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function isIgnoredDirectory(directoryName) {
  return (
    directoryName === '__MACOSX' ||
    directoryName === 'node_modules' ||
    directoryName === '.git'
  );
}

function isThemeTemplateFile(file) {
  const baseName = path.basename(file);

  return (
    Object.prototype.hasOwnProperty.call(TEMPLATE_PATH_MAP, baseName) ||
    file.startsWith('template-parts/') ||
    file.startsWith('patterns/') ||
    !file.includes('/')
  );
}

@Processor(CONVERSION_QUEUE_NAME)
@Dependencies(ConfigService, EMAIL_SERVICE)
export class ConversionWorker extends WorkerHost {
  constructor(configService, emailService) {
    super();
    this.configService = configService;
    this.emailService = emailService;
    this.logger = new Logger(ConversionWorker.name);
    this.templateConverter = new TemplateConverter();
    this.projectScaffolder = new ProjectScaffolder();
    this.outputPackager = new OutputPackager();
  }

  createServiceSupabaseClient() {
    const supabaseUrl =
      this.configService.get('supabaseUrl') || process.env.SUPABASE_URL;

    const supabaseSecretKey =
      this.configService.get('supabaseSecretkey') ||
      process.env.SUPABASE_SECRET_KEY;

    return createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async process(job) {
    const {
      conversionId,
      projectId,
      projectName,
      userId,
      inputFilePath,
    } = job.data;

    const conversionDir = path.join(TEMP_CONVERSIONS_ROOT, conversionId);
    const inputZipPath = path.join(conversionDir, 'input.zip');
    const extractDir = path.join(conversionDir, 'theme');
    const outputDir = path.join(conversionDir, 'output');
    const startedAt = Date.now();

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    if (!projectId) {
      throw new Error('Project ID is required');
    }

    if (!projectName) {
      throw new Error('Project name is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!inputFilePath) {
      throw new Error('Uploaded ZIP storage path is required');
    }

    const supabase = this.createServiceSupabaseClient();

    try {
      this.logger.log(`Starting parser step for conversion ${conversionId}`);

      await this.updateConversionStatus(supabase, conversionId, 'PROCESSING');

      await fs.promises.mkdir(conversionDir, { recursive: true });
      await fs.promises.mkdir(extractDir, { recursive: true });

      await this.downloadZip(supabase, inputFilePath, inputZipPath);
      await this.extractZip(inputZipPath, extractDir);

      const themeRoot = await this.findThemeRoot(extractDir);
      const manifest = await this.buildManifest(themeRoot);

      if (manifest.templates.length === 0) {
        throw new Error('No WordPress theme files detected in the uploaded ZIP');
      }

      await this.saveParsedLog(supabase, conversionId, manifest);

      this.logger.log(
        `Parser step completed for conversion ${conversionId}: ${manifest.templates.length} templates found`,
      );

      const convertedFiles = await this.convertTemplates(supabase, conversionId, manifest);

      this.logger.log(
        `Template conversion completed for conversion ${conversionId}: ${convertedFiles.length} files converted`,
      );

      const scaffoldResult = await this.projectScaffolder.scaffold(
        {
          ...manifest,
          outputRoot: outputDir,
        },
        convertedFiles,
      );

      await this.saveScaffoldedLog(supabase, conversionId, scaffoldResult);

      this.logger.log(
        `Scaffold step completed for conversion ${conversionId}: ${scaffoldResult.fileCount.total} files written`,
      );

      const packageResult = await this.outputPackager.packageAndUpload({
        supabase,
        conversionId,
        userId,
        projectId,
        conversionDir,
        outputDir,
      });

      await this.savePackagedLog(supabase, conversionId, packageResult);
      await this.updateConversionCompleted(supabase, conversionId, packageResult);

      this.sendConversionCompleteEmail({
        supabase,
        userId,
        projectName,
        conversionId,
        convertedFilesCount: convertedFiles.length,
        duration: this.formatDuration(Date.now() - startedAt),
      });

      await this.cleanupTempDirectory(conversionDir);

      this.logger.log(
        `Packaging step completed for conversion ${conversionId}: ${packageResult.fileSizeKb} KB`,
      );

      return {
        manifest,
        convertedFiles,
        scaffoldResult,
        packageResult,
      };
    } catch (error) {
      this.logger.error(`Conversion pipeline failed for conversion ${conversionId}: ${error.message}`);

      await this.handlePipelineFailure({
        supabase,
        conversionId,
        userId,
        projectId,
        projectName,
        error,
        conversionDir,
      });

      throw error;
    }
  }

  async updateConversionStatus(supabase, conversionId, status) {
    const { error } = await supabase
      .from(CONVERSIONS_TABLE)
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversionId);

    if (error) {
      throw error;
    }
  }

  async downloadZip(supabase, inputFilePath, inputZipPath) {
    this.logger.log('Downloading uploaded ZIP from Supabase Storage');

    const { data, error } = await supabase.storage
      .from(UPLOADS_BUCKET)
      .download(inputFilePath);

    if (error) {
      throw error;
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.promises.writeFile(inputZipPath, buffer);
  }

  async extractZip(inputZipPath, extractDir) {
    this.logger.log('Extracting uploaded ZIP');

    const zip = new AdmZip(inputZipPath);
    zip.extractAllTo(extractDir, true);
  }

  async findThemeRoot(extractDir) {
    const rootEntries = await fs.promises.readdir(extractDir, {
      withFileTypes: true,
    });

    const rootFiles = rootEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    if (this.looksLikeThemeRoot(rootFiles)) {
      return extractDir;
    }

    const rootDirectories = rootEntries
      .filter((entry) => entry.isDirectory() && !isIgnoredDirectory(entry.name))
      .map((entry) => path.join(extractDir, entry.name));

    for (const directory of rootDirectories) {
      const entries = await fs.promises.readdir(directory, {
        withFileTypes: true,
      });

      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);

      if (this.looksLikeThemeRoot(files)) {
        return directory;
      }
    }

    return extractDir;
  }

  looksLikeThemeRoot(files) {
    return (
      files.includes('style.css') ||
      files.includes('functions.php') ||
      files.some((file) => Object.prototype.hasOwnProperty.call(TEMPLATE_PATH_MAP, file))
    );
  }

  async buildManifest(themeRoot) {
    const files = await this.scanFiles(themeRoot);

    const templates = [];
    const stylesheets = [];
    const scripts = [];
    const assets = [];
    let functionsFile = null;

    files.forEach((file) => {
      const extension = path.extname(file).toLowerCase();
      const baseName = path.basename(file);

      if (baseName === 'functions.php') {
        functionsFile = file;
        return;
      }

      if (extension === '.php') {
        if (isThemeTemplateFile(file)) {
          templates.push(this.mapTemplateFile(file));
        }

        return;
      }

      if (extension === '.css') {
        stylesheets.push(file);
        return;
      }

      if (extension === '.js') {
        scripts.push(file);
        return;
      }

      if (IMAGE_EXTENSIONS.has(extension) || FONT_EXTENSIONS.has(extension)) {
        assets.push(file);
      }
    });

    return {
      themeRoot,
      templates,
      stylesheets,
      scripts,
      assets,
      functionsFile,
    };
  }

  async scanFiles(rootDirectory) {
    const results = [];

    async function walk(currentDirectory) {
      const entries = await fs.promises.readdir(currentDirectory, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory() && isIgnoredDirectory(entry.name)) {
          continue;
        }

        const absolutePath = path.join(currentDirectory, entry.name);

        if (entry.isDirectory()) {
          await walk(absolutePath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        results.push(toPosixPath(path.relative(rootDirectory, absolutePath)));
      }
    }

    await walk(rootDirectory);

    return results.sort();
  }

  mapTemplateFile(file) {
    const baseName = path.basename(file);
    const mappedTemplate = TEMPLATE_PATH_MAP[baseName];

    if (mappedTemplate) {
      return {
        file,
        wpRole: mappedTemplate.wpRole,
        nextPage: mappedTemplate.nextPage,
      };
    }

    if (file.startsWith('template-parts/')) {
      return {
        file,
        wpRole: 'template-part',
        nextPage: `components/template-parts/${toComponentName(file)}.tsx`,
      };
    }

    if (file.startsWith('patterns/')) {
      return {
        file,
        wpRole: 'pattern',
        nextPage: `components/patterns/${toComponentName(file)}.tsx`,
      };
    }

    return {
      file,
      wpRole: 'custom-template',
      nextPage: null,
      needsManualReview: true,
    };
  }

  async saveParsedLog(supabase, conversionId, manifest) {
    const { error } = await supabase.from(CONVERSION_LOGS_TABLE).insert({
      conversion_id: conversionId,
      step: 'PARSED',
      status: 'SUCCESS',
      message: 'WordPress theme parsed successfully',
      metadata: {
        manifest,
        fileCount: {
          templates: manifest.templates.length,
          stylesheets: manifest.stylesheets.length,
          scripts: manifest.scripts.length,
          assets: manifest.assets.length,
        },
      },
    });

    if (error) {
      throw error;
    }
  }
  async convertTemplates(supabase, conversionId, manifest) {
    const convertedFiles = [];

    for (const template of manifest.templates) {
      const templatePath = path.join(manifest.themeRoot, template.file);
      const normalizedTemplatePath = path.normalize(templatePath);
      const normalizedThemeRoot = path.normalize(manifest.themeRoot);

      if (!normalizedTemplatePath.startsWith(normalizedThemeRoot)) {
        throw new Error(`Unsafe template path detected: ${template.file}`);
      }

      if (!template.nextPage && template.needsManualReview) {
        convertedFiles.push({
          file: template.file,
          wpRole: template.wpRole,
          nextPage: template.nextPage,
          manualReview: true,
          jsx: this.templateConverter.convert(
            '{/* TODO: manual conversion required */}',
            template.file,
          ),
        });

        continue;
      }

      const phpContent = await fs.promises.readFile(normalizedTemplatePath, 'utf8');
      const jsxContent = this.templateConverter.convert(phpContent, template.file);

      convertedFiles.push({
        file: template.file,
        wpRole: template.wpRole,
        nextPage: template.nextPage,
        manualReview: false,
        jsx: jsxContent,
      });
    }
    await this.saveConvertedLogs(supabase, conversionId, convertedFiles);

    return convertedFiles;
  }

  async saveConvertedLogs(supabase, conversionId, convertedFiles) {
    const rows = convertedFiles.map((convertedFile) => ({
      conversion_id: conversionId,
      step: 'CONVERTED',
      status: 'SUCCESS',
      message: `Converted ${convertedFile.file}`,
      metadata: {
        file: convertedFile.file,
        wpRole: convertedFile.wpRole,
        nextPage: convertedFile.nextPage,
        manualReview: convertedFile.manualReview || false,
        jsx: convertedFile.jsx,
      },
    }));

    rows.push({
      conversion_id: conversionId,
      step: 'CONVERTED',
      status: 'SUCCESS',
      message: `Converted ${convertedFiles.length} template files`,
      metadata: {
        summary: true,
        fileCount: convertedFiles.length,
      },
    });

    const { error } = await supabase.from(CONVERSION_LOGS_TABLE).insert(rows);

    if (error) {
      throw error;
    }
  }
    async saveScaffoldedLog(supabase, conversionId, scaffoldResult) {
    const { error } = await supabase.from(CONVERSION_LOGS_TABLE).insert({
      conversion_id: conversionId,
      step: 'SCAFFOLDED',
      status: 'SUCCESS',
      message: `Scaffolded Next.js project with ${scaffoldResult.fileCount.total} files`,
      metadata: {
        outputRoot: scaffoldResult.outputRoot,
        files: scaffoldResult.files,
        fileCount: scaffoldResult.fileCount,
      },
    });

    if (error) {
      throw error;
    }
  }
  async updateConversionCompleted(supabase, conversionId, packageResult) {
    const { error } = await supabase
      .from(CONVERSIONS_TABLE)
      .update({
        status: 'COMPLETED',
        output_file_url: packageResult.outputFileUrl,
        output_file_path: packageResult.outputFilePath,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversionId);

    if (error) {
      throw error;
    }
  }

  async savePackagedLog(supabase, conversionId, packageResult) {
    const { error } = await supabase.from(CONVERSION_LOGS_TABLE).insert({
      conversion_id: conversionId,
      step: 'PACKAGED',
      status: 'SUCCESS',
      message: `Packaged output ZIP (${packageResult.fileSizeKb} KB)`,
      metadata: {
        outputZipPath: packageResult.outputZipPath,
        outputFilePath: packageResult.outputFilePath,
        outputFileUrl: packageResult.outputFileUrl,
        fileSizeBytes: packageResult.fileSizeBytes,
        fileSizeKb: packageResult.fileSizeKb,
      },
    });

    if (error) {
      throw error;
    }
  }

  async saveFailedLog(supabase, conversionId, error) {
    if (!conversionId) {
      return;
    }

    const { error: logError } = await supabase.from(CONVERSION_LOGS_TABLE).insert({
      conversion_id: conversionId,
      step: 'FAILED',
      status: 'FAILED',
      message: error?.message || 'Conversion pipeline failed',
      metadata: {
        error: error?.message || 'Unknown error',
        stack: error?.stack || null,
      },
    });

    if (logError) {
      this.logger.error(`Failed to save failure log: ${logError.message}`);
    }
  }

  async handlePipelineFailure({
    supabase,
    conversionId,
    userId,
    projectId,
    projectName,
    error,
    conversionDir,
  }) {
    try {
      if (conversionId) {
        await this.updateConversionStatus(supabase, conversionId, 'FAILED');
        await this.saveFailedLog(supabase, conversionId, error);
      }
    } catch (statusError) {
      this.logger.error(`Failed to update failed conversion state: ${statusError.message}`);
    }

    this.sendConversionFailedEmail({
      supabase,
      userId,
      projectId,
      projectName,
      error,
    });

    await this.cleanupTempDirectory(conversionDir);
  }

  sendConversionCompleteEmail({
    supabase,
    userId,
    projectName,
    conversionId,
    convertedFilesCount,
    duration,
  }) {
    setImmediate(async () => {
      try {
        const owner = await this.getOwner(supabase, userId);

        if (!owner?.email) {
          this.logger.warn(
            `Conversion ${conversionId} completed but owner email was not found — skipping completion email`,
          );
          return;
        }

        const html = conversionCompleteEmail({
          projectName,
          convertedFiles: convertedFilesCount,
          duration,
          downloadUrl: this.buildDownloadUrl(conversionId),
        });

        await this.emailService.sendEmail(owner.email, 'Conversion Complete', html);
        this.logger.log(`Completion email sent to ${owner.email}`);
      } catch (emailError) {
        this.logger.error(`Failed to send completion email: ${emailError.message}`);
      }
    });
  }

  sendConversionFailedEmail({
    supabase,
    userId,
    projectId,
    projectName,
    error,
  }) {
    setImmediate(async () => {
      try {
        const owner = await this.getOwner(supabase, userId);

        if (!owner?.email) {
          this.logger.warn(
            `Conversion for user ${userId} failed but owner email was not found — skipping failure email`,
          );
          return;
        }

        const html = conversionFailedEmail({
          projectName: projectName || 'WordPress Conversion',
          error: error?.message || 'Unknown error',
          retryUrl: this.buildRetryUrl(projectId),
        });

        await this.emailService.sendEmail(owner.email, 'Conversion Failed', html);
        this.logger.log(`Failure email sent to ${owner.email}`);
      } catch (emailError) {
        this.logger.error(`Failed to send failure email: ${emailError.message}`);
      }
    });
  }

  async getOwner(supabase, userId) {
    if (!userId) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (error) {
      this.logger.error(`Failed to load conversion owner: ${error.message}`);
      return null;
    }

    return data;
  }

  buildDownloadUrl(conversionId) {
    const apiBaseUrl =
      this.configService.get('apiBaseUrl') ||
      `http://localhost:${this.configService.get('port') || 8080}`;

    return `${apiBaseUrl}/api/conversions/${conversionId}/output`;
  }

  buildRetryUrl(projectId) {
    const frontendUrl = this.configService.get('frontendUrl') || 'http://localhost:3000';

    return `${frontendUrl}/projects/${projectId || ''}`;
  }

  formatDuration(milliseconds) {
    const totalSeconds = Math.max(1, Math.round(milliseconds / 1000));

    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}m ${seconds}s`;
  }

  async cleanupTempDirectory(conversionDir) {
    await fs.promises.rm(conversionDir, {
      recursive: true,
      force: true,
    });
  }
}
