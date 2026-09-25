import { AuthService } from '../modules/auth/auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../common/errors/index.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Authentication token is required', 'UNAUTHORIZED'));
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return next(new UnauthorizedError('Authentication token is required', 'UNAUTHORIZED'));
    }

    const payload = await AuthService.verifyToken(token);
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role || 'USER'
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication token is required', 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          'You do not have permission to perform this action',
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
