import { neon } from '@neondatabase/serverless';

let client;

// Initialize lazily so Next.js can build without runtime-only database credentials.
export function sql(strings, ...values) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }
  if (!client) client = neon(process.env.DATABASE_URL);
  return client(strings, ...values);
}

let ready;
// Creates the tables the first time any API route runs.
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        title TEXT,
        filename TEXT NOT NULL,
        url TEXT NOT NULL,
        thumb_url TEXT NOT NULL,
        size BIGINT,
        created_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS downloads (
        id SERIAL PRIMARY KEY,
        photo_id INTEGER REFERENCES photos(id) ON DELETE SET NULL,
        photo_title TEXT,
        downloader_name TEXT,
        ip TEXT,
        country TEXT,
        city TEXT,
        user_agent TEXT,
        downloaded_at TIMESTAMPTZ DEFAULT now()
      )`;
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}
