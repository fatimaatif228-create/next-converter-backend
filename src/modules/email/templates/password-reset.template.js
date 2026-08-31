import { emailLayout } from './shared';

export function passwordResetEmail({
  resetUrl,
}) {
  return emailLayout({
    title: 'Reset Password',

    content: `
      <p style="color:white;">
        Someone requested a password reset.
      </p>

      <p style="color:#9999AA;">
        This link expires in one hour.
      </p>
    `,

    buttonText: 'Reset Password',

    buttonUrl: resetUrl,
  });
}