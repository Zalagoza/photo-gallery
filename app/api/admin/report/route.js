import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const PER_PAGE = 50;

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function GET(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSchema();
  const sp = new URL(request.url).searchParams;

  if (sp.get('format') === 'csv') {
    const rows = await sql`SELECT * FROM downloads ORDER BY downloaded_at DESC`;
    const lines = [['Date', 'Photo', 'Name', 'IP', 'Country', 'City', 'Device'].join(',')];
    for (const r of rows) {
      lines.push([r.downloaded_at.toISOString?.() ?? r.downloaded_at, r.photo_title, r.downloader_name, r.ip, r.country, r.city, r.user_agent].map(csvCell).join(','));
    }
    return new NextResponse(lines.join('\n'), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="downloads.csv"' },
    });
  }

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const [stats] = await sql`SELECT COUNT(*)::int AS total, COUNT(DISTINCT ip)::int AS visitors, COUNT(DISTINCT photo_id)::int AS photos FROM downloads`;
  const rows = await sql`SELECT id, photo_title, downloader_name, ip, country, city, user_agent, downloaded_at
    FROM downloads ORDER BY downloaded_at DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`;
  return NextResponse.json({ stats, rows, page, pages: Math.max(1, Math.ceil(stats.total / PER_PAGE)) });
}
