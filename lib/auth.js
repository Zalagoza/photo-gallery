import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const NAME = 'admin_session';
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || '');

export async function createSession() {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(key());
  cookies().set(NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function destroySession() {
  cookies().delete(NAME);
}

export async function isAdmin() {
  const token = cookies().get(NAME)?.value;
  if (!token || !process.env.SESSION_SECRET) return false;
  try { await jwtVerify(token, key()); return true; } catch { return false; }
}
