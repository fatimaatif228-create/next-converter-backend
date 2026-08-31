const fs = require('fs');
const path = require('path');

const DEFAULT_WP_DOMAIN = 'yoursite.com';
const WP_ASSETS_PUBLIC_PREFIX = 'wp-assets';

const WP_API_HELPER = [
  'const WP_API_BASE = process.env.NEXT_PUBLIC_WP_API_URL;',
  '',
  'export async function wpFetch(endpoint) {',
  '  const res = await fetch(`${WP_API_BASE}${endpoint}`);',
  '  if (!res.ok) throw new Error(`WP API error: ${res.status}`);',
  '  return res.json();',
  '}',
  '',
  "export const fetchPosts = (params = '') => wpFetch(`/posts${params}`);",
  "export const fetchPost  = (slug)        => wpFetch(`/posts?slug=${slug}&_embed`);",
  "export const fetchPages = (params = '') => wpFetch(`/pages${params}`);",
  "export const fetchPage  = (slug)        => wpFetch(`/pages?slug=${slug}&_embed`);",
  '',
].join('\n');

class ProjectScaffolder {
  constructor(options = {}) {
    this.wpDomain = options.wpDomain || DEFAULT_WP_DOMAIN;
  }

  async scaffold(manifest, convertedFiles) {
    if (!manifest) {
      throw new Error('Manifest is required to scaffold the Next.js project');
    }

    if (!manifest.themeRoot) {
      throw new Error('Manifest themeRoot is required to scaffold the Next.js project');
    }

    if (!Array.isArray(convertedFiles)) {
      throw new Error('Converted files are required to scaffold the Next.js project');
    }

    const outputRoot = manifest.outputRoot || this.getOutputRootFromThemeRoot(manifest.themeRoot);

    await this.createBaseDirectories(outputRoot);

    const convertedResult = await this.writeConvertedFiles(outputRoot, convertedFiles);
    const stylesheetFiles = await this.copyStylesheets(
      manifest.themeRoot,
      outputRoot,
      manifest.stylesheets || [],
    );
    const assetFiles = await this.copyAssets(
      manifest.themeRoot,
      outputRoot,
      manifest.assets || [],
    );
    const supportFiles = await this.writeSupportFiles(outputRoot, manifest);

    const fileCount = {
      converted: convertedResult.written.length,
      stylesheets: stylesheetFiles.length,
      assets: assetFiles.length,
      support: supportFiles.length,
      total:
        convertedResult.written.length +
        stylesheetFiles.length +
        assetFiles.length +
        supportFiles.length,
    };

    return {
      outputRoot,
      files: {
        converted: convertedResult.written,
        skippedConverted: convertedResult.skipped,
        stylesheets: stylesheetFiles,
        assets: assetFiles,
        support: supportFiles,
      },
      fileCount,
    };
  }

  async createBaseDirectories(outputRoot) {
    const directories = [
      '',
      'app',
      'components',
      'lib',
      'styles',
      'public',
      `public/${WP_ASSETS_PUBLIC_PREFIX}`,
    ];

    for (const directory of directories) {
      await fs.promises.mkdir(path.join(outputRoot, directory), {
        recursive: true,
      });
    }
  }

  async writeConvertedFiles(outputRoot, convertedFiles) {
    const written = [];
    const skipped = [];

    for (const convertedFile of convertedFiles) {
      if (!convertedFile.nextPage) {
        skipped.push({
          file: convertedFile.file,
          reason: 'No nextPage mapping available',
        });
        continue;
      }

      const { absolutePath, relativePath } = this.resolveInside(
        outputRoot,
        convertedFile.nextPage,
      );

      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.promises.writeFile(absolutePath, convertedFile.jsx || '', 'utf8');

      written.push(relativePath);
    }

    return {
      written,
      skipped,
    };
  }

  async copyStylesheets(themeRoot, outputRoot, stylesheets) {
    const copied = [];

    for (const stylesheet of stylesheets) {
      const source = this.resolveInside(themeRoot, stylesheet);
      const destination = this.resolveInside(
        outputRoot,
        path.posix.join('styles', source.relativePath),
      );

      await fs.promises.mkdir(path.dirname(destination.absolutePath), {
        recursive: true,
      });

      await fs.promises.copyFile(source.absolutePath, destination.absolutePath);

      copied.push(destination.relativePath);
    }

    return copied;
  }

  async copyAssets(themeRoot, outputRoot, assets) {
    const copied = [];

    for (const asset of assets) {
      const source = this.resolveInside(themeRoot, asset);
      const destination = this.resolveInside(
        outputRoot,
        path.posix.join('public', WP_ASSETS_PUBLIC_PREFIX, source.relativePath),
      );

      await fs.promises.mkdir(path.dirname(destination.absolutePath), {
        recursive: true,
      });

      await fs.promises.copyFile(source.absolutePath, destination.absolutePath);

      copied.push(destination.relativePath);
    }

    return copied;
  }

