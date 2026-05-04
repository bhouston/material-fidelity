import { createHash } from 'node:crypto';

export function contentHashFromBytes(bytes: Buffer): string {
  return createHash('md5').update(bytes).digest('hex');
}

function strongEtagFromContentHash(contentHash: string): string {
  return `"${contentHash}"`;
}

function ifNoneMatchIncludesStrongEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch?.trim()) return false;
  const trimmed = ifNoneMatch.trim();
  if (trimmed === '*') return true;
  const canonical = etag.startsWith('W/') ? etag.slice(2) : etag;
  for (const raw of trimmed.split(',')) {
    const token = raw.trim();
    const tokenCanonical = token.startsWith('W/') ? token.slice(2) : token;
    if (tokenCanonical === canonical) return true;
  }
  return false;
}

function cacheControlForReferenceAsset(options: ReferenceAssetResponseOptions): string {
  if (options.noStore || process.env.NODE_ENV !== 'production') {
    return 'no-store';
  }

  if (process.env.NODE_ENV === 'production' && options.immutable) {
    return 'public, max-age=31536000, immutable';
  }

  return 'max-age=3600, edge max-age=3600';
}

export interface ReferenceAssetResponseOptions {
  contentHash?: string;
  immutable?: boolean;
  noStore?: boolean;
}

/** GET response for reference images/reports: MD5 strong ETag and 304 when If-None-Match matches. */
export function referenceAssetGetResponse(
  request: Request,
  bytes: Buffer,
  contentType: string,
  options: ReferenceAssetResponseOptions = {},
): Response {
  const contentHash = options.contentHash ?? contentHashFromBytes(bytes);
  const etag = strongEtagFromContentHash(contentHash);
  const cacheControl = cacheControlForReferenceAsset(options);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatchIncludesStrongEtag(ifNoneMatch, etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': cacheControl,
      },
    });
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': bytes.length.toString(),
      'Cache-Control': cacheControl,
      ETag: etag,
    },
  });
}
