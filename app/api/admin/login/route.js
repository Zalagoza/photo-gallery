import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';

export async function POST(request) {
  const { username, password } = await request.json().catch(() => ({}));
  await new Promise((r) => setTimeout(r, 400)); // slows down password guessing
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Server is missing ADMIN_PASSWORD or SESSION_SECRET.' }, { status: 500 });
  }
  if (username === (process.env.ADMIN_USERNAME || 'admin') && password === process.env.ADMIN_PASSWORD) {
    await createSession();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
}
