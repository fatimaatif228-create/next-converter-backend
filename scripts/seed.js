require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    realtime: {
      transport: ws,
    },
  },
);

async function seed() {
  console.log('--- 1. Seeding FE-029 Pricing Plans ---');
  const plans = [
    {
      id: 'plan-free',
      name: 'Free',
      slug: 'free',
      price: 0,
      billing_cycle: 'monthly',
      max_conversions_per_month: 2,
      max_projects: 1,
      max_team_seats: 1,
      features: {
        conversionsPerMonth: '2/mo',
        projects: '1',
        teamSeats: '1',
        wpRestApiV2: true,
        communitySupport: true,
        beforeAfterPreview: false,
        liveProgressTracking: false,
        prioritySupport: false,
        teamRoles: false,
        oneClickDeploy: false,
        dedicatedSupport: false,
        ssoSaml: false,
        customRules: false,
        uptimeSla: false,
      },
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'plan-pro',
      name: 'Pro',
      slug: 'pro',
      price: 29,
      billing_cycle: 'monthly',
      max_conversions_per_month: 25,
      max_projects: 10,
      max_team_seats: 5,
      features: {
        conversionsPerMonth: '25/mo',
        projects: 'Unlimited',
        teamSeats: '1',
        wpRestApiV2: true,
        communitySupport: true,
        beforeAfterPreview: true,
        liveProgressTracking: true,
        prioritySupport: true,
        teamRoles: false,
        oneClickDeploy: false,
        dedicatedSupport: false,
        ssoSaml: false,
        customRules: false,
        uptimeSla: false,
      },
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'plan-agency',
      name: 'Agency',
      slug: 'agency',
      price: 99,
      billing_cycle: 'monthly',
      max_conversions_per_month: 999999,
      max_projects: 999999,
      max_team_seats: 999999,
      features: {
        conversionsPerMonth: 'Unlimited',
        projects: 'Unlimited',
        teamSeats: 'Unlimited',
        wpRestApiV2: true,
        communitySupport: true,
        beforeAfterPreview: true,
        liveProgressTracking: true,
        prioritySupport: true,
        teamRoles: true,
        oneClickDeploy: true,
        dedicatedSupport: true,
        ssoSaml: false,
        customRules: false,
        uptimeSla: false,
      },
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'plan-enterprise',
      name: 'Enterprise',
      slug: 'enterprise',
      price: 0,
      billing_cycle: 'monthly',
      max_conversions_per_month: 999999,
      max_projects: 999999,
      max_team_seats: 999999,
      features: {
        conversionsPerMonth: 'Custom',
        projects: 'Unlimited',
        teamSeats: 'Unlimited',
        wpRestApiV2: true,
        communitySupport: true,
        beforeAfterPreview: true,
        liveProgressTracking: true,
        prioritySupport: true,
        teamRoles: true,
        oneClickDeploy: true,
        dedicatedSupport: true,
        ssoSaml: true,
        customRules: true,
        uptimeSla: true,
      },
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ];

  const { data: seededPlans, error: plansError } = await supabase
    .from('plans')
    .upsert(plans, { onConflict: 'id' })
    .select();

  if (plansError) throw plansError;
  console.log(`Seeded ${seededPlans.length} plans.`);

  console.log('--- 2. Fetching Users for Default Free Subscriptions ---');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email');

  if (usersError) console.warn('usersError:', usersError.message);

  if (users && users.length > 0) {
    for (const u of users) {
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', u.id)
        .maybeSingle();

      if (!existingSub) {
        await supabase.from('subscriptions').insert({
          user_id: u.id,
          plan_id: 'plan-free',
          status: 'active',
          billing_cycle: 'monthly',
          started_at: new Date().toISOString(),
        });
      }
    }
  }

  console.log('Seed complete successfully!', {
    plans: seededPlans,
    usersCount: users ? users.length : 0,
  });
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});