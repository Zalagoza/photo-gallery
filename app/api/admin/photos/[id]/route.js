import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { sql, ensureSchema } from '@/lib/db';
import { isAdmin } from '@/lib/auth';

export async function DELETE(_request, { params }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Your admin session has expired. Sign in again and retry.' }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'The photo ID is invalid.' }, { status: 400 });
  }

  let photo;
  try {
    await ensureSchema();
    const rows = await sql`SELECT id, url, thumb_url FROM photos WHERE id = ${id}`;
    photo = rows[0];
    if (!photo) return NextResponse.json({ error: 'This photo was not found. Refresh the list and try again.' }, { status: 404 });
    await sql`DELETE FROM photos WHERE id = ${id}`; // download history is kept (photo_id becomes null)
  } catch (error) {
    console.error(`[Admin photo delete] Could not remove photo ${id} from the database:`, error);
    return NextResponse.json({ error: 'The photo could not be removed from the database. Check the database connection and try again.' }, { status: 503 });
  }

  let storageDeleted = true;
  try {
    const urls = [...new Set([photo.url, photo.thumb_url].filter(Boolean))];
    if (urls.length) await del(urls);
  } catch (error) {
    storageDeleted = false;
    console.error(`[Admin photo delete] Photo ${id} was removed from the library, but its Blob files could not be deleted:`, error);
  }

  return NextResponse.json({ ok: true, storageDeleted });
}
