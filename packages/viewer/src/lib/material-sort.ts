import type { MaterialViewModel } from '#/lib/material-index';

export const DEFAULT_MATERIAL_SORT = 'default';

export const MATERIAL_SORT_OPTIONS = [
  { value: DEFAULT_MATERIAL_SORT, label: 'Default' },
  { value: 'name', label: 'Name' },
  { value: 'name-reversed', label: 'Name (Reversed)' },
  { value: 'psnr', label: 'PSNR' },
  { value: 'psnr-reversed', label: 'PSNR (Reversed)' },
] as const;

export type MaterialSortValue = (typeof MATERIAL_SORT_OPTIONS)[number]['value'];

const MATERIAL_SORT_VALUES = new Set<MaterialSortValue>(MATERIAL_SORT_OPTIONS.map((option) => option.value));

export function parseMaterialSort(value: string | undefined): MaterialSortValue {
  return value && MATERIAL_SORT_VALUES.has(value as MaterialSortValue)
    ? (value as MaterialSortValue)
    : DEFAULT_MATERIAL_SORT;
}

export function toMaterialSortSearchValue(value: MaterialSortValue): string | undefined {
  return value === DEFAULT_MATERIAL_SORT ? undefined : value;
}

export function getMaterialQuality(material: MaterialViewModel, selectedRenderers: string[]): number {
  if (selectedRenderers.length === 0) {
    return 0;
  }

  let lowestPsnr = Number.POSITIVE_INFINITY;

  for (const rendererName of selectedRenderers) {
    const psnr = material.metrics[rendererName]?.psnr;
    if (!material.images[rendererName] || psnr == null || !Number.isFinite(psnr)) {
      return 0;
    }

    lowestPsnr = Math.min(lowestPsnr, psnr);
  }

  return lowestPsnr;
}

function compareMaterialNames(left: MaterialViewModel, right: MaterialViewModel): number {
  return left.displayPath.localeCompare(right.displayPath, undefined, { numeric: true, sensitivity: 'base' });
}

function compareMaterialQuality(
  left: MaterialViewModel,
  right: MaterialViewModel,
  selectedRenderers: string[],
): number {
  const qualityDelta = getMaterialQuality(left, selectedRenderers) - getMaterialQuality(right, selectedRenderers);
  return qualityDelta === 0 ? compareMaterialNames(left, right) : qualityDelta;
}

export function sortMaterials(
  materials: MaterialViewModel[],
  sortValue: MaterialSortValue,
  selectedRenderers: string[],
): MaterialViewModel[] {
  switch (sortValue) {
    case 'name':
      return materials.toSorted(compareMaterialNames);
    case 'name-reversed':
      return materials.toSorted((left, right) => compareMaterialNames(right, left));
    case 'psnr':
      return materials.toSorted((left, right) => compareMaterialQuality(left, right, selectedRenderers));
    case 'psnr-reversed':
      return materials.toSorted((left, right) => compareMaterialQuality(right, left, selectedRenderers));
    case DEFAULT_MATERIAL_SORT:
      return materials;
  }
}
