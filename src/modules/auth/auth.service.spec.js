import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService;
  let supabaseDbService;

  beforeEach(() => {
    supabaseDbService = {
      getClient: jest.fn(),
    };

    authService = new AuthService(supabaseDbService);
  });

  describe('getMe', () => {
    it('should return formatted user object', async () => {
      const user = {
        id: 'user-123',
        email: 'vincent@test.com',
        user_metadata: {
          name: 'Vincent Huynh',
          avatarUrl: 'https://example.com/avatar.png',
          planTier: 'free',
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const result = await authService.getMe(user);

      expect(result).toEqual({
        user: {
          id: 'user-123',
          email: 'vincent@test.com',
          name: 'Vincent Huynh',
          avatarUrl: 'https://example.com/avatar.png',
          planTier: 'free',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      });
    });
  });
});
