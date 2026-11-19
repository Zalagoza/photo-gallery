import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { isAdmin } from '@/lib/auth';

// Issues a short-lived token so the admin's browser can upload straight to Vercel Blob
// (this avoids Vercel's 4.5 MB request limit on serverless functions).
export async function POST(request) {
  const body = await request.json();
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isAdmin())) throw new Error('Not signed in as admin');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          maximumSizeInBytes: 60 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
