import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Server-side password policy for register / staff create. */
export function assertPasswordPolicy(password: string): string | null {
  if (!password || typeof password !== 'string') return 'Пароль обязателен';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
  }
  if (!/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
    return 'Пароль должен содержать буквы и цифры';
  }
  return null;
}

export { MIN_PASSWORD_LENGTH };

