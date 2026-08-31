const { emailLayout } = require('./shared');

const FEATURE_LABELS = {
  wpRestApiV2: 'WP REST API v2',
  communitySupport: 'Community Support',
  beforeAfterPreview: 'Before / After Preview & Diff',
  liveProgressTracking: 'Live Progress Tracking',
  prioritySupport: 'Priority Email Support',
  teamRoles: 'Team Roles & Activity Log',
  oneClickDeploy: 'One-Click Deploy',
  dedicatedSupport: 'Dedicated Support',
  ssoSaml: 'SSO / SAML & Audit Log',
  customRules: 'Custom Conversion Rules',
  uptimeSla: '99.9% Uptime SLA',
};

function subscriptionConfirmationEmail({
  name,
  planName,
  price,
  billingCycle,
  startedAt,
  formattedExpiry,
  features,
  dashboardUrl,
}) {
  const featureList = Object.entries(features || {})
    .filter(([_, val]) => val !== false)
    .map(([key, val]) => {
      let label =
        FEATURE_LABELS[key] ||
        key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());

      // Format numeric/string limits nicely
      if (typeof val === 'string') {
        if (key === 'conversionsPerMonth') label = `${val} Conversions`;
        else if (key === 'projects') label = `${val} Projects`;
        else if (key === 'teamSeats') label = `${val} Team Seats`;
        else label = `${label}: ${val}`;
      }

      return `<li style="color:#A6A0C7; margin-bottom: 6px; font-size: 13px;">✔ ${label}</li>`;
    })
    .join('');

  return emailLayout({
    title: `Your Repress ${planName} subscription is active`,

    content: `
      <p style="color:white; font-size: 15px;">
        Hi <strong>${name || 'there'}</strong>,
      </p>

      <p style="color:white; font-size: 14px;">
        Your <strong>${planName}</strong> plan has been activated successfully!
      </p>

      <div style="background-color: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="color:white; margin: 0 0 8px 0;"><strong>Price:</strong> $${price} / ${billingCycle}</p>
        <p style="color:white; margin: 0 0 8px 0;"><strong>Started at:</strong> ${startedAt}</p>
        <p style="color:white; margin: 0 0 8px 0;"><strong>Expires at:</strong> ${formattedExpiry}</p>
      </div>

      <p style="color:white;"><strong>Key Features Included:</strong></p>
      <ul style="padding-left: 20px; margin-bottom: 24px; list-style-type: none;">
        ${featureList}
      </ul>

      <p style="color:#615B87; font-size: 12px; margin-top: 30px;">
        iVector Academy · If you did not request this, contact support.
      </p>
    `,

    buttonText: 'Go to Dashboard',

    buttonUrl: dashboardUrl,
  });
}

module.exports = {
  subscriptionConfirmationEmail,
};