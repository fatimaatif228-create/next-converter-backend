import { emailLayout } from './shared';

export function conversionFailedEmail({
  projectName,
  error,
  retryUrl,
}) {
  return emailLayout({
    title: 'Conversion Failed',

    content: `
      <p style="color:white;">
        Project:
        ${projectName}
      </p>

      <p style="color:#FF6666;">
        ${error}
      </p>
    `,

    buttonText: 'Retry Conversion',

    buttonUrl: retryUrl,
  });
}