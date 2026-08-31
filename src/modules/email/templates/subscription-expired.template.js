const { emailLayout } = require('./shared');

function subscriptionExpiredEmail({ planName, pricingUrl }) {
  return emailLayout({
    title: 'Your subscription has expired',
    content: `
      <p style="color:white; font-size: 15px;">
        Your <strong>${planName || 'paid'}</strong> subscription has expired.
      </p>
      <p style="color:#9999AA; line-height: 1.6;">
        Your account has been moved back to the Free plan. You can resubscribe anytime to restore paid features.
      </p>
      <p style="color:#615B87; font-size: 12px; margin-top: 24px;">
        iVector Academy · If you did not expect this email, contact support.
      </p>
    `,
    buttonText: 'Resubscribe',
    buttonUrl: pricingUrl,
  });
}

module.exports = {
  subscriptionExpiredEmail,
};