import archiver from 'archiver';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 24;
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;

function safeFilename(filename) {
  const base = String(filename || 'photo').replaceAll('\\', '/').split('/').pop();
  return (base || 'photo').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 160) || 'photo';
}

export async function GET(request) {
  const rawIds = new URL(request.url).searchParams.get('ids') || '';
  if (!/^\d+(,\d+)*$/.test(rawIds)) {
    return NextResponse.json({ error: 'Select one or more photos before downloading.' }, { status: 400 });
  }

  const ids = [...new Set(rawIds.split(',').map(Number))];
  if (!ids.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    return NextResponse.json({ error: 'The photo selection is invalid.' }, { status: 400 });
  }
  if (ids.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `A ZIP can contain up to ${MAX_PHOTOS} photos at a time.` }, { status: 400 });
  }

  let photos;
  try {
    await ensureSchema();
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    photos = await sql(
      `SELECT id, filename, url, size FROM photos WHERE id IN (${placeholders}) ORDER BY created_at DESC, id DESC`,
      ids,
    );
  } catch (error) {
    console.error('[Photo archive] Could not load selected photos:', error);
    return NextResponse.json({ error: 'The photo library could not be reached. Please try again later.' }, { status: 503 });
  }

  if (photos.length !== ids.length) {
    return NextResponse.json({ error: 'One or more selected photos are no longer available. Refresh the gallery and try again.' }, { status: 404 });
  }

  const estimatedBytes = photos.reduce((total, photo) => total + (Number(photo.size) || 0), 0);
  if (estimatedBytes > MAX_ARCHIVE_BYTES) {
    return NextResponse.json({ error: 'This selection is too large for one ZIP. Select fewer photos and try again.' }, { status: 413 });
  }
  if (photos.some((photo) => {
    try { return new URL(photo.url).protocol !== 'https:'; } catch { return true; }
  })) {
    return NextResponse.json({ error: 'A selected photo has an invalid image address.' }, { status: 400 });
  }

  const archive = archiver('zip', { zlib: { level: 1 } });
  const body = new ReadableStream({
    start(controller) {
      archive.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
      archive.on('end', () => controller.close());
      archive.on('error', (error) => {
        console.error('[Photo archive] ZIP stream failed:', error);
        controller.error(error);
      });

      void (async () => {
        for (const photo of photos) {
          const response = await fetch(photo.url);
          if (!response.ok || !response.body) {
            throw new Error(`Could not retrieve image ${photo.id} from storage (${response.status}).`);
          }

          const entryName = `${photo.id}-${safeFilename(photo.filename)}`;
          await new Promise((resolve, reject) => {
            const onEntry = (entry) => {
              if (entry.name === entryName) {
                archive.off('error', onError);
                resolve();
              }
            };
            const onError = (error) => {
              archive.off('entry', onEntry);
              reject(error);
            };
            archive.on('entry', onEntry);
            archive.once('error', onError);
            archive.append(Readable.fromWeb(response.body), { name: entryName });
          });
        }
        await archive.finalize();
      })().catch((error) => archive.destroy(error));
    },
    cancel() {
      archive.destroy();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="kia-mens-welfare-memoirs.zip"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
