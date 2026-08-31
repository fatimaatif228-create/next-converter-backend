import { IsEmail } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetDto {
    @ApiProperty({
        type: String,
        example: "john.doe@example.com",
        description: "User email"
    })
    @IsEmail()
    email;
}