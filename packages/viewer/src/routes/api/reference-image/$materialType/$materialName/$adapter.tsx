import { createFileRoute } from '@tanstack/react-router'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveReferenceImagePath } from '#/lib/material-index'

export const Route = createFileRoute(
  '/api/reference-image/$materialType/$materialName/$adapter',
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const filePath = await resolveReferenceImagePath(
          params.materialType,
          params.materialName,
          params.adapter,
        )
        if (!filePath) {
          return new Response('Not found', { status: 404 })
        }

        const bytes = await readFile(filePath)
        const contentType = path.extname(filePath).toLowerCase() === '.webp' ? 'image/webp' : 'image/png'
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=300',
          },
        })
      },
    },
  },
})
