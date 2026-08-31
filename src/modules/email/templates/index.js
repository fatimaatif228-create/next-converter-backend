module.exports = {
  welcomeEmail: require('./welcome.template').welcomeEmail,
  conversionCompleteEmail: require('./conversion-complete.template').conversionCompleteEmail,
  conversionFailedEmail: require('./conversion-failed.template').conversionFailedEmail,
  teamInviteEmail: require('./team-invite.template').teamInviteEmail,
  passwordResetEmail: require('./password-reset.template').passwordResetEmail,
  subscriptionConfirmationEmail: require('./subscription-confirmation.template').subscriptionConfirmationEmail,
  subscriptionCancellationEmail: require('./subscription-cancellation.template').subscriptionCancellationEmail,
  subscriptionExpiredEmail: require('./subscription-expired.template').subscriptionExpiredEmail,
};