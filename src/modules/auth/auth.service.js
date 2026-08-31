import { 
  Dependencies, 
  Injectable,  
  UnauthorizedException, 
  ConflictException,
  Logger 
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import { SupabaseDbService } from '../../supabase/supabase-db.service';
import { ConfigService } from '@nestjs/config';

import { EMAIL_SERVICE } from '../email/email.tokens';
import { welcomeEmail, passwordResetEmail } from '../email/templates';

const USERS_TABLE = 'users';

@Injectable()
@Dependencies(SupabaseDbService, EMAIL_SERVICE, ConfigService)
export class AuthService {
  constructor(supabaseDbService, emailService, configService) {
    this.supabaseDbService = supabaseDbService;
    this.emailService = emailService;
    this.configService = configService;
    this.logger = new Logger(AuthService.name);
  }

  async login({ email, password }) {
    // IMPORTANT: signInWithPassword() mutates the session state of
    // whichever Supabase client it's called on. supabaseDbService.getClient()
    // returns ONE shared client used by the entire app (built with the
    // service_role key so it can bypass RLS for admin-style operations).
    // Calling signInWithPassword() on that shared client would overwrite
    // its session with this user's low-privilege token — and every other
    // request in the app (Remove member, role updates, etc.) would then
    // run under that leaked session instead of the service_role key,
    // getting silently blocked by RLS until the process restarts.
    //
    // Fix: verify the password with a throwaway client of our own, built
    // fresh for this call, using the public/anon key (this is exactly what
    // signInWithPassword is meant to be used with). The shared admin client
    // is never touched here, so its session stays clean.
    const authClient = createClient(
      this.configService.get('supabaseUrl'),
      this.configService.get('supabasePublishablekey'),
    );

    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

    if(error) {
      console.log('SUPABASE LOGIN ERROR:', error.message); // TEMP - hata dena baad mein
      throw new UnauthorizedException('Invalid email or password');
    }

    const supabase = this.supabaseDbService.getClient();
    const user = data.user;

    // check if the user has been soft deleted in the public users table
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('is_deleted')
      .eq('id', user.id)
      .maybeSingle(); // expect 0 or 1 rows
    
    if(userError) {
      throw userError;
    }

    // prevent deleted accounts from logging in
    if(existingUser?.is_deleted) {
      throw new UnauthorizedException('Account has been deleted'); 
    }

    // sync auth user information into public users table
    // upsert creates row if it does not exists or updates row it if does
    const { data: syncedUser, error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email,
        },
        { onConflict: 'id' },
      ).select().single();

    if(upsertError) {
      throw upsertError;
    }

    console.log('Upsert result:', syncedUser);
    console.log('Upsert error:', upsertError);

    // Auto-accept any pending team invites for this person on login — no
    // manual "accept invitation" click needed, and no re-invite needed
    // from the owner if this account didn't exist yet at invite time.
    await this.linkPendingTeamInvites({ userId: user.id, email: user.email });

    // return JWT token and user profile information
    return {
      token: data.session.access_token,
      expiresIn: '7d',
      user: {
        id: syncedUser.id,
        email: syncedUser.email,
        name: syncedUser.name,
        avatarUrl: syncedUser.avatar_url,
        planTier: syncedUser.plan_tier,
        roleId: syncedUser.role_id,
        createdAt: syncedUser.created_at,
        updatedAt: syncedUser.updated_at
      }
    }
  }

  async register({ name, email, password }) {
    const supabase = this.supabaseDbService.getClient();

    // Use the admin generateLink('signup') call to BOTH create the unconfirmed
    // user and produce the verification link in one step. Unlike auth.signUp(),
    // generateLink() never sends an email through Supabase's own SMTP server —
    // it just returns the link — so a broken/misconfigured Supabase SMTP config
    // can no longer 500 this endpoint. We deliver the verification email
    // ourselves via Resend below.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if(linkError) {
      // GoTrue reports an existing account with messages like
      // "User already registered" / "email address already registered".
      const message = linkError.message || '';
      if(message.includes('already') || message.includes('registered')) {
        throw new ConflictException('An account with this email already exists');
      }

      throw linkError;
    }

    // NOTE: the public.users row is intentionally NOT created here at
    // signup. Supabase blocks login for unverified emails, so the row is
    // only created in login()'s upsert — the first successful login,
    // which can only happen after the person has verified their email.
    // This keeps "exists in public.users" meaning "verified account
    // exists", which is what TeamsService.invite() relies on to decide
    // whether to add someone directly vs. send a pending/signup invite.

    // extract verification url from Supabase's response
    const verificationUrl = linkData.properties.action_link;

    // fire-and-forget welcome email
    this.sendWelcomeEmail({
      email,
      name,
      verificationUrl,
    });

    return {
      message: 'Registration successful. Please verify your email before logging in.',
    }
  }

  async getMe(user) {
    const supabase = this.supabaseDbService.getClient();

    // fetch user profile data from public users table
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if(error) {
      throw error;
    }

    // return user profile information
    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        planTier: profile.plan_tier,
        roleId: profile.role_id,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    }
  }

  async passwordReset({ email }) {
    const supabase = this.supabaseDbService.getClient();
    const redirectLink = this.configService.get('SUPABASE_REDIRECT_URL');

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: redirectLink
        }
    });

    if(linkError) {
      return {
        message: 'If that email exists, a reset link has been sent.',
      }
    }

    const resetURL = linkData.properties.action_link;

    this.sendPasswordResetEmail({
      resetUrl: resetURL,
      email
    });

    return {
      message: 'If that email exists, a reset link has been sent.',
    }

  }

  /**
   * Creates or updates a user's profile row keyed on their Supabase auth id.
   * Sends a welcome email only the first time a given user is created.
   *
   * @param {{ id: string, email: string, name: string }} payload
   */
  async syncUser(payload) {
    const { id, email, name } = payload;

    const existingUser = await this.supabaseDbService.findOne(USERS_TABLE, {
      filters: { id },
    });

    const isNewUser = !existingUser;

    let user;
    if (isNewUser) {
      const [created] = await this.supabaseDbService.insert(USERS_TABLE, {
        id,
        email,
        name,
      });
      user = created;
    } else {
      const [updated] = await this.supabaseDbService.update(
        USERS_TABLE,
        { email, name },
        { id },
      );
      user = updated;
    }

    if (isNewUser) {
      this.sendWelcomeEmail(user);
    }

    return user;
  }

  /**
   * Links any pending team invites to this user on login:
   *
   * 1. Invites created while the person already had an account — the
   *    team_members row already has user_id set, just needs invite_status
   *    flipped from pending(1) to accepted(2).
   * 2. Invites created before the person had an account — the row has
   *    user_id = NULL and invite_email = their email. We now know their
   *    real user_id, so we set it and mark the invite accepted.
   *
   * Both cases run on every login (cheap no-op if there's nothing pending),
   * so the owner never needs to send a second invite after someone signs up.
   */
  async linkPendingTeamInvites({ userId, email }) {
    const supabase = this.supabaseDbService.getClient();

    try {
      // Case 1: already had an account when invited.
      const { error: existingAccountError } = await supabase
        .from('team_members')
        .update({ invite_status: 2, accepted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('invite_status', 1);

      if (existingAccountError) {
        throw existingAccountError;
      }

      // Case 2: didn't have an account yet when invited — link by email.
      const { error: newAccountError } = await supabase
        .from('team_members')
        .update({ user_id: userId, invite_status: 2, accepted_at: new Date().toISOString() })
        .eq('invite_email', email)
        .is('user_id', null)
        .eq('invite_status', 1);

      if (newAccountError) {
        throw newAccountError;
      }
    } catch (error) {
      // Never block login over this — just log it, worst case the person
      // sees "no team" once and it self-heals on their next login.
      this.logger.error(
        `Failed to link pending team invites for ${email}: ${
          error instanceof Error ? error.message : JSON.stringify(error)
        }`,
      );
    }
  }

  /**
   * Fire-and-forget: intentionally not awaited by the caller. Wrapped in
   * setImmediate so it runs on a later tick, after the HTTP response for
   * syncUser() has already been sent — a slow or failing email send must
   * never delay or break signup.
   */
  sendWelcomeEmail({ email, name, verificationUrl }) {
    setImmediate(async () => {
      try {
        const frontendUrl = this.configService.get('frontendUrl');
        const html = welcomeEmail({
          name,
          dashboardUrl: `${frontendUrl}/dashboard`,
          verificationUrl,
        });

        await this.emailService.sendEmail(
          email,
          'Welcome to Repress',
          html,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send welcome email to ${email}: ${
            error instanceof Error ? error.message : JSON.stringify(error)
          }`,
        );
      }
    });
  }

  sendPasswordResetEmail({ resetUrl, email }) {
    setImmediate(async () => {
      try {
        const html = passwordResetEmail({
          resetUrl,
        });

        await this.emailService.sendEmail(
          email,
          'Password Reset Repress',
          html,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send password reset email: ${
            error instanceof Error ? error.message : JSON.stringify(error)
          }`,
        );
      }
    });
  }
}