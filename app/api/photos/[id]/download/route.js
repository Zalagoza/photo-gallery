import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Logs the download, then hands back the file URL. The browser fetches the file itself (so it can show progress).
export async function POST(request, { params }) {
  await ensureSchema();
  const id = parseInt(params.id, 10);
  const [photo] = await sql`SELECT id, title, filename, url FROM photos WHERE id = ${id}`;
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  let name = '';
  try { name = String((await request.json()).name || '').trim().slice(0, 80); } catch {}

  const h = request.headers;
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  const city = h.get('x-vercel-ip-city');
  await sql`INSERT INTO downloads (photo_id, photo_title, downloader_name, ip, country, city, user_agent)
    VALUES (${photo.id}, ${photo.title || photo.filename}, ${name || null}, ${ip}, ${h.get('x-vercel-ip-country')},
            ${city ? decodeURIComponent(city) : null}, ${(h.get('user-agent') || '').slice(0, 300)})`;

  return NextResponse.json({ url: photo.url, filename: photo.filename });
}
