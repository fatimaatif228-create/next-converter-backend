import {
  Injectable,
  Dependencies,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseDbService } from '../../supabase/supabase-db.service';
import { EMAIL_SERVICE } from '../email/email.tokens';
import {
  subscriptionConfirmationEmail,
  subscriptionCancellationEmail,
} from '../email/templates';

const TEST_CARD_NUMBER = '4242424242424242';
const PLANS_TABLE = 'plans';
const SUBSCRIPTIONS_TABLE = 'subscriptions';
const USERS_TABLE = 'users';
const PROJECTS_TABLE = 'projects';
const CONVERSIONS_TABLE = 'conversions';
const ORGANIZATIONS_TABLE = 'organizations';
const TEAM_MEMBERS_TABLE = 'team_members';

@Injectable()
@Dependencies(SupabaseDbService, EMAIL_SERVICE, ConfigService)
export class SubscriptionsService {
  constructor(supabaseDbService, emailService, configService) {
    this.supabaseDbService = supabaseDbService;
    this.emailService = emailService;
    this.configService = configService;
    this.logger = new Logger(SubscriptionsService.name);
  }

  normalizeLimit(value) {
    if (value === null || value === undefined) return 0;
    if (value === -1 || Number(value) >= 999999) return -1;
    return Number(value);
  }

