import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        type: String,
        example: "john.doe@example.com",
        description: "User email"
    })
    @IsEmail()
    email;

    @ApiProperty({
        type: String,
        example: "password123",
        description: "User password"
    })
    @IsString()
    @MinLength(8)
    password;
}