const { emailLayout } = require('./shared');

export function subscriptionCancellationEmail({
  planName,
  formattedExpiry,
  pricingUrl,
}) {
  return emailLayout({
    title: 'Subscription Cancelled',
    content: `
      <p style="color:white; font-size: 16px;">
        Your <strong>${planName}</strong> subscription has been cancelled.
      </p>

      <p style="color:#9999AA;">
        We're sorry to see you go. You will keep your access until <strong>${formattedExpiry}</strong>. 
        After this date, your account will revert to the Free plan.
      </p>

      <p style="color:#9999AA; margin-bottom: 24px;">
        If you change your mind, you can always upgrade again.
      </p>
    `,
    buttonText: 'Upgrade again',
    buttonUrl: pricingUrl,
  });
}