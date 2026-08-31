import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard;
  let supabaseService;
  let request;
  let context;

  beforeEach(() => {
    supabaseService = {
      getClient: jest.fn().mockReturnValue({
        auth: {
          getUser: jest.fn(),
        },
      }),
    };

    guard = new JwtAuthGuard(supabaseService);

    request = {
      headers: {},
    };

    context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    };
  });

  it('should return true and attach user to request when token is valid', async () => {
    const user = {
      id: 'user-123',
      email: 'vincent@test.com',
    };

    request.headers.authorization = 'Bearer valid-token';

    supabaseService.getClient().auth.getUser.mockResolvedValue({
      data: {
        user,
      },
      error: null,
    });

    const result = await guard.canActivate(context);

    expect(supabaseService.getClient().auth.getUser).toHaveBeenCalledWith(
      'valid-token',
    );

    expect(request.user).toEqual(user);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when token is missing', async () => {
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    request.headers.authorization = 'Bearer invalid-token';

    supabaseService.getClient().auth.getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: {
        message: 'Invalid token',
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(supabaseService.getClient().auth.getUser).toHaveBeenCalledWith(
      'invalid-token',
    );
  });
});
