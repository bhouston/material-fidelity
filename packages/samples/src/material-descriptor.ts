import type { MaterialDescriptor } from './types.js';
import { basename, dirname, relativePath, splitPathSegments } from './path-utils.js';

export function toMaterialDescriptor(materialFilePath: string, materialsRoot: string): MaterialDescriptor {
  const materialDirectory = dirname(materialFilePath);
  const relativeDirectory = relativePath(materialsRoot, materialDirectory);
  const segments = splitPathSegments(relativeDirectory);
  const name = segments.at(-1) ?? basename(materialDirectory);
  const displayPath = segments.join(' / ');
  let type = segments.at(0) ?? 'unknown';
  let apiType = type;
  const apiName = name;

  if (segments[0] === 'nodes' && segments.length >= 2) {
    type = 'nodes';
    apiType = 'nodes';
  } else if (segments[0] === 'showcase' && segments.length >= 3) {
    type = 'showcase';
    apiType = `showcase:${segments[1]}`;
  } else if (segments[0] === 'surfaces' && segments.length >= 3) {
    type = segments[1] ?? 'unknown';
    apiType = type;
  }

  return {
    type,
    apiType,
    apiName,
    name,
    absoluteDirectory: materialDirectory,
    relativeDirectory,
    displayPath,
  };
}
