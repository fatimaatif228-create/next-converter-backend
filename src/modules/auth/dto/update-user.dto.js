import { IsString, MinLength, IsOptional, MaxLength, IsUrl } from "class-validator";

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name;

    @IsOptional()
    @IsUrl()
    avatarUrl;
}