import { UsersService } from "./users.service";
import { UpdateUserDto } from "../auth/dto/update-user.dto";
import { DeleteUserDto } from "../auth/dto/delete-user.dto";

import { 
    Bind, 
    Body, 
    Controller, 
    Dependencies,
    Patch, 
    UseGuards,
    Delete, 
    BadRequestException } from '@nestjs/common';

import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiResponse,
    ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';


@ApiTags('Users')
@Controller('users')
@Dependencies(UsersService)
export class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }

    @Patch('updateUser')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update current authenticated user' })
    @ApiBody({ type: UpdateUserDto })
    @ApiResponse({
        status: 200,
        description: 'User updated successfully',
    })
        @ApiResponse({
        status: 400,
        description: 'Invalid input or no fields provided',
    })
    @ApiResponse({
        status: 401,
        description: 'Invalid or expired token',
    })
    @Bind(CurrentUser(), Body())
    async updateMe(user, body) {   
        const dto = plainToInstance(UpdateUserDto, body);

        const errors = await validate(dto);

        if(errors.length > 0) {
            throw new BadRequestException(errors);
        }

        return this.usersService.updateMe(user, dto);
    }

    @Delete('deleteUser')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete current authenticated user' })
    @ApiBody({ type: DeleteUserDto })
    @ApiResponse({
        status: 200,
        description: 'Account successfully deleted',
    })
        @ApiResponse({
        status: 400,
        description: 'Invalid confirmation string',
    })
    @ApiResponse({
        status: 401,
        description: 'Invalid or expired token',
    })
    @Bind(CurrentUser(), Body())
    async deleteMe(user, body) {   
        const dto = plainToInstance(DeleteUserDto, body);

        const errors = await validate(dto);

        if(errors.length > 0) {
            throw new BadRequestException(errors);
        }

        return this.usersService.deleteMe(user);
    }
}