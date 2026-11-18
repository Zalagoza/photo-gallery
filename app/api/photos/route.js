import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';
const PER_PAGE = 24; // 6 columns x 4 rows

export async function GET(request) {
  try {
    await ensureSchema();
    const page = Math.max(1, parseInt(new URL(request.url).searchParams.get('page') || '1', 10) || 1);
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM photos`;
    const photos = await sql`
      SELECT id, title, filename, url, thumb_url, size
      FROM photos ORDER BY created_at DESC, id DESC
      LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`;
    return NextResponse.json({ photos, page, perPage: PER_PAGE, total: count, pages: Math.max(1, Math.ceil(count / PER_PAGE)) });
  } catch (error) {
    console.error('[Photo gallery] Could not list photos:', error);
    return NextResponse.json({ error: 'The photo library could not be loaded. Check that DATABASE_URL is configured and the database is reachable.' }, { status: 503 });
  }
}
