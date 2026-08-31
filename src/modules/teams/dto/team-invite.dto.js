import { IsEmail, IsIn, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class TeamInviteDto {
    @ApiProperty({
        type: String,
        example: 'a123cbd-45rjytu-432-eeabc',
        description: "Organization's id"
    })
    @IsUUID()
    @IsNotEmpty()
    orgId;

    @ApiProperty({
        type: String,
        example: 'john.doe@example.com',
        description: 'User email'
    })
    @IsEmail()
    @IsNotEmpty()
    email;

    @ApiProperty({
        type: Number,
        example: 2,
        description: 'Team member role ID — 2 (EDITOR) or 3 (VIEWER) only. OWNER cannot be invited.'
    })
    @IsIn([2, 3], { message: 'role must be EDITOR (2) or VIEWER (3) — an organization can only have one OWNER' })
    @IsNotEmpty()
    role;
}