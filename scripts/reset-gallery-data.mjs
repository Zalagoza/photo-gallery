import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { del } from '@vercel/blob';

async function loadLocalEnv() {
  try {
    const contents = await readFile('.env.local', 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, '').trim();
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await loadLocalEnv();

const dryRun = process.argv.includes('--dry-run');
const execute = process.argv.includes('--execute');
const approved = process.env.CONFIRM_GALLERY_RESET === 'DELETE_ALL_GALLERY_DATA';

if (dryRun === execute) {
  console.error('Choose exactly one mode: --dry-run or --execute.');
  process.exit(2);
}
if (execute && !approved) {
  console.error('For execution, set CONFIRM_GALLERY_RESET=DELETE_ALL_GALLERY_DATA.');
  process.exit(2);
}
if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('DATABASE_URL and BLOB_READ_WRITE_TOKEN must both be set (for example in the project .env.local). No data was changed.');
  process.exit(2);
}

const sql = neon(process.env.DATABASE_URL);
const photos = await sql`SELECT id, url, thumb_url FROM photos`;
const [downloadCount] = await sql`SELECT COUNT(*)::int AS count FROM downloads`;
const blobUrls = [...new Set(photos.flatMap((photo) => [photo.url, photo.thumb_url]).filter(Boolean))];

console.log(`Photos: ${photos.length}`);
console.log(`Download-history rows: ${downloadCount.count}`);
console.log(`Unique Blob URLs: ${blobUrls.length}`);

if (dryRun) {
  console.log('Dry run only; nothing was deleted.');
  process.exit(0);
}

console.log('Deleting all photo records and download history, and resetting their ID sequences...');
await sql`TRUNCATE TABLE downloads, photos RESTART IDENTITY`;
console.log('Database rows cleared. Removing associated Blob files...');

const failures = [];
for (let i = 0; i < blobUrls.length; i += 100) {
  const batch = blobUrls.slice(i, i + 100);
  try {
    await del(batch);
  } catch {
    failures.push(batch.length);
  }
}

if (failures.length) {
  console.error(`Reset completed in the database, but Blob cleanup failed for ${failures.reduce((a, n) => a + n, 0)} URL(s) across ${failures.length} batch(es). Check BLOB_READ_WRITE_TOKEN and remove remaining objects from Vercel Blob storage.`);
  process.exitCode = 1;
} else {
  console.log(`Full reset complete. Deleted ${photos.length} photo record(s), ${downloadCount.count} download-history row(s), and ${blobUrls.length} Blob URL(s). Admin login and app configuration were not changed.`);
}
