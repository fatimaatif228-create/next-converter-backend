import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../supabase/supabase.module';
import { ChatController } from './chat.controller';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
})

export class ChatModule {}