  async writeSupportFiles(outputRoot, manifest) {
    const files = [];

    files.push(
      await this.writeGeneratedFile(outputRoot, 'lib/wp-api.js', WP_API_HELPER),
    );

    files.push(
      await this.writeGeneratedFile(
        outputRoot,
        'next.config.js',
        this.buildNextConfig(),
      ),
    );

    files.push(
      await this.writeGeneratedFile(
        outputRoot,
        'package.json',
        this.buildPackageJson(),
      ),
    );

    files.push(
      await this.writeGeneratedFile(
        outputRoot,
        '.env.example',
        'NEXT_PUBLIC_WP_API_URL=https://yoursite.com/wp-json/wp/v2\n',
      ),
    );

    files.push(
      await this.writeGeneratedFile(
        outputRoot,
        'app/layout.tsx',
        this.buildRootLayout(manifest),
      ),
    );

    return files;
  }

  async writeGeneratedFile(outputRoot, relativePath, content) {
    const destination = this.resolveInside(outputRoot, relativePath);

    await fs.promises.mkdir(path.dirname(destination.absolutePath), {
      recursive: true,
    });

    await fs.promises.writeFile(destination.absolutePath, content, 'utf8');

    return destination.relativePath;
  }

  buildNextConfig() {
    return [
      '/** @type {import("next").NextConfig} */',
      'const nextConfig = {',
      '  images: {',
      `    domains: ['${this.escapeSingleQuotedString(this.wpDomain)}'],`,
      '  },',
      '};',
      '',
      'module.exports = nextConfig;',
      '',
    ].join('\n');
  }

  buildPackageJson() {
    return `${JSON.stringify(
      {
        name: 'repress-output',
        version: '1.0.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: 'latest',
          react: 'latest',
          'react-dom': 'latest',
        },
        devDependencies: {
          typescript: 'latest',
          '@types/node': 'latest',
          '@types/react': 'latest',
        },
      },
      null,
      2,
    )}\n`;
  }

  buildRootLayout(manifest) {
    const stylesheetImports = (manifest.stylesheets || []).map((stylesheet) => {
      const normalizedStylesheet = this.normalizeRelativePath(stylesheet);
      return `import '../styles/${this.escapeImportPath(normalizedStylesheet)}';`;
    });

    return [
      ...stylesheetImports,
      stylesheetImports.length > 0 ? '' : null,
      'export const metadata = {',
      "  title: process.env.NEXT_PUBLIC_SITE_NAME || 'Converted WordPress Site',",
      "  description: 'Generated by Repress',",
      '};',
      '',
      'export default function RootLayout({ children }) {',
      '  return (',
      '    <html lang="en">',
      '      <body>{children}</body>',
      '    </html>',
      '  );',
      '}',
      '',
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  getOutputRootFromThemeRoot(themeRoot) {
    const normalizedThemeRoot = path.normalize(themeRoot);
    const parts = normalizedThemeRoot.split(path.sep);
    const themeIndex = parts.lastIndexOf('theme');

    if (themeIndex === -1) {
      throw new Error('Unable to determine output directory from manifest themeRoot');
    }

    const conversionDir = parts.slice(0, themeIndex).join(path.sep);

    if (!conversionDir) {
      throw new Error('Unable to determine conversion directory from manifest themeRoot');
    }

    return path.join(conversionDir, 'output');
  }

  resolveInside(baseDirectory, relativePath) {
    const normalizedRelativePath = this.normalizeRelativePath(relativePath);
    const resolvedBase = path.resolve(baseDirectory);
    const absolutePath = path.resolve(
      resolvedBase,
      ...normalizedRelativePath.split('/'),
    );

    if (
      absolutePath !== resolvedBase &&
      !absolutePath.startsWith(`${resolvedBase}${path.sep}`)
    ) {
      throw new Error(`Unsafe path detected: ${relativePath}`);
    }

    return {
      absolutePath,
      relativePath: normalizedRelativePath,
    };
  }

  normalizeRelativePath(relativePath) {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new Error('A relative file path is required');
    }

    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

    if (
      normalized.includes('\0') ||
      normalized.split('/').includes('..') ||
      path.isAbsolute(normalized) ||
      /^[a-zA-Z]:/.test(normalized)
    ) {
      throw new Error(`Unsafe relative path detected: ${relativePath}`);
    }

    return normalized;
  }

  escapeSingleQuotedString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  escapeImportPath(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}

module.exports = {
  ProjectScaffolder,
};