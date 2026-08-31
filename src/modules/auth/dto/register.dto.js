import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({
        type: String,
        example: 'Jane Doe',
        description: "User's full name"
    })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name;

    @ApiProperty({
        type: String,
        example: 'john.doe@example.com',
        description: 'User email'
    })
    @IsEmail()
    email;

    @ApiProperty({
        type: String,
        example: 'password123',
        description: 'User password'
    })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Password must contain atleast one uppercase letter and one number'
    })
    password;

    @ApiProperty({
        type: String,
        example: 'password123',
        description: 'Confirm password'
    })
    @IsString()
    @Match('password')
    confirmPassword;
}