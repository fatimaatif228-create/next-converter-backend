import { 
  Bind, 
  Body, 
  Controller, 
  Get, 
  Post, 
  UseGuards, 
  BadRequestException,
  Scope 
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Dependencies, HttpCode } from '@nestjs/common';

import { REQUEST } from '@nestjs/core';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetDto } from './dto/password-reset.dto';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';


// Request-scoped so REQUEST resolves to the current HTTP request, letting us
// read the body manually instead of using @Body() (a parameter decorator —
// see EmailController for the full explanation of why that's avoided here).
@ApiTags('Auth')
@Controller({ path: 'auth', scope: Scope.REQUEST })
@Dependencies(AuthService, REQUEST)
export class AuthController {
  constructor(authService, request) {
    this.authService = authService;
    this.request = request;
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns token and user object',
  })
   @ApiResponse({
    status: 400,
    description: 'Invalid request body fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
  })
  @Bind(Body())
  async login(body) {   
    // convert plain request body object into a LoginDto instance
    const dto = plainToInstance(LoginDto, body);

    // run class-validator decorators on dto instance and return array of ValidationError objects
    const errors = await validate(dto);

    // if any field failed validation then return 400
    if(errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.authService.login(dto);
  }

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
   @ApiResponse({
    status: 400,
    description: 'Password mismatch or weak password',
  })
  @ApiResponse({
    status: 409,
    description: 'An account with this email already exists',
  })
  @Bind(Body())
  async register(body) {  
    const dto = plainToInstance(RegisterDto, body);
    const errors = await validate(dto);
    
    if(errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.authService.register(dto);
  }

  @Get('getUser')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user returned successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @Bind(CurrentUser())
  async getMe(user) {
    return this.authService.getMe(user);
  }

  @Post('forgot-password')
  @HttpCode(201)
  @ApiOperation({ summary: 'Reset password' })
  @ApiBody({ type: PasswordResetDto })
  @ApiResponse({
    status: 200,
    description: 'Reset email successfully sent',
  })
  @Bind(Body())
  async forgotPassword(body) {  
    const dto = plainToInstance(PasswordResetDto, body);
    const errors = await validate(dto);
    
    if(errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.authService.passwordReset(dto);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Create or update the current user\'s profile row',
  })
  @ApiBody({
    schema: {
      example: {
        id: 'a1b2c3d4-...',
        email: 'user@example.com',
        name: 'Jane Doe',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User synced' })
  async sync() {
    const body = this.request.body || {};
    const { id, email, name } = body;

    if (!id || !email || !name) {
      throw new BadRequestException('"id", "email", and "name" are required');
    }

    return this.authService.syncUser({ id, email, name });
  }

}
