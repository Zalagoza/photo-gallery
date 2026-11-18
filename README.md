# Photo Library

Public gallery (6 x 4 grid, preview + download, pagination) with an admin area for uploading photos and seeing who downloaded what.

## Run it on your computer
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (see below)
3. `npm run dev` and open http://localhost:3000 (admin: http://localhost:3000/admin)

## Set-up
1. **Neon**: create a project, copy the connection string into `DATABASE_URL`. Tables are created automatically on first use.
2. **Vercel**: import this project, then in the project's **Storage** tab create a **Blob** store. That adds `BLOB_READ_WRITE_TOKEN` for you. (Neon stores only the database; the photo files live in Blob.)
3. In Vercel **Settings > Environment Variables** add `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`. Redeploy.
4. **Namecheap domain**: in Vercel **Settings > Domains** add your domain, then in Namecheap **Advanced DNS** add the records Vercel shows
   (usually `A @ 76.76.21.21` and `CNAME www cname.vercel-dns.com`). Namecheap shared hosting cannot run this app, so Namecheap only provides the domain.
5. Local development with Blob: run `vercel env pull .env.local` to fetch the Blob token.
