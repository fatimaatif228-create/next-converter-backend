import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// NOTE: TeamsController.acceptInvite currently reads the token from a query
// param (@Query('token')), not from a request body, so this DTO isn't wired
// up anywhere yet. Kept for consistency / in case the endpoint is later
// changed to accept a POST body instead of a query string.
export class AcceptTeamInviteDto {
    @ApiProperty({
        type: String,
        example: 'a1b2c3d4-...',
        description: 'The invite token sent in the invitation email link',
    })
    @IsUUID()
    @IsNotEmpty()
    token;
}