import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

// Called after both files (full size + thumbnail) are uploaded to Blob.
export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const { title, filename, url, thumbUrl, size } = await request.json();
  if (!url || !thumbUrl || !filename) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const [row] = await sql`INSERT INTO photos (title, filename, url, thumb_url, size)
    VALUES (${title || filename}, ${filename}, ${url}, ${thumbUrl}, ${size || null}) RETURNING id`;
  return NextResponse.json({ id: row.id });
}
