import { AuthService } from '../modules/auth/auth.service.js';
import { UnauthorizedError } from '../common/errors/index.js';

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
      email: payload.email
    };
    next();
  } catch (err) {
    next(err);
  }
}
