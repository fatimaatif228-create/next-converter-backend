import {
  Injectable,
  Dependencies,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseDbService } from '../../supabase/supabase-db.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const PROJECTS_TABLE = 'projects';

@Injectable()
@Dependencies(SupabaseDbService, SubscriptionsService)
export class ProjectsService {
  constructor(supabaseDbService, subscriptionsService) {
    this.supabaseDbService = supabaseDbService;
    this.subscriptionsService = subscriptionsService;
    this.logger = new Logger(ProjectsService.name);
  }

  /**
   * Creates a new project in the projects table.
   * Enforces user's project limit BEFORE inserting.
   */
  async createProject(userId, payload) {
    const { name, orgId } = payload || {};

    if (!name || !name.trim()) {
      throw new BadRequestException('Project name is required');
    }

    // 🔴 GATEKEEPER CHECK: Enforce project limit BEFORE inserting into database
    await this.subscriptionsService.checkProjectLimit(userId);

    const supabase = this.supabaseDbService.getClient();

    const { data: project, error } = await supabase
      .from(PROJECTS_TABLE)
      .insert({
        user_id: userId,
        org_id: orgId || null,
        name: name.trim(),
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create project: ${error.message}`);
      throw error;
    }

    return project;
  }

  async getUserProjects(userId) {
    const supabase = this.supabaseDbService.getClient();

    const { data, error } = await supabase
      .from(PROJECTS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }
}