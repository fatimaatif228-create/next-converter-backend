import { emailLayout } from './shared';

export function welcomeEmail({
  name,
  dashboardUrl,
  verificationUrl
}) {
  return emailLayout({
    title: 'Welcome to Repress',

    content: `
      <p style="color:white;">
        Hi ${name},
      </p>

      <p style="color:white;">
        Thanks for joining Repress! Your account is ready to go.
      </p>

      <p style="color:white;">
        Please verify your email address to activate your account.
      </p>

      <p>
        <a href="${verificationUrl}" style="color:white;">
          Verify your email
        </a>
      </p>

      <p style="color:#9999AA;">
        Tip: start by uploading a file on your dashboard — Repress will
        automatically detect the format and show you conversion options.
      </p>
    `,

    buttonText: 'Get Started',

    buttonUrl: dashboardUrl,
  });
}