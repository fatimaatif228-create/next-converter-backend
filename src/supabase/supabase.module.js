import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseDbService } from './supabase-db.service';

@Global()
@Module({
  providers: [SupabaseService, SupabaseDbService],
  exports: [SupabaseService, SupabaseDbService],
})
export class SupabaseModule {}
