import { AuthRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import { signAccessToken, verifyAccessToken } from '../../common/security/jwt.js';
import { ConflictError, UnauthorizedError } from '../../common/errors/index.js';

export class AuthService {
  static async hashPassword(password) {
    return hashPassword(password);
  }

  static async verifyPassword(hash, plain) {
    return verifyPassword(hash, plain);
  }

  static async generateToken(payload) {
    return signAccessToken(payload);
  }

  static async verifyToken(token) {
    return verifyAccessToken(token);
  }

  static async signup(input) {
    const existing = await AuthRepository.findByEmail(input.email);

    if (existing) {
      throw new ConflictError('A user with this email already exists', 'USER_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await AuthRepository.create({
      email: input.email,
      passwordHash,
      role: input.role || 'USER'
    });

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      user,
      accessToken
    };
  }

  static async login(input) {
    const user = await AuthRepository.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const validPassword = await verifyPassword(user.passwordHash, input.password);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      },
      accessToken
    };
  }
}
