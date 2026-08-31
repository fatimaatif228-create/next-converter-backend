const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const OUTPUTS_BUCKET = 'outputs';
const OUTPUT_ZIP_NAME = 'repress-output.zip';

class OutputPackager {
  async packageAndUpload({
    supabase,
    conversionId,
    userId,
    projectId,
    conversionDir,
    outputDir,
  }) {
    if (!supabase) {
      throw new Error('Supabase client is required');
    }

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!projectId) {
      throw new Error('Project ID is required');
    }

    if (!conversionDir) {
      throw new Error('Conversion directory is required');
    }

    if (!outputDir) {
      throw new Error('Output directory is required');
    }

    const normalizedConversionDir = path.resolve(conversionDir);
    const normalizedOutputDir = path.resolve(outputDir);

    if (!normalizedOutputDir.startsWith(`${normalizedConversionDir}${path.sep}`)) {
      throw new Error('Output directory must be inside the conversion directory');
    }

    await this.ensureDirectoryExists(normalizedOutputDir);

    const outputZipPath = path.join(normalizedConversionDir, OUTPUT_ZIP_NAME);
    const outputFilePath = `${userId}/${projectId}/${conversionId}-output.zip`;

    await this.createZip(normalizedOutputDir, outputZipPath);

    const zipBuffer = await fs.promises.readFile(outputZipPath);
    const fileSizeBytes = zipBuffer.length;
    const fileSizeKb = Math.round((fileSizeBytes / 1024) * 100) / 100;

    const { error: uploadError } = await supabase.storage
      .from(OUTPUTS_BUCKET)
      .upload(outputFilePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from(OUTPUTS_BUCKET)
      .getPublicUrl(outputFilePath);

    return {
      outputZipPath,
      outputFilePath,
      outputFileUrl: publicUrlData?.publicUrl || null,
      fileSizeBytes,
      fileSizeKb,
    };
  }

  async createZip(outputDir, outputZipPath) {
    const zip = new AdmZip();

    zip.addLocalFolder(outputDir, 'repress-output');

    await new Promise((resolve, reject) => {
      zip.writeZip(outputZipPath, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async ensureDirectoryExists(directoryPath) {
    const stat = await fs.promises.stat(directoryPath);

    if (!stat.isDirectory()) {
      throw new Error(`Expected directory but found file: ${directoryPath}`);
    }
  }
}

module.exports = {
  OutputPackager,
};