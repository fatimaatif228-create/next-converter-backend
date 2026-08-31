import {
  IsString,
  IsIn,
  IsNotEmpty,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CardDto {
  @ApiProperty({
    type: String,
    example: '4242424242424242',
    description: 'Learning/test card only. Real cards are never stored.',
  })
  @IsString()
  @Length(16, 16)
  number = '';

  @ApiProperty({ type: String, example: '12' })
  @IsString()
  @IsNotEmpty()
  expiryMonth = '';

  @ApiProperty({ type: String, example: '2028' })
  @IsString()
  @IsNotEmpty()
  expiryYear = '';

  @ApiProperty({ type: String, example: '123' })
  @IsString()
  @Length(3, 4)
  cvv = '';

  @ApiProperty({ type: String, example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  holderName = '';
}

export class PurchaseSubscriptionDto {
  @ApiProperty({
    type: String,
    example: 'pro',
    description: 'Plan slug, for example: free, pro, agency, enterprise',
  })
  @IsString()
  @IsNotEmpty()
  planSlug = '';

  @ApiProperty({
    type: String,
    example: 'monthly',
    enum: ['monthly', 'yearly'],
  })
  @IsIn(['monthly', 'yearly'])
  billingCycle = '';

  @ApiProperty({
    type: () => CardDto,
    description: 'Test card details only. Never stored in database.',
  })
  @ValidateNested()
  @Type(() => CardDto)
  card = new CardDto();
}