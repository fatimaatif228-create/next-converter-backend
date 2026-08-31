import { EmailModule } from './modules/email/email.module';
import { ScheduleModule } from '@nestjs/schedule';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { APP_FILTER } from '@nestjs/core';

import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

import configuration from './config/configuration';
import { configValidationSchema } from './config/config.schema';

import { AuthModule } from './modules/auth/auth.module';
import { ConversionsModule } from './modules/conversions/conversions.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TeamsModule } from './modules/teams/teams.module';
import { UsersModule } from './modules/users/users.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

import { SupabaseModule } from './supabase/supabase.module';

import { BullModule } from '@nestjs/bullmq';

import { ChatModule } from './modules/chat/chat.module';

function buildRedisConnection(redisUrl) {
  const parsedUrl = new URL(redisUrl);

  return {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 6379),
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    db: parsedUrl.pathname ? Number(parsedUrl.pathname.replace('/', '') || 0) : 0,
    tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
  };
}

@Module({
  imports: [
     ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      validationSchema: configValidationSchema,
      load: [configuration],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService) => ({
        connection: buildRedisConnection(configService.get('redisUrl')),
      }),
    }),
    AuthModule,
    ConversionsModule,
    ProjectsModule,
    TeamsModule,
    UsersModule,
    PricingModule,
    SubscriptionsModule,
    SupabaseModule,
    EmailModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}