const { Injectable, Dependencies, ForbiddenException } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { SupabaseDbService } = require('../../supabase/supabase-db.service');
const { MIN_ROLE_KEY } = require('../decorators/min-role.decorator');

// Role hierarchy — higher number = more access. OWNER can do everything
// EDITOR can do, EDITOR can do everything VIEWER can do.
const ROLE_RANK = { VIEWER: 1, EDITOR: 2, OWNER: 3 };
const ROLE_ID_TO_LABEL = { 1: 'OWNER', 2: 'EDITOR', 3: 'VIEWER' };

/**
 * Usage once a protected route has an org-scoped resource:
 *
 *   @UseGuards(JwtAuthGuard, MinRoleGuard)
 *   @MinRole('EDITOR')
 *   @Patch(':projectId')
 *   updateProject(...) { ... }
 *
 * Owners now have a real row in team_members (role_id=1), so every check
 * here is a single team_members query — no separate organizations.owner_id
 * fallback needed anymore.
 */
let MinRoleGuard = class MinRoleGuard {
  constructor(reflector, supabaseDbService) {
    this.reflector = reflector;
    this.supabaseDbService = supabaseDbService;
  }

  async canActivate(context) {
    const requiredRole = this.reflector.getAllAndOverride(MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @MinRole() decorator on this route — allow through. JwtAuthGuard
    // (login-required) is presumably still applied separately.
    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found on request');
    }

    const orgId = await this.resolveOrgId(request);

    // No org found for this resource/caller — treat this as a solo/personal
    // project with no team context, and let it through. Without this, any
    // brand-new user who hasn't created or joined a team yet would be
    // permanently blocked from using @MinRole-gated routes at all.
    if (!orgId) {
      return true;
    }

    const userRoleId = await this.getUserRoleInOrg(user.id, orgId);

    if (!userRoleId) {
      throw new ForbiddenException("You're not a member of this team");
    }

    const userRoleLabel = ROLE_ID_TO_LABEL[userRoleId];
    const userRank = ROLE_RANK[userRoleLabel] || 0;
    const requiredRank = ROLE_RANK[requiredRole] || 0;

    if (userRank < requiredRank) {
      throw new ForbiddenException(
        `This action requires ${requiredRole} access or higher — you have ${userRoleLabel}`,
      );
    }

    return true;
  }

  // Figures out which organization the request concerns.
  async resolveOrgId(request) {
    const direct =
      request.params?.organizationId ||
      request.params?.orgId ||
      request.query?.organizationId ||
      request.query?.orgId ||
      request.body?.organizationId ||
      request.body?.orgId;

    if (direct) {
      return direct;
    }

    // No orgId provided directly (e.g. POST /projects/:id/convert only
    // has a projectId, no org info). Since every user belongs to exactly
    // one team (enforced in TeamsService.invite()), resolve the org from
    // the CALLING user's own membership.
    const ownOrgId = await this.resolveCallersOwnOrgId(request.user.id);
    if (ownOrgId) {
      return ownOrgId;
    }

    // TODO: once the `projects` table exists with an org_id column,
    // resolve it here from :projectId instead — same pattern used for
    // resolving org_id from :memberId in RolesGuard:
    //
    // if (request.params?.projectId) {
    //   const project = await this.supabaseDbService.findOne('projects', {
    //     select: 'org_id',
    //     filters: { id: request.params.projectId },
    //   });
    //   return project?.org_id;
    // }

    return null;
  }

  // Owners have a real team_members row now (role_id=1), so this is a
  // single query for both owners and members — no organizations.owner_id
  // fallback needed.
  async resolveCallersOwnOrgId(userId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: membership } = await supabase
      .from('team_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('invite_status', 2)
      .maybeSingle();

    return membership?.org_id || null;
  }

  async getUserRoleInOrg(userId, orgId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: membership } = await supabase
      .from('team_members')
      .select('role_id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('invite_status', 2)
      .maybeSingle();

    return membership?.role_id || null;
  }
};

MinRoleGuard = Injectable()(MinRoleGuard) || MinRoleGuard;
MinRoleGuard = Dependencies(Reflector, SupabaseDbService)(MinRoleGuard) || MinRoleGuard;

module.exports = { MinRoleGuard };