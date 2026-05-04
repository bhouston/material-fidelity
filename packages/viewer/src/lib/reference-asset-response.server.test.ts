import { afterEach, describe, expect, it } from 'vitest';
import { contentHashFromBytes, referenceAssetGetResponse } from './reference-asset-response.server.ts';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }

  process.env.NODE_ENV = originalNodeEnv;
});

describe('referenceAssetGetResponse', () => {
  it('uses immutable cache-control for opted-in production assets', () => {
    process.env.NODE_ENV = 'production';

    const response = referenceAssetGetResponse(new Request('https://example.com/image.png'), Buffer.from('image'), 'image/png', {
      immutable: true,
    });

    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('keeps the short production cache-control without immutable opt-in', () => {
    process.env.NODE_ENV = 'production';

    const response = referenceAssetGetResponse(
      new Request('https://example.com/image.png'),
      Buffer.from('image'),
      'image/png',
    );

    expect(response.headers.get('cache-control')).toBe('max-age=3600, edge max-age=3600');
  });

  it('uses no-store cache-control outside production', () => {
    process.env.NODE_ENV = 'development';

    const response = referenceAssetGetResponse(
      new Request('https://example.com/image.png'),
      Buffer.from('image'),
      'image/png',
    );

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('uses no-store cache-control when requested in production', () => {
    process.env.NODE_ENV = 'production';

    const response = referenceAssetGetResponse(
      new Request('https://example.com/image.png'),
      Buffer.from('image'),
      'image/png',
      { noStore: true },
    );

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('preserves etag 304 responses with immutable cache-control', () => {
    process.env.NODE_ENV = 'production';
    const bytes = Buffer.from('image');
    const etag = `"${contentHashFromBytes(bytes)}"`;

    const response = referenceAssetGetResponse(
      new Request('https://example.com/image.png', {
        headers: { 'if-none-match': etag },
      }),
      bytes,
      'image/png',
      { immutable: true },
    );

    expect(response.status).toBe(304);
    expect(response.headers.get('etag')).toBe(etag);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});
