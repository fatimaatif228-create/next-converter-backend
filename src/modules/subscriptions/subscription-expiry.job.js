import { Injectable, Dependencies, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseDbService } from '../../supabase/supabase-db.service';
import { EMAIL_SERVICE } from '../email/email.tokens';
import { subscriptionExpiredEmail } from '../email/templates';

const SUBSCRIPTIONS_TABLE = 'subscriptions';
const USERS_TABLE = 'users';
const PLANS_TABLE = 'plans';

@Injectable()
@Dependencies(SupabaseDbService, EMAIL_SERVICE, ConfigService)
export class SubscriptionExpiryJob {
  constructor(supabaseDbService, emailService, configService) {
    this.supabaseDbService = supabaseDbService;
    this.emailService = emailService;
    this.configService = configService;
    this.logger = new Logger(SubscriptionExpiryJob.name);
  }

  // Every day at midnight (server time)
  @Cron('0 0 * * *')
  async handleCron() {
    return this.runExpiryCheck();
  }

  async runExpiryCheck() {
    const supabase = this.supabaseDbService.getClient();
    const now = new Date().toISOString();

    const { data: expiredRows, error } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .select('id, user_id, plan_id, expires_at')
      .eq('status', 'active')
      .lt('expires_at', now);

    if (error) {
      this.logger.error(`Subscription expiry job query failed: ${error.message}`);
      throw error;
    }

    const rows = expiredRows || [];
    let expiredCount = 0;

    for (const row of rows) {
      const { error: updateError } = await supabase
        .from(SUBSCRIPTIONS_TABLE)
        .update({ status: 'expired' })
        .eq('id', row.id)
        .eq('status', 'active');

      if (updateError) {
        this.logger.error(
          `Failed to expire subscription ${row.id}: ${updateError.message}`,
        );
        continue;
      }

      expiredCount += 1;
      this.sendExpiredEmail(row);
    }

    this.logger.log(
      `Subscription expiry job ran: ${expiredCount} subscriptions expired`,
    );

    return { expiredCount };
  }

  sendExpiredEmail(row) {
    setImmediate(async () => {
      try {
        const supabase = this.supabaseDbService.getClient();

        const { data: user } = await supabase
          .from(USERS_TABLE)
          .select('email, name')
          .eq('id', row.user_id)
          .maybeSingle();

        if (!user?.email) {
          this.logger.warn(
            `Expiry email skipped: no email for user ${row.user_id}`,
          );
          return;
        }

        let planName = 'paid';
        if (row.plan_id) {
          const { data: plan } = await supabase
            .from(PLANS_TABLE)
            .select('name')
            .eq('id', row.plan_id)
            .maybeSingle();
          if (plan?.name) planName = plan.name;
        }

        const frontendUrl =
          this.configService.get('frontendUrl') || 'http://localhost:3000';

        const html = subscriptionExpiredEmail({
          planName,
          pricingUrl: `${frontendUrl}/pricing`,
        });

        await this.emailService.sendEmail(
          user.email,
          'Your Repress subscription has expired',
          html,
        );

        this.logger.log(`Expiry email sent to ${user.email}`);
      } catch (err) {
        this.logger.error(
          `Failed to send expiry email: ${err.message}`,
        );
      }
    });
  }
}