import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../supabase/supabase.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionExpiryJob } from './subscription-expiry.job';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionExpiryJob],
  exports: [SubscriptionsService, SubscriptionExpiryJob],
})
export class SubscriptionsModule {}