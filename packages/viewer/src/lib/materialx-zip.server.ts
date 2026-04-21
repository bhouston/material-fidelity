import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { resolveMaterialDirectory, resolveViewerRoots } from '#/lib/material-index'

const MATERIAL_FILENAME = 'material.mtlx'
const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.exr',
  '.gif',
  '.hdr',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.tif',
  '.tiff',
  '.webp',
])

export interface MaterialXZipPayload {
  zip: Uint8Array
  sampleDirectory: string
}

function normalizePathToPosix(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

function isImagePath(value: string): boolean {
  const ext = path.extname(value).toLowerCase()
  return IMAGE_EXTENSIONS.has(ext)
}

function extractReferencedImagePaths(materialXml: string): string[] {
  const quotedValueRegex = /["']([^"']+)["']/g
  const referenced = new Set<string>()

  for (const match of materialXml.matchAll(quotedValueRegex)) {
    const rawValue = match[1]?.trim()
    if (!rawValue || rawValue.startsWith('http://') || rawValue.startsWith('https://') || rawValue.startsWith('data:')) {
      continue
    }

    const pathWithoutQuery = rawValue.split('#')[0]?.split('?')[0] ?? rawValue
    if (!isImagePath(pathWithoutQuery)) {
      continue
    }

    referenced.add(pathWithoutQuery)
  }

  return [...referenced]
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function resolveAssetPath(
  materialDirectory: string,
  materialsRoot: string,
  referencedPath: string,
): { absolutePath: string; relativeZipPath: string } | undefined {
  if (referencedPath.includes('\0')) {
    return undefined
  }

  const absolutePath = path.resolve(materialDirectory, referencedPath)
  const materialsRootPrefix = `${path.resolve(materialsRoot)}${path.sep}`
  const normalizedAbsolutePath = path.resolve(absolutePath)
  if (!normalizedAbsolutePath.startsWith(materialsRootPrefix)) {
    return undefined
  }

  const relativeZipPath = normalizePathToPosix(path.relative(materialDirectory, normalizedAbsolutePath))
  if (!relativeZipPath || relativeZipPath.startsWith('../') || relativeZipPath === '..') {
    return undefined
  }

  return {
    absolutePath: normalizedAbsolutePath,
    relativeZipPath,
  }
}

export async function createMaterialXZipPayloadByTypeAndName(
  materialType: string,
  materialName: string,
): Promise<MaterialXZipPayload | undefined> {
  const roots = resolveViewerRoots()
  const materialDirectory = await resolveMaterialDirectory(materialType, materialName)
  if (!materialDirectory) {
    return undefined
  }

  const materialPath = path.join(materialDirectory, MATERIAL_FILENAME)
  const materialXml = await readFile(materialPath, 'utf8')
  const referencedImagePaths = extractReferencedImagePaths(materialXml)
  const zip = new JSZip()

  zip.file(MATERIAL_FILENAME, materialXml)

  for (const referencedPath of referencedImagePaths) {
    const resolved = resolveAssetPath(materialDirectory, roots.materialsRoot, referencedPath)
    if (!resolved) {
      continue
    }
    if (!(await fileExists(resolved.absolutePath))) {
      continue
    }

    const assetBytes = await readFile(resolved.absolutePath)
    zip.file(resolved.relativeZipPath, assetBytes)
  }

  const payload = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })

  return {
    zip: payload,
    sampleDirectory: `${materialType}/${materialName}`,
  }
}
