import {
  Injectable,
  Dependencies,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { SupabaseDbService } from '../../supabase/supabase-db.service';
import { EMAIL_SERVICE } from '../email/email.tokens';
import { ConfigService } from '@nestjs/config';
import { teamInviteEmail } from '../email/templates/team-invite.template';
import { randomUUID } from 'crypto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

// role_id in the database is a number (1/2/3). The frontend wants readable
// strings ("OWNER"/"EDITOR"/"VIEWER"), so we convert at the edge here rather
// than changing the database itself.
const ROLE_ID_TO_LABEL = { 1: 'OWNER', 2: 'EDITOR', 3: 'VIEWER' };
const ROLE_LABEL_TO_ID = { OWNER: 1, EDITOR: 2, VIEWER: 3 };

@Injectable()
@Dependencies(SupabaseDbService, EMAIL_SERVICE, ConfigService, SubscriptionsService)
export class TeamsService {
  constructor(supabaseDbService, emailService, configService, subscriptionsService) {
    this.supabaseDbService = supabaseDbService;
    this.emailService = emailService;
    this.configService = configService;
    this.subscriptionsService = subscriptionsService;
    this.logger = new Logger(TeamsService.name);
  }

  // -----------------------------------------------------------------
  // Figures out which organization (if any) the current user belongs
  // to — either because they own it, or because they're an accepted
  // team_members row on someone else's org.
  // Returns null if the user has no organization at all yet.
  // -----------------------------------------------------------------
  async getMyMembership(userId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('org_id, role_id')
      .eq('user_id', userId)
      .eq('invite_status', 2) // 2 = accepted
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      return null;
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', membership.org_id)
      .single();

    if (orgError) {
      throw orgError;
    }

    return { orgId: org.id, orgName: org.name, roleId: membership.role_id };
  }

  // -----------------------------------------------------------------
  // Single call the Team page uses: figures out the user's org (if
  // any) and returns everything the page needs in one response.
  // -----------------------------------------------------------------
  async getTeamOverview(userId) {
    const membership = await this.getMyMembership(userId);

    if (!membership) {
      return {
        hasTeam: false,
        orgId: null,
        orgName: null,
        isOwner: false,
        members: [],
      };
    }

    const members = await this.listMembers(membership.orgId);

    return {
      hasTeam: true,
      orgId: membership.orgId,
      orgName: membership.orgName,
      isOwner: membership.roleId === 1,
      members,
    };
  }

  async createOrganization({ ownerId, name }) {
    const supabase = this.supabaseDbService.getClient();

    // Enforce one-team-per-user here too — without this, a user could
    // call /teams/create repeatedly and end up owning multiple orgs
    // (no unique constraint on organizations.owner_id), which breaks
    // every .maybeSingle() query keyed on owner_id elsewhere
    // (getMyMembership, resolveCallersOwnOrgId, leaveTeam).
    const existingMembership = await this.getMyMembership(ownerId);
    if (existingMembership) {
      throw new ConflictException(
        "You already belong to a team. Leave your current team before creating a new one.",
      );
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert({ owner_id: ownerId, name })
      .select()
      .single();

    if (error) {
      // Postgres unique-violation (e.g. duplicate team name) surfaces
      // as a raw 500 otherwise — give a clean 409 instead.
      if (error.code === '23505') {
        throw new ConflictException('A team with that name already exists.');
      }
      throw error;
    }

    // Give the owner a REAL row in team_members instead of leaving them
    // as a "virtual" member derived from organizations.owner_id. This
    // makes team_members the single source of truth for "who belongs
    // to this team" — every other feature (chat, presence, anything
    // future) can just query team_members without also needing a
    // separate owner_id fallback check.
    const { error: ownerRowError } = await supabase.from('team_members').insert({
      org_id: data.id,
      user_id: ownerId,
      role_id: 1, // OWNER
      invite_status: 2, // accepted
      accepted_at: data.created_at,
      invited_at: data.created_at,
    });

    if (ownerRowError) {
      // Don't leave an org behind with no owner membership row —
      // clean up so createOrganization() is all-or-nothing.
      await supabase.from('organizations').delete().eq('id', data.id);
      throw ownerRowError;
    }

    return data;
  }

  async listMembers(orgId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: memberRows, error: membersError } = await supabase
      .from('team_members')
      .select('id, user_id, invite_email, role_id, accepted_at, invite_status')
      .eq('org_id', orgId);

    if (membersError) {
      throw membersError;
    }

    // Some rows may have user_id = NULL (invited before they had an
    // account) — only query the users table for the ones that do.
    const userIds = memberRows.filter((m) => m.user_id).map((m) => m.user_id);

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

    if (usersError) {
      throw usersError;
    }

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const members = memberRows
      .map((m) => {
        const isPendingNoAccount = !m.user_id; // invited before they had an account
        return {
          id: m.id,
          userId: m.user_id,
          name: isPendingNoAccount
            ? m.invite_email || 'Pending invite'
            : userMap[m.user_id]?.name,
          email: isPendingNoAccount
            ? m.invite_email || '—'
            : userMap[m.user_id]?.email,
          role: ROLE_ID_TO_LABEL[m.role_id] || 'MEMBER',
          inviteStatus: m.invite_status,
          joinedAt: m.accepted_at,
        };
      })
      // Owner first, then everyone else — matches the previous
      // display order the frontend already expects.
      .sort((a, b) => (a.role === 'OWNER' ? -1 : b.role === 'OWNER' ? 1 : 0));

    return members;
  }

  async updateRole(memberId, roleLabel) {
    const supabase = this.supabaseDbService.getClient();
    const roleId = ROLE_LABEL_TO_ID[roleLabel] || roleLabel; // accept either "EDITOR" or 2

    // Defense in depth: the controller already blocks OWNER (1), but
    // guard here too in case updateRole is ever called from elsewhere.
    if (roleId === 1) {
      throw new ConflictException(
        'Cannot assign OWNER role — an organization can only have one owner',
      );
    }

    const { data, error } = await supabase
      .from('team_members')
      .update({ role_id: roleId })
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async removeMember(memberId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: member, error: fetchError } = await supabase
      .from('team_members')
      .select('role_id')
      .eq('id', memberId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!member) {
      throw new NotFoundException('Member not found.');
    }

    // The owner's row now exists in team_members (real, not virtual) —
    // it must never be removable through this path.
    if (member.role_id === 1) {
      throw new ConflictException("The owner's row can't be removed from the team.");
    }

    const { error } = await supabase.from('team_members').delete().eq('id', memberId);

    if (error) {
      throw error;
    }

    return { removed: true };
  }

  // Self-service exit: a member (Editor/Viewer) leaves the team they
  // currently belong to, so they're free to accept a different invite
  // afterward (an account can only belong to one team at a time).
  // Owners cannot leave their own organization this way — there's no
  // "leave" for the person the org belongs to.
  async leaveTeam(userId) {
    const supabase = this.supabaseDbService.getClient();

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('id, role_id')
      .eq('user_id', userId)
      .eq('invite_status', 2)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      throw new ConflictException("You're not currently a member of any team.");
    }

    if (membership.role_id === 1) {
      throw new ConflictException(
        "You're the owner of your team — owners can't leave their own team.",
      );
    }

    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', membership.id);

    if (deleteError) {
      throw deleteError;
    }

    return { left: true };
  }

  async invite({ orgId, email, role }) {
    const supabase = this.supabaseDbService.getClient();
    const roleId = ROLE_LABEL_TO_ID[role] || role; // accept either "EDITOR" or 2

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, owner_id')
      .eq('id', orgId)
      .single();

    if (orgError) {
      throw orgError;
    }

    // Plan limit gatekeeper (BE-043) — owner subscription seats
    await this.subscriptionsService.checkTeamSeatLimit(org.owner_id);

    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    // Enforce one-team-per-user: don't invite someone who already
    // belongs to another organization (as owner or accepted member).
    // Owners now have a real team_members row (role_id=1), so this one
    // query covers both cases.
    if (user) {
      const { data: existingElsewhere, error: existingElsewhereError } = await supabase
        .from('team_members')
        .select('id, org_id, role_id')
        .eq('user_id', user.id)
        .eq('invite_status', 2)
        .maybeSingle();

      if (existingElsewhereError) {
        throw existingElsewhereError;
      }

      if (existingElsewhere && existingElsewhere.org_id !== orgId) {
        const reason =
          existingElsewhere.role_id === 1
            ? 'owns their own team'
            : 'is already a member of another team';
        throw new ConflictException(
          `${email} already ${reason} and can only be part of one team at a time. They need to leave their current team first.`,
        );
      }
    }

    // Whether or not an account exists yet, check there's no existing
    // pending/accepted invite for this email in this org already.
    const existingMemberQuery = user
      ? supabase
          .from('team_members')
          .select('id')
          .eq('org_id', orgId)
          .eq('user_id', user.id)
          .maybeSingle()
      : supabase
          .from('team_members')
          .select('id')
          .eq('org_id', orgId)
          .eq('invite_email', email)
          .is('user_id', null)
          .maybeSingle();

    const { data: existingMember, error: existingError } = await existingMemberQuery;

    if (existingError) {
      if (existingError.code === '42703') {
        throw new ConflictException(
          `${email} doesn't have an account yet, and inviting emails without an account requires a pending database migration that hasn't been run yet. Ask them to sign up and log in first, then invite them again — or run the invite_email migration.`,
        );
      }
      throw existingError;
    }

    if (existingMember) {
      throw new ConflictException(
        `${email} is already a member of this team, or already has a pending invite.`,
      );
    }

    const { data: inviter, error: inviterError } = await supabase
      .from('users')
      .select('name')
      .eq('id', org.owner_id)
      .single();

    if (inviterError) {
      throw inviterError;
    }

    const inviteToken = randomUUID();
    const one_day = 24 * 60 * 60 * 1000;
    const inviteExpiration = new Date(Date.now() + 7 * one_day).toISOString();

    if (!user) {
      // No account exists yet for this email. We create the
      // team_members row right now with user_id = NULL and
      // invite_email set. The row gets linked to a real user_id
      // automatically the first time that email logs in — see
      // AuthService.login()'s pending-invite linking step. No
      // re-invite from the owner is needed after they sign up.
      const { error: pendingInsertError } = await supabase.from('team_members').insert({
        org_id: org.id,
        user_id: null,
        invite_email: email,
        role_id: roleId,
        accepted_at: null,
        invite_token: inviteToken,
        invite_status: 1,
        invite_expires_at: inviteExpiration,
      });

      if (pendingInsertError) {
        if (pendingInsertError.code === '42703') {
          // invite_email column doesn't exist yet — the SQL
          // migration hasn't been run in Supabase. Give a clear
          // message instead of the raw Postgres error.
          throw new ConflictException(
            `${email} doesn't have an account yet, and inviting emails without an account requires a pending database migration that hasn't been run yet. Ask them to sign up and log in first, then invite them again — or run the invite_email migration.`,
          );
        }
        throw pendingInsertError;
      }

      this.sendJoinInviteEmail({
        inviterName: inviter.name,
        organizationName: org.name,
        role: roleId,
        recipient: email,
      });

      return { message: 'Invite sent!' };
    }

    const { error } = await supabase.from('team_members').insert({
      org_id: org.id,
      user_id: user.id,
      role_id: roleId,
      accepted_at: null,
      invite_token: inviteToken,
      invite_status: 1,
      invite_expires_at: inviteExpiration,
    });

    if (error) {
      throw error;
    }

    this.sendTeamInviteEmail({
      inviterName: inviter.name,
      organizationName: org.name,
      role: roleId,
      inviteToken,
      recipient: user.email,
    });

    return { message: 'Invite sent!' };
  }

  async acceptInvite(token) {
    const supabase = this.supabaseDbService.getClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, role_id, invite_token, invite_status, accepted_at, invite_expires_at')
      .eq('invite_token', token)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new NotFoundException('Invite token is invalid or does not exist.');
    }

    if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
      throw new ConflictException(
        'This invite has expired. Ask the team owner to send a new one.',
      );
    }

    if (data.invite_token && data.invite_status != 3 && data.invite_status != 2) {
      const { error } = await supabase
        .from('team_members')
        .update({
          invite_status: 2,
          accepted_at: new Date(Date.now()).toISOString(),
        })
        .eq('invite_token', token);

      if (error) {
        throw error;
      }
    }

    return {
      id: data.user_id,
      role: data.role_id,
    };
  }

  sendTeamInviteEmail({ inviterName, organizationName, role, inviteToken, recipient }) {
    setImmediate(async () => {
      try {
        const frontendUrl = this.configService.get('frontendUrl');
        // No manual "accept" click needed anymore — the invite is
        // linked and marked accepted automatically the next time
        // this email logs in (see AuthService.login()). The email
        // just needs to get them to the login page.
        const inviteUrl = `${frontendUrl}/login`;
        const html = teamInviteEmail({
          inviterName,
          organizationName,
          role,
          inviteUrl,
        });

        await this.emailService.sendEmail(
          recipient,
          `You've been invited to join ${inviterName}'s team on Repress`,
          html,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send team invite email to ${recipient}: ${
            error instanceof Error ? error.message : JSON.stringify(error)
          }`,
        );
      }
    });
  }

  // For emails that don't have an account yet — points to /signup instead
  // of an invite-accept link, since there's no team_members row to accept.
  sendJoinInviteEmail({ inviterName, organizationName, role, recipient }) {
    setImmediate(async () => {
      try {
        const frontendUrl = this.configService.get('frontendUrl');
        const html = teamInviteEmail({
          inviterName,
          organizationName,
          role,
          inviteUrl: `${frontendUrl}/signup`,
        });

        await this.emailService.sendEmail(
          recipient,
          `You've been invited to join ${inviterName}'s team on Repress`,
          html,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send join-invite email to ${recipient}: ${
            error instanceof Error ? error.message : JSON.stringify(error)
          }`,
        );
      }
    });
  }
}