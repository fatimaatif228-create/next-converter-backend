const { Module } = require('@nestjs/common');
const { SupabaseModule } = require('../../supabase/supabase.module');
const { SubscriptionsModule } = require('../subscriptions/subscriptions.module');
const { ProjectsController } = require('./projects.controller');
const { ProjectsService } = require('./projects.service');

@Module({
  imports: [SupabaseModule, SubscriptionsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}