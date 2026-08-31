const { Module } = require('@nestjs/common');

import { UsersService } from './users.service';
import { UsersController } from './users.controller';

import { SupabaseDbService } from '../../supabase/supabase-db.service';

@Module({
    controllers: [UsersController],
    providers: [UsersService, SupabaseDbService]
})

export class UsersModule {}
