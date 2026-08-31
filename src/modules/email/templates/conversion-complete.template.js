import { emailLayout } from './shared';

export function conversionCompleteEmail({
  projectName,
  convertedFiles,
  duration,
  downloadUrl,
}) {
  return emailLayout({
    title: 'Conversion Complete',

    content: `
      <p style="color:white;">
        Project:
        <strong>${projectName}</strong>
      </p>

      <p style="color:white;">
        Files Converted:
        ${convertedFiles}
      </p>

      <p style="color:white;">
        Time:
        ${duration}
      </p>
    `,

    buttonText: 'Download Files',

    buttonUrl: downloadUrl,
  });
}