const {
  Injectable,
  Dependencies,
  ForbiddenException,
} = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { ROLES_KEY } = require('../decorators/roles.decorator');
const { SupabaseDbService } = require('../../supabase/supabase-db.service');

let RolesGuard = class RolesGuard {
  constructor(reflector, supabaseDbService) {
    this.reflector = reflector;
    this.supabaseDbService = supabaseDbService;
  }

  async canActivate(context) {
    const requiredRoles = this.reflector.getAllAndOverride(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() decorator, allow request
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found on request');
    }

    let organizationId =
      request.params?.organizationId ||
      request.params?.orgId ||
      request.query?.organizationId ||
      request.query?.orgId ||
      request.body?.organizationId ||
      request.body?.orgId;

    // Routes like PATCH/DELETE /api/teams/:memberId only carry a
    // memberId in the URL, not an orgId — look the org up via the
    // team_members row instead of requiring the frontend to send it.
    if (!organizationId && request.params?.memberId) {
      const member = await this.supabaseDbService.findOne('team_members', {
        select: 'org_id',
        filters: { id: request.params.memberId },
      });
      organizationId = member?.org_id;
    }

    if (!organizationId) {
      throw new ForbiddenException('Organization id not found');
    }

    // Owners now have a real row in team_members (role_id=1), so this is
    // a single query instead of also checking organizations.owner_id.
    const ownerMembership = await this.supabaseDbService.findOne('team_members', {
      select: 'role_id',
      filters: {
        org_id: organizationId,
        user_id: request.user.id,
        invite_status: 2,
      },
    });

    if (!ownerMembership || ownerMembership.role_id !== 1) {
      throw new ForbiddenException('Only owners of this organization can perform this action');
    }

    const userRole = 1;

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
};

RolesGuard = Injectable()(RolesGuard) || RolesGuard;
RolesGuard =
  Dependencies(Reflector, SupabaseDbService)(RolesGuard) || RolesGuard;

module.exports = {
  RolesGuard,
};