  calculateExpiresAt(startedAt, billingCycle) {
    const expiresAt = new Date(startedAt);
    if (billingCycle === 'yearly') {
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 365);
    } else {
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
    }
    return expiresAt.toISOString();
  }

  mapPlan(plan) {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: Number(plan.price),
      maxConversionsPerMonth: this.normalizeLimit(plan.max_conversions_per_month),
      maxProjects: this.normalizeLimit(plan.max_projects),
      maxTeamSeats: this.normalizeLimit(plan.max_team_seats),
      features: plan.features || {},
    };
  }

  mapSubscription(subscription, plan) {
    return {
      id: subscription.id,
      status: subscription.status,
      billingCycle: subscription.billing_cycle,
      startedAt: subscription.started_at,
      expiresAt: subscription.expires_at,
      plan: this.mapPlan(plan),
    };
  }

  throwLimitError(message, plan) {
    throw new ForbiddenException({
      message,
      upgradeRequired: true,
      currentPlan: plan.slug || 'free',
    });
  }

  async getUserPlan(userId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: sub, error } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .select('*, plan:plans(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;

    if (sub?.plan) {
      return sub.plan;
    }

    const { data: freePlan, error: freeError } = await supabase
      .from(PLANS_TABLE)
      .select('*')
      .eq('slug', 'free')
      .eq('is_active', true)
      .single();

    if (freeError) throw freeError;
    return freePlan;
  }

  async checkProjectLimit(userId) {
    const plan = await this.getUserPlan(userId);
    const maxProjects = this.normalizeLimit(plan.max_projects);

    if (maxProjects === -1) return;

    const supabase = this.supabaseDbService.getClient();
    const { count, error } = await supabase
      .from(PROJECTS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;

    if ((count || 0) >= maxProjects) {
      this.throwLimitError(
        `Project limit reached for your ${plan.name} plan. Please upgrade to create more projects.`,
        plan,
      );
    }
  }

  async checkConversionLimit(userId) {
    const plan = await this.getUserPlan(userId);
    const maxConversions = this.normalizeLimit(plan.max_conversions_per_month);

    if (maxConversions === -1) return;

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const supabase = this.supabaseDbService.getClient();
    const { count, error } = await supabase
      .from(CONVERSIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    if (error) throw error;

    if ((count || 0) >= maxConversions) {
      this.throwLimitError(
        `Monthly conversion limit reached for your ${plan.name} plan. Please upgrade to run more conversions.`,
        plan,
      );
    }
  }

  async checkTeamSeatLimit(userId) {
    const plan = await this.getUserPlan(userId);
    const maxTeamSeats = this.normalizeLimit(plan.max_team_seats);

    if (maxTeamSeats === -1) return;

    const supabase = this.supabaseDbService.getClient();

    const { data: org, error: orgError } = await supabase
      .from(ORGANIZATIONS_TABLE)
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (orgError) throw orgError;
    if (!org) return;

    const { count, error } = await supabase
      .from(TEAM_MEMBERS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id);

    if (error) throw error;

    if ((count || 0) >= maxTeamSeats) {
      this.throwLimitError(
        `Team seat limit reached for your ${plan.name} plan. Please upgrade to invite more team members.`,
        plan,
      );
    }
  }

  async getUsage(userId) {
    const plan = await this.getUserPlan(userId);
    const supabase = this.supabaseDbService.getClient();

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const { count: projectCount, error: pErr } = await supabase
      .from(PROJECTS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (pErr) throw pErr;

    const { count: conversionCount, error: cErr } = await supabase
      .from(CONVERSIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());
    if (cErr) throw cErr;

    let teamSeatCount = 0;
    const { data: org } = await supabase
      .from(ORGANIZATIONS_TABLE)
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (org) {
      const { count, error: tErr } = await supabase
        .from(TEAM_MEMBERS_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id);
      if (tErr) throw tErr;
      teamSeatCount = count || 0;
    }

    const maxProjects = this.normalizeLimit(plan.max_projects);
    const maxConversions = this.normalizeLimit(plan.max_conversions_per_month);
    const maxTeamSeats = this.normalizeLimit(plan.max_team_seats);

    return {
      usage: {
        projects: {
          used: projectCount || 0,
          limit: maxProjects,
          isUnlimited: maxProjects === -1,
        },
        conversionsThisMonth: {
          used: conversionCount || 0,
          limit: maxConversions,
          isUnlimited: maxConversions === -1,
        },
        teamSeats: {
          used: teamSeatCount,
          limit: maxTeamSeats,
          isUnlimited: maxTeamSeats === -1,
        },
      },
      plan: {
        name: plan.name,
        slug: plan.slug,
      },
    };
  }

  async getMySubscription(userId) {
    const supabase = this.supabaseDbService.getClient();

    let { data: sub, error } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .select('*, plan:plans(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;

    if (!sub) {
      const { data: freePlan, error: freeError } = await supabase
        .from(PLANS_TABLE)
        .select('*')
        .eq('slug', 'free')
        .single();
      if (freeError) throw freeError;

      sub = {
        id: `temp-${Date.now()}`,
        status: 'active',
        billing_cycle: 'monthly',
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        plan: freePlan,
      };
    }

    return { subscription: this.mapSubscription(sub, sub.plan) };
  }

  async cancelSubscription(userId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: sub, error } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .select('*, plan:plans(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;

    if (!sub || sub.plan?.slug === 'free') {
      throw new BadRequestException('The Free plan cannot be cancelled');
    }

    const { error: updateError } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    if (updateError) throw updateError;

    this.sendCancellationEmail(userId, sub.plan, sub.expires_at);
    return { message: 'Subscription cancelled successfully' };
  }

  async purchase(userId, dto) {
    const { planSlug, billingCycle, card } = dto;
    const cardNumber = String(card?.number || '').replace(/\s/g, '');

    if (cardNumber !== TEST_CARD_NUMBER) {
      throw new HttpException(
        'Invalid card. Use test card 4242 4242 4242 4242',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const supabase = this.supabaseDbService.getClient();

    const { data: plan, error: planError } = await supabase
      .from(PLANS_TABLE)
      .select('*')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) throw new NotFoundException(`Plan with slug "${planSlug}" not found`);

    const { data: activeSubs, error: activeError } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (activeError) throw activeError;

    const subscriptions = activeSubs || [];
    if (subscriptions.find((s) => s.plan_id === plan.id)) {
      throw new ConflictException('You are already subscribed to this plan');
    }

    const oldIds = subscriptions
      .filter((s) => s.plan_id !== plan.id)
      .map((s) => s.id);

    if (oldIds.length > 0) {
      const { error: cancelError } = await supabase
        .from(SUBSCRIPTIONS_TABLE)
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .in('id', oldIds);
      if (cancelError) throw cancelError;
    }

    const startedAt = new Date().toISOString();
    const expiresAt = this.calculateExpiresAt(startedAt, billingCycle);

    const { data: newSub, error: createError } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        billing_cycle: billingCycle,
        started_at: startedAt,
        expires_at: expiresAt,
        cancelled_at: null,
      })
      .select()
      .single();

    if (createError) throw createError;

    this.sendConfirmationEmail({
      userId,
      plan,
      billingCycle,
      startedAt,
      expiresAt,
    });

    return {
      subscription: this.mapSubscription(newSub, plan),
      message:
        'Subscription activated successfully. A confirmation email has been sent.',
    };
  }

  sendConfirmationEmail({ userId, plan, billingCycle, startedAt, expiresAt }) {
    setImmediate(async () => {
      try {
        const supabase = this.supabaseDbService.getClient();
        const { data: user } = await supabase
          .from(USERS_TABLE)
          .select('email, name')
          .eq('id', userId)
          .maybeSingle();

        if (!user?.email) return;

        const frontendUrl =
          this.configService.get('frontendUrl') || 'http://localhost:3000';

        const html = subscriptionConfirmationEmail({
          name: user.name,
          planName: plan.name,
          price: plan.price,
          billingCycle,
          startedAt: new Date(startedAt).toLocaleDateString(),
          formattedExpiry: new Date(expiresAt).toLocaleDateString(),
          features: plan.features,
          dashboardUrl: `${frontendUrl}/projects`,
        });

        await this.emailService.sendEmail(
          user.email,
          `Your Repress ${plan.name} subscription is active`,
          html,
        );
        this.logger.log(`Confirmation email sent to ${user.email}`);
      } catch (err) {
        this.logger.error(`Confirmation email failed: ${err.message}`);
      }
    });
  }

  sendCancellationEmail(userId, plan, expiresAt) {
    setImmediate(async () => {
      try {
        const supabase = this.supabaseDbService.getClient();
        const { data: user } = await supabase
          .from(USERS_TABLE)
          .select('email')
          .eq('id', userId)
          .maybeSingle();

        if (!user?.email) return;

        const frontendUrl =
          this.configService.get('frontendUrl') || 'http://localhost:3000';

        const html = subscriptionCancellationEmail({
          planName: plan.name,
          formattedExpiry: new Date(expiresAt).toLocaleDateString(),
          pricingUrl: `${frontendUrl}/pricing`,
        });

        await this.emailService.sendEmail(
          user.email,
          'Your Repress subscription has been cancelled',
          html,
        );
        this.logger.log(`Cancellation email sent to ${user.email}`);
      } catch (err) {
        this.logger.error(`Cancellation email failed: ${err.message}`);
      }
    });
  }
}