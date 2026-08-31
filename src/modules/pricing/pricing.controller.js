import {
  Controller,
  Get,
  Param,
  Bind,
  Dependencies,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PricingService } from './pricing.service';

@ApiTags('Plans')
@Controller('plans')
@Dependencies(PricingService)
export class PricingController {
  constructor(pricingService) {
    this.pricingService = pricingService;
  }

  @Get()
  @ApiOperation({ summary: 'Get all active pricing plans' })
  @ApiResponse({
    status: 200,
    description: 'List of active plans ordered by price ascending',
  })
  async getAllPlans() {
    return this.pricingService.getAllPlans();
  }

  @Get(':slug')
  @Bind(Param('slug'))
  @ApiOperation({ summary: 'Get a single plan by slug' })
  @ApiParam({
    name: 'slug',
    example: 'pro',
    description: 'Plan slug (free, pro, agency, enterprise)',
  })
  @ApiResponse({ status: 200, description: 'Plan found' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlanBySlug(slug) {
    return this.pricingService.getPlanBySlug(slug);
  }
}