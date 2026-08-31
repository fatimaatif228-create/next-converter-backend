import { BadRequestException, Dependencies, Injectable } from '@nestjs/common';
import { SupabaseDbService } from '../../supabase/supabase-db.service';


@Injectable()
@Dependencies(SupabaseDbService)
export class UsersService {
  constructor(supabaseDbService) {
    this.supabaseDbService = supabaseDbService;
  }

  async updateMe(user, dto) {
    const { name, avatarUrl } = dto;

    if(!name && !avatarUrl) {
        throw new BadRequestException('At least one field must be provided')
    }

    const supabase = this.supabaseDbService.getClient();
    
    // update name in supabase auth metadata
    if(name) {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          name,
        },
      });

      if(error) {
        throw error;
      }
    }

    const updatedData = {};

    // update name in public users table
    // name needs to stay synced between auth and public table
    if(name) {
        updatedData.name = name;
    }

    if(avatarUrl) {
        updatedData.avatar_url = avatarUrl;
    }

    // update user profile in public users table
    const { data: updatedUser, error: dbError } = await supabase
      .from('users')
      .update(updatedData)
      .eq('id', user.id)
      .select()
      .single();

    if(dbError) {
        throw dbError;
    }

    // return updated user profile
    return {
        user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            avatarUrl: updatedUser.avatar_url,
            planTier: updatedUser.plan_tier,
            roleId: updatedUser.role_id,
            createdAt: updatedUser.created_at,
            updatedAt: updatedUser.updated_at
        }
    }
  }

  async deleteMe(user) {
    const deletedAt = new Date();

    // soft delete user by updated is_deleted bool
    // user record remains in database
    const { error } = await this.supabaseDbService
      .getClient()
      .from('users')
      .update({
        is_deleted: true,
      })
      .eq('id', user.id);

      if(error) {
        console.error('User deletion failed:', error);
        throw error;
      }

    return {
      message: 'Account successfully deleted.',
      deletedAt
    }
  }
}
