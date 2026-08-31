const { Logger, InternalServerErrorException } = require('@nestjs/common');
const { Resend } = require('resend');

function createEmailService(configService) {
  const logger = new Logger('EmailService');
  const apiKey = configService.get('RESEND_API_KEY');
  const resend = new Resend(apiKey);

  async function sendEmail(to, subject, html) {
    const from = `Repress <${configService.get('EMAIL_FROM')}>`;

    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });

      // Resend's SDK returns errors in a { data, error } envelope rather
      // than throwing — this must be checked explicitly or failed sends
      // look like successes.
      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(
        `Failed to send email to ${to} (subject: "${subject}"): ${
          error instanceof Error ? error.message : JSON.stringify(error)
        }`,
      );
      throw new InternalServerErrorException('Failed to send email via Resend');
    }
  }

  return { sendEmail };
}

module.exports = { createEmailService };