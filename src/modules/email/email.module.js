const { Global, Module } = require('@nestjs/common');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { createEmailService } = require('./email.service');
const { EmailController } = require('./email.controller');
const { EMAIL_SERVICE } = require('./email.tokens');

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [EmailController],
  providers: [
    {
      provide: EMAIL_SERVICE,
      useFactory: (configService) => createEmailService(configService),
      inject: [ConfigService],
    },
  ],
  exports: [EMAIL_SERVICE],
})
class EmailModule {}

module.exports = { EmailModule, EMAIL_SERVICE };