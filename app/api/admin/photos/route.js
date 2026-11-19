import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { sql, ensureSchema } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

// Called after both files (full size + thumbnail) are uploaded to Blob.
export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized. Sign in as admin and try again.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid photo details. Please retry the upload.' }, { status: 400 });
  }

  const { title, filename, url, thumbUrl, size } = body || {};
  if (!filename || !url || !thumbUrl) {
    return NextResponse.json({ error: 'Photo details are incomplete; filename, image URL, and thumbnail URL are required.' }, { status: 400 });
  }

  try {
    await ensureSchema();
    const [row] = await sql`
      INSERT INTO photos (title, filename, url, thumb_url, size)
      VALUES (${String(title || filename).slice(0, 500)}, ${String(filename).slice(0, 500)}, ${String(url), String(thumbUrl), Number.isFinite(Number(size)) && Number(size) > 0 ? Math.round(Number(size)) : null})
      RETURNING id`;
    return NextResponse.json({ id: row.id });
  } catch (error) {
    console.error('[Admin photo save] Failed to save photo record:', error);
    await del([url, thumbUrl]).catch((cleanupError) => {
      console.error('[Admin photo save] Could not clean up uploaded Blob files:', cleanupError);
    });
    return NextResponse.json({
      error: 'The image upload completed, but the photo record could not be saved. Check that DATABASE_URL is configured and the database is reachable, then retry.',
    }, { status: 503 });
  }
}
