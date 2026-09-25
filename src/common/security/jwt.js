import * as jose from 'jose';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export async function signAccessToken(payload) {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secretKey);
}

export async function verifyAccessToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey);
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role || 'USER'
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired authentication token', 'UNAUTHORIZED');
  }
}
