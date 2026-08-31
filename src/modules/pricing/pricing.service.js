import {
  Injectable,
  Dependencies,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseDbService } from '../../supabase/supabase-db.service';

@Injectable()
@Dependencies(SupabaseDbService)
export class PricingService {
  constructor(supabaseDbService) {
    this.supabaseDbService = supabaseDbService;
  }

  normalizeLimit(value) {
    if (value === null || value === undefined) return value;
    if (value === -1 || value >= 999999) return -1;
    return value;
  }

  mapPlan(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      price: Number(row.price),
      billingCycle: row.billing_cycle,
      maxConversionsPerMonth: this.normalizeLimit(row.max_conversions_per_month),
      maxProjects: this.normalizeLimit(row.max_projects),
      maxTeamSeats: this.normalizeLimit(row.max_team_seats),
      features: row.features || {},
      isActive: row.is_active,
    };
  }

  async getAllPlans() {
    const supabase = this.supabaseDbService.getClient();

    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      plans: (data || []).map((row) => this.mapPlan(row)),
    };
  }

  async getPlanBySlug(slug) {
    const supabase = this.supabaseDbService.getClient();

    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new NotFoundException(`Plan with slug "${slug}" not found`);
    }

    return this.mapPlan(data);
  }
}