import { createFileRoute } from '@tanstack/react-router';
import { createMaterialXZipPayloadByTypeAndName } from '#/lib/materialx-zip.server';

const ZIP_SUFFIX = '.mtlx.zip';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, Content-Type',
};

function parseAssetPath(splat: string | undefined): { materialType: string; materialName: string } | undefined {
  const raw = splat?.trim();
  if (!raw || raw.includes('\\') || raw.includes('..') || !raw.endsWith(ZIP_SUFFIX)) {
    return undefined;
  }

  const pathWithoutSuffix = raw.slice(0, -ZIP_SUFFIX.length);
  const [materialType, materialName, ...rest] = pathWithoutSuffix.split('/').filter(Boolean);
  if (!materialType || !materialName || rest.length > 0) {
    return undefined;
  }

  return { materialType, materialName };
}

export const Route = createFileRoute('/api/asset/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = parseAssetPath(params._splat);
        if (!parsed) {
          return new Response('Invalid asset path, expected <materialType>/<materialName>.mtlx.zip', {
            status: 400,
            headers: CORS_HEADERS,
          });
        }

        const payload = await createMaterialXZipPayloadByTypeAndName(parsed.materialType, parsed.materialName);
        if (!payload) {
          return new Response(`Unknown material sample: ${parsed.materialType}/${parsed.materialName}`, {
            status: 404,
            headers: CORS_HEADERS,
          });
        }

        return new Response(payload.zip, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/zip',
            'Content-Disposition': `inline; filename="${payload.sampleDirectory.replaceAll('/', '-')}.mtlx.zip"`,
            'Cache-Control': 'public, max-age=300',
          },
        });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        }),
    },
  },
});
