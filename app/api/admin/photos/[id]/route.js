import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function DELETE(_req, { params }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = parseInt(params.id, 10);
  const [photo] = await sql`SELECT url, thumb_url FROM photos WHERE id = ${id}`;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await del([photo.url, photo.thumb_url]).catch(() => {});
  await sql`DELETE FROM photos WHERE id = ${id}`; // download history is kept (photo_id becomes null)
  return NextResponse.json({ ok: true });
}
