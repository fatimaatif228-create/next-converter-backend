const {
  Controller,
  Post,
  Dependencies,
  Scope,
  ForbiddenException,
  BadRequestException,
} = require('@nestjs/common');
const { REQUEST } = require('@nestjs/core');

const { EMAIL_SERVICE } = require('./email.tokens');

// Request-scoped so REQUEST resolves to the current HTTP request. This lets
// us read the body manually (this.request.body) instead of using @Body(),
// which is a parameter decorator — and this project's Babel setup (no
// TypeScript, no working parameter-decorator plugin) cannot transform
// parameter decorators. @Dependencies() is a class decorator (same family
// as @Controller/@Module), which Babel's legacy decorator plugin already
// handles fine — see AppController for the same pattern.
@Controller({ path: 'email', scope: Scope.REQUEST })
@Dependencies(EMAIL_SERVICE, REQUEST)
export class EmailController {
  constructor(emailService, request) {
    this.emailService = emailService;
    this.request = request;
  }

  @Post('test')
  async sendTestEmail() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Test email endpoint disabled in production',
      );
    }

    const to = this.request.body && this.request.body.to;

    if (!to) {
      throw new BadRequestException('"to" is required');
    }

    return this.emailService.sendEmail(
      to,
      'Resend Test Email',
      `
        <h1>Test Email</h1>
        <p>Your Resend integration works.</p>
      `,
    );
  }
}