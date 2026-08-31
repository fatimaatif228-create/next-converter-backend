import { Equals, IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class DeleteUserDto {
    @ApiProperty({
        type: String,
        example: "DELETE MY ACCOUNT",
        description: "Type DELETE MY ACCOUNT to confirm account deletion"
    })
    @IsString()
    @Equals('DELETE MY ACCOUNT', {
        message: "Please send confirm: 'DELETE MY ACCOUNT' to confirm account deletion"
    })
    confirm;
}