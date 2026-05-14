/**
 * Vercel Blob utilities.
 *
 * Setup:
 *   1. Enable Blob in Vercel dashboard: Project → Storage → Blob → Create
 *   2. Copy BLOB_READ_WRITE_TOKEN to .env.local
 *   3. Use `node scripts/upload-assets.mjs` to batch-upload images
 *
 * Public blob URLs look like: https://<id>.public.blob.vercel-storage.com/path/file.webp
 */

import { put, del, list, head } from '@vercel/blob'

export interface BlobAsset {
  /** Public URL of the uploaded blob */
  url: string
  /** Relative path within the blob store */
  pathname: string
}

/**
 * Upload a single file to Vercel Blob.
 * Returns the public URL and pathname.
 */
export async function uploadBlob(
  pathname: string,
  body: Buffer | Blob | string,
  options?: { contentType?: string, cacheControlMaxAge?: number },
): Promise<BlobAsset> {
  const result = await put(pathname, body, {
    access: 'public',
    addRandomSuffix: false,
    contentType: options?.contentType,
    cacheControlMaxAge: options?.cacheControlMaxAge ?? 31536000, // 1 year
  })
  return { url: result.url, pathname: result.pathname }
}

/**
 * Delete a blob by pathname.
 */
export async function deleteBlob(pathname: string): Promise<void> {
  await del(pathname)
}

/**
 * List all blobs with an optional prefix.
 */
export async function listBlobs(prefix?: string) {
  return list({ prefix })
}

/**
 * Check if a blob exists.
 */
export async function blobExists(pathname: string): Promise<boolean> {
  try {
    await head(pathname)
    return true
  }
  catch {
    return false
  }
}
