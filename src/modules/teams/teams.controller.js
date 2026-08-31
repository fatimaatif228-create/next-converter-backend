import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Bind,
    Body,
    Query,
    Param,
    UseGuards,
    Dependencies,
    BadRequestException
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { TeamsService } from './teams.service';
import { TeamInviteDto } from './dto/team-invite.dto';
import { plainToInstance } from 'class-transformer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { validate } from 'class-validator';
import { RolesGuard } from '../../common/guards/roles.guard';

// An organization has exactly one OWNER, assigned automatically at
// creation (see TeamsService.createOrganization). Nobody — not even the
// current owner — can hand out OWNER through invite or role updates.
const OWNER_ROLE_ID = 1;
const ASSIGNABLE_ROLES = [2, 3]; // EDITOR, VIEWER

@ApiTags('Teams')
@Controller('teams')
@Dependencies(TeamsService)
export class TeamsController {
    constructor(teamsService) {
        this.teamsService = teamsService;
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Get the current user's team overview (auto-detects their org)" })
    @ApiResponse({
        status: 200,
        description: 'hasTeam: false + empty members if the user has no organization yet',
    })
    @Bind(CurrentUser())
    async getOverview(user) {
        return this.teamsService.getTeamOverview(user.id);
    }

    @Post('create')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new organization owned by the current user' })
    @ApiBody({ schema: { example: { name: 'My Team' } } })
    @ApiResponse({ status: 201, description: 'Organization created' })
    @ApiResponse({ status: 400, description: 'name missing from request body' })
    @Bind(CurrentUser(), Body())
    async createTeam(user, body) {
        if (!body?.name || !body.name.trim()) {
            throw new BadRequestException('name is required');
        }

        return this.teamsService.createOrganization({ ownerId: user.id, name: body.name.trim() });
    }

    @Post('leave')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Leave the team you currently belong to (members only, not owners)' })
    @ApiResponse({ status: 201, description: 'Left the team' })
    @ApiResponse({ status: 401, description: 'User not authenticated' })
    @ApiResponse({ status: 409, description: 'User is an owner, or not currently on any team' })
    @Bind(CurrentUser())
    async leaveTeam(user) {
        return this.teamsService.leaveTeam(user.id);
    }

    @Patch(':memberId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(1)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Update a team member's role (EDITOR or VIEWER only — OWNER cannot be assigned)" })
    @ApiParam({ name: 'memberId', type: String })
    @ApiBody({ schema: { example: { role: 'EDITOR' } } })
    @ApiResponse({ status: 200, description: 'Role updated' })
    @ApiResponse({ status: 400, description: 'role missing, or an attempt to assign OWNER' })
    @ApiResponse({ status: 401, description: 'User not authenticated' })
    @ApiResponse({ status: 403, description: 'User is not an owner' })
    @Bind(Param('memberId'), Body())
    async updateRole(memberId, body) {
        if (!body?.role) {
            throw new BadRequestException('role is required');
        }

        // Accept either the numeric id or the string label, then check it
        // against the numeric id either way — an org can only have one owner.
        const ROLE_LABEL_TO_ID = { OWNER: 1, EDITOR: 2, VIEWER: 3 };
        const requestedRoleId = typeof body.role === 'number' ? body.role : ROLE_LABEL_TO_ID[body.role];

        if (requestedRoleId === OWNER_ROLE_ID || !ASSIGNABLE_ROLES.includes(requestedRoleId)) {
            throw new BadRequestException('role must be EDITOR or VIEWER — an organization can only have one OWNER');
        }

        return this.teamsService.updateRole(memberId, body.role);
    }

    @Delete(':memberId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(1)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove a team member' })
    @ApiParam({ name: 'memberId', type: String })
    @ApiResponse({ status: 200, description: 'Member removed' })
    @ApiResponse({ status: 401, description: 'User not authenticated' })
    @ApiResponse({ status: 403, description: 'User is not an owner' })
    @Bind(Param('memberId'))
    async remove(memberId) {
        return this.teamsService.removeMember(memberId);
    }

    @Post('invite')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(1)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Invite user to an organization as EDITOR or VIEWER' })
    @ApiBody({ type: TeamInviteDto })
    @ApiResponse({ status: 201, description: 'Invitation created' })
    @ApiResponse({ status: 400, description: 'Invalid request body fields, or an attempt to invite as OWNER' })
    @ApiResponse({ status: 401, description: 'User not authenticated' })
    @ApiResponse({ status: 403, description: 'User is not an owner' })
    @ApiResponse({ status: 404, description: 'No account exists for that email' })
    @ApiResponse({ status: 409, description: 'That email is already a member' })
    @Bind(Body())
    async invite(body) {
        const dto = plainToInstance(TeamInviteDto, body);
        const errors = await validate(dto);

        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }

        // Use the validated + transformed dto, not the raw body, so the
        // class-validator checks above (including the EDITOR/VIEWER-only
        // role restriction) actually apply to what gets passed downstream.
        return this.teamsService.invite(dto);
    }

    @Get('invite/accept')
    @ApiOperation({ summary: 'Accept team invitation' })
    @ApiQuery({
        name: 'token',
        required: true,
        type: String,
        description: 'Invite token',
    })
    @ApiResponse({ status: 200, description: 'Invitation successfuly accepted' })
    @ApiResponse({ status: 400, description: 'Invite token missing or invalid' })
    @ApiResponse({ status: 409, description: 'Invitation already accepted' })
    @Bind(Query('token'))
    async acceptInvite(token) {
        return this.teamsService.acceptInvite(token);
    }
}