import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Bind,
  UseGuards,
  Dependencies,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionExpiryJob } from './subscription-expiry.job';
import { PurchaseSubscriptionDto } from './dto/purchase-subscription.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
@Dependencies(SubscriptionsService, SubscriptionExpiryJob)
export class SubscriptionsController {
  constructor(subscriptionsService, subscriptionExpiryJob) {
    this.subscriptionsService = subscriptionsService;
    this.subscriptionExpiryJob = subscriptionExpiryJob;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current active subscription' })
  @ApiResponse({ status: 200, description: 'Subscription with nested plan' })
  @Bind(CurrentUser())
  async getMySubscription(user) {
    return this.subscriptionsService.getMySubscription(user.id);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get plan usage stats for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Usage stats' })
  @Bind(CurrentUser())
  async getUsage(user) {
    return this.subscriptionsService.getUsage(user.id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Cancel current active subscription' })
  @ApiResponse({ status: 200, description: 'Cancelled' })
  @ApiResponse({ status: 400, description: 'Free plan cannot be cancelled' })
  @Bind(CurrentUser())
  async cancelSubscription(user) {
    return this.subscriptionsService.cancelSubscription(user.id);
  }

  @Post('purchase')
  @ApiOperation({
    summary: 'Purchase a subscription (test card only)',
    description:
      'Only test card 4242424242424242 is accepted. Cards are never stored.',
  })
  @ApiBody({ type: PurchaseSubscriptionDto })
  @ApiResponse({ status: 201, description: 'Activated' })
  @ApiResponse({ status: 402, description: 'Invalid card' })
  @ApiResponse({ status: 409, description: 'Already on this plan' })
  @Bind(CurrentUser(), Body())
  async purchase(user, body) {
    const dto = plainToInstance(PurchaseSubscriptionDto, body);
    const errors = await validate(dto);
    if (errors.length > 0) throw new BadRequestException(errors);
    return this.subscriptionsService.purchase(user.id, dto);
  }

  @Post('expire-check')
  @ApiOperation({
    summary: 'Manually run subscription expiry job (non-production only)',
  })
  @ApiResponse({ status: 201, description: 'Expiry job finished' })
  @ApiResponse({ status: 400, description: 'Blocked in production' })
  async expireCheck() {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Not available in production');
    }
    return this.subscriptionExpiryJob.runExpiryCheck();
  }
}