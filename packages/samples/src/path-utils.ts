function normalizeSeparators(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function trimTrailingSeparators(filePath: string): string {
  const normalizedPath = normalizeSeparators(filePath);
  if (normalizedPath === '/') {
    return normalizedPath;
  }

  return normalizedPath.replace(/\/+$/g, '');
}

export function splitPathSegments(filePath: string): string[] {
  return trimTrailingSeparators(filePath)
    .split('/')
    .filter((segment) => segment.length > 0);
}

export function dirname(filePath: string): string {
  const normalizedPath = trimTrailingSeparators(filePath);
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/');
  if (lastSeparatorIndex === -1) {
    return '.';
  }
  if (lastSeparatorIndex === 0) {
    return '/';
  }
  return normalizedPath.slice(0, lastSeparatorIndex);
}

export function basename(filePath: string): string {
  const normalizedPath = trimTrailingSeparators(filePath);
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/');
  return lastSeparatorIndex === -1 ? normalizedPath : normalizedPath.slice(lastSeparatorIndex + 1);
}

export function joinPath(...segments: string[]): string {
  const normalizedSegments = segments
    .map((segment) => normalizeSeparators(segment))
    .filter((segment) => segment.length > 0);
  if (normalizedSegments.length === 0) {
    return '';
  }

  const firstSegment = normalizedSegments[0]!;
  const restSegments = normalizedSegments.slice(1);
  const joined = [
    firstSegment.replace(/\/+$/g, ''),
    ...restSegments.map((segment) => segment.replace(/^\/+/g, '').replace(/\/+$/g, '')),
  ]
    .filter((segment) => segment.length > 0)
    .join('/');

  return joined || (firstSegment.startsWith('/') ? '/' : '.');
}

export function relativePath(fromPath: string, toPath: string): string {
  const fromSegments = splitPathSegments(fromPath);
  const toSegments = splitPathSegments(toPath);

  let sharedSegmentCount = 0;
  while (
    sharedSegmentCount < fromSegments.length &&
    sharedSegmentCount < toSegments.length &&
    fromSegments[sharedSegmentCount] === toSegments[sharedSegmentCount]
  ) {
    sharedSegmentCount += 1;
  }

  const parentSegments = Array.from({ length: fromSegments.length - sharedSegmentCount }, () => '..');
  return [...parentSegments, ...toSegments.slice(sharedSegmentCount)].join('/');
}
