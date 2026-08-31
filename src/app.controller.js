import { Controller, Dependencies, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseDbService } from './supabase/supabase-db.service';

@Controller()
@Dependencies(AppService, SupabaseDbService)
export class AppController {
  constructor(appService, supabaseDbService) {
    this.appService = appService;
    this.supabaseDbService = supabaseDbService;
  }

  @Get()
  getHello() {
    return this.appService.getHello();
  }

  @ApiTags('Health')
  @ApiOperation({ summary: 'Check API and database health status' })
  @ApiResponse({
    status: 200,
    description: 'API and database are healthy',
    schema: {
      example: {
        status: 'ok',
        db: 'ok',
      },
    },
  })
  @Get('health')
  async getHealth() {
    try {
      const supabase = this.supabaseDbService.getClient();

      const { error } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'ok',
          db: 'error',
          message: error.message,
        };
      }

      return {
        status: 'ok',
        db: 'ok',
      };
    } catch (error) {
      return {
        status: 'ok',
        db: 'error',
        message: error.message,
      };
    }
  }
}
