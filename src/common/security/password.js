import * as argon2 from 'argon2';

export async function hashPassword(password) {
  return argon2.hash(password);
}

export async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch (error) {
    if (error && error.message && error.message.includes('argon2')) {
      throw error;
    }
    return false;
  }
}
