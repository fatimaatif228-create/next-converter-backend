const { Module } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { BullModule } = require('@nestjs/bullmq');

const { SupabaseModule } = require('../../supabase/supabase.module');
const { ConversionsService } = require('./conversions.service');
const { ConversionsController, ProjectConversionsController } = require('./conversions.controller');
const { ConversionWorker } = require('./conversions.worker');
const { SubscriptionsModule } = require('../subscriptions/subscriptions.module');

const CONVERSION_QUEUE_NAME = 'conversion';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    SubscriptionsModule,
    BullModule.registerQueue({
      name: CONVERSION_QUEUE_NAME,
    }),
  ],
  controllers: [ConversionsController, ProjectConversionsController],
  providers: [ConversionsService, ConversionWorker],
})
export class ConversionsModule {}