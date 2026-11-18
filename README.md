# KIA Mens Welfare Memoirs

Public gallery with responsive mobile layouts, optimized thumbnails, multi-photo ZIP downloads, preview + individual download, and pagination; includes an admin area for uploading photos and seeing who downloaded what.

## Run it on your computer
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (see below)
3. `npm run dev` and open http://localhost:3000 (admin: http://localhost:3000/admin)

## Set-up
1. **Neon**: create a project, copy the connection string into `DATABASE_URL`. Tables are created automatically on first use.
2. **Vercel Blob**: in the project's **Storage** tab create and connect a **Blob** store. Confirm `BLOB_READ_WRITE_TOKEN` is present in the project's environment variables for the deployment environment. (Neon stores only the database; the photo files live in Blob.)
3. In Vercel **Settings > Environment Variables** confirm `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` are present for Production (and Preview if used). Redeploy after changing any value.
4. **Namecheap domain**: in Vercel **Settings > Domains** add your domain, then in Namecheap **Advanced DNS** add the records Vercel shows
   (usually `A @ 76.76.21.21` and `CNAME www cname.vercel-dns.com`). Namecheap shared hosting cannot run this app, so Namecheap only provides the domain.
5. Local development with Blob: run `vercel env pull .env.local` to fetch the Blob token. Admin uploads support JPEG, PNG, WebP, and GIF. If an upload fails, the admin upload list now displays the reason; database save failures indicate that the image itself uploaded but its photo record could not be stored.

## Gallery features
- Gallery thumbnails are delivered through Next.js responsive image optimization; new uploads create smaller 360 px thumbnails.
- Visitors can select up to 24 photos and download them together as a streamed ZIP archive. This keeps archive creation off the visitor's device.
- The support link opens WhatsApp with a pre-filled message for Kingsley Phiri.
