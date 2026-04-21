import { access, readdir } from 'node:fs/promises'
import path from 'node:path'

const MATERIAL_SOURCE_BASE_URL = 'https://github.com/bhouston/materialX-samples/blob/main/materials'
const MATERIAL_TYPE_ORDER = ['open_pbr_surface', 'gltf_pbr', 'standard_surface'] as const

interface MaterialDescriptor {
  type: string
  name: string
  absoluteDirectory: string
  relativeDirectory: string
  sourceUrl: string
}

export interface MaterialViewModel {
  type: string
  name: string
  sourceUrl: string
  images: Record<string, string | null>
}

export interface MaterialTypeGroupViewModel {
  type: string
  materials: MaterialViewModel[]
}

export interface ViewerIndexViewModel {
  adapters: string[]
  groups: MaterialTypeGroupViewModel[]
  errors: string[]
  resolvedThirdPartyRoot: string
  resolvedAdaptersRoot: string
}

export interface ViewerRoots {
  repoRoot: string
  thirdPartyRoot: string
  adaptersRoot: string
  materialsRoot: string
}

function toGithubSourceUrl(relativeDirectory: string): string {
  return `${MATERIAL_SOURCE_BASE_URL}/${relativeDirectory.replaceAll(path.sep, '/')}/material.mtlx`
}

function inferRepoRoot(invocationCwd: string): string {
  if (
    path.basename(invocationCwd) === 'viewer' &&
    path.basename(path.dirname(invocationCwd)) === 'packages'
  ) {
    return path.dirname(path.dirname(invocationCwd))
  }

  return invocationCwd
}

export function resolveViewerRoots(): ViewerRoots {
  const invocationCwd = process.env.INIT_CWD ?? process.cwd()
  const repoRoot = inferRepoRoot(invocationCwd)
  const thirdPartyRoot = path.resolve(repoRoot, process.env.THIRD_PARTY_ROOT ?? '../')
  const adaptersRoot = path.resolve(repoRoot, process.env.ADAPTERS_ROOT ?? './adapters')
  const materialsRoot = path.join(thirdPartyRoot, 'materialX-samples', 'materials')

  return {
    repoRoot,
    thirdPartyRoot,
    adaptersRoot,
    materialsRoot,
  }
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    await access(directoryPath)
    return true
  } catch {
    return false
  }
}

async function discoverMaterialFiles(rootDir: string): Promise<string[]> {
  const materialFiles: string[] = []
  const entries = await readdir(rootDir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      materialFiles.push(...(await discoverMaterialFiles(entryPath)))
      continue
    }

    if (entry.isFile() && entry.name === 'material.mtlx') {
      materialFiles.push(entryPath)
    }
  }

  return materialFiles
}

async function discoverAdapters(adaptersRoot: string): Promise<string[]> {
  const entries = await readdir(adaptersRoot, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b))
}

function sortMaterialTypes(left: string, right: string): number {
  const leftIndex = MATERIAL_TYPE_ORDER.indexOf(left as (typeof MATERIAL_TYPE_ORDER)[number])
  const rightIndex = MATERIAL_TYPE_ORDER.indexOf(right as (typeof MATERIAL_TYPE_ORDER)[number])

  if (leftIndex === -1 && rightIndex === -1) {
    return left.localeCompare(right)
  }

  if (leftIndex === -1) {
    return 1
  }

  if (rightIndex === -1) {
    return -1
  }

  return leftIndex - rightIndex
}

function toMaterialDescriptor(materialFilePath: string, materialsRoot: string): MaterialDescriptor {
  const materialDirectory = path.dirname(materialFilePath)
  const relativeDirectory = path.relative(materialsRoot, materialDirectory)
  const segments = relativeDirectory.split(path.sep).filter(Boolean)
  const type = segments.at(0) ?? 'unknown'
  const name = segments.at(-1) ?? path.basename(materialDirectory)

  return {
    type,
    name,
    absoluteDirectory: materialDirectory,
    relativeDirectory,
    sourceUrl: toGithubSourceUrl(relativeDirectory),
  }
}

export async function getViewerIndexData(): Promise<ViewerIndexViewModel> {
  const roots = resolveViewerRoots()
  const errors: string[] = []

  const hasMaterialsRoot = await directoryExists(roots.materialsRoot)
  if (!hasMaterialsRoot) {
    errors.push(`Materials directory not found: ${roots.materialsRoot}`)
    return {
      adapters: [],
      groups: [],
      errors,
      resolvedThirdPartyRoot: roots.thirdPartyRoot,
      resolvedAdaptersRoot: roots.adaptersRoot,
    }
  }

  const hasAdaptersRoot = await directoryExists(roots.adaptersRoot)
  if (!hasAdaptersRoot) {
    errors.push(`Adapters directory not found: ${roots.adaptersRoot}`)
    return {
      adapters: [],
      groups: [],
      errors,
      resolvedThirdPartyRoot: roots.thirdPartyRoot,
      resolvedAdaptersRoot: roots.adaptersRoot,
    }
  }

  const [adapters, materialFiles] = await Promise.all([
    discoverAdapters(roots.adaptersRoot),
    discoverMaterialFiles(roots.materialsRoot),
  ])

  if (adapters.length === 0) {
    errors.push(`No adapter directories found under: ${roots.adaptersRoot}`)
  }

  if (materialFiles.length === 0) {
    errors.push(`No material.mtlx files found under: ${roots.materialsRoot}`)
  }

  const grouped = new Map<string, MaterialViewModel[]>()

  for (const materialFilePath of materialFiles) {
    const descriptor = toMaterialDescriptor(materialFilePath, roots.materialsRoot)
    const images = Object.fromEntries(
      await Promise.all(
        adapters.map(async (adapterName) => {
          const referencePath = path.join(descriptor.absoluteDirectory, `${adapterName}.png`)
          const exists = await directoryExists(referencePath)
          const imageUrl = exists
            ? `/api/reference-image/${encodeURIComponent(descriptor.type)}/${encodeURIComponent(descriptor.name)}/${encodeURIComponent(adapterName)}`
            : null
          return [adapterName, imageUrl] as const
        }),
      ),
    )

    const material: MaterialViewModel = {
      type: descriptor.type,
      name: descriptor.name,
      sourceUrl: descriptor.sourceUrl,
      images,
    }
    const group = grouped.get(descriptor.type) ?? []
    group.push(material)
    grouped.set(descriptor.type, group)
  }

  const groups: MaterialTypeGroupViewModel[] = [...grouped.entries()]
    .toSorted(([leftType], [rightType]) => sortMaterialTypes(leftType, rightType))
    .map(([type, materials]) => ({
      type,
      materials: materials.toSorted((left, right) => left.name.localeCompare(right.name)),
    }))

  return {
    adapters,
    groups,
    errors,
    resolvedThirdPartyRoot: roots.thirdPartyRoot,
    resolvedAdaptersRoot: roots.adaptersRoot,
  }
}

export async function resolveReferenceImagePath(
  materialType: string,
  materialName: string,
  adapterName: string,
): Promise<string | undefined> {
  const roots = resolveViewerRoots()
  const targetPath = path.resolve(
    roots.materialsRoot,
    materialType,
    materialName,
    `${adapterName}.png`,
  )
  const materialsRootPrefix = `${path.resolve(roots.materialsRoot)}${path.sep}`

  if (!targetPath.startsWith(materialsRootPrefix)) {
    return undefined
  }

  if (!(await directoryExists(targetPath))) {
    return undefined
  }

  return targetPath
}
