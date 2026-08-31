import {
  Dependencies,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
@Dependencies(SupabaseService)
export class JwtAuthGuard {
  constructor(supabaseService) {
    this.supabaseService = supabaseService;
  }

  async canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const { authorization } = request.headers;

    if (!authorization || authorization.trim() === '') {
      throw new UnauthorizedException('Please provide token');
    }

    const token = authorization.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      throw new UnauthorizedException('Invalid token format');
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = data.user;
    return true;
  }
}
