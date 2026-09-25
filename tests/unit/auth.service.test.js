import { describe, it, expect } from 'vitest';
import { AuthService } from '../../src/modules/auth/auth.service.js';

describe('AuthService Unit Tests', () => {
  it('should hash passwords and verify successfully with argon2', async () => {
    const rawPassword = 'StrongPassword!123';
    const hash = await AuthService.hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$argon2')).toBe(true);

    const isValid = await AuthService.verifyPassword(hash, rawPassword);
    expect(isValid).toBe(true);

    const isInvalid = await AuthService.verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  });

  it('should sign and verify valid JWT tokens', async () => {
    const payload = {
      userId: 'test-user-uuid-1234',
      email: 'unit-test@example.com'
    };

    const token = await AuthService.generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await AuthService.verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('should reject tampered or invalid JWT tokens', async () => {
    await expect(AuthService.verifyToken('invalid.jwt.token')).rejects.toThrow(
      'Invalid or expired authentication token'
    );
  });
});
