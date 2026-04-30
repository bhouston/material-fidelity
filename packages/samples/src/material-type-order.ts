/** Viewer material group ordering. */
export const MATERIAL_TYPE_ORDER = ['showcase', 'nodes', 'open_pbr_surface', 'gltf_pbr', 'standard_surface'] as const;

export function sortMaterialTypes(left: string, right: string): number {
  const leftIndex = MATERIAL_TYPE_ORDER.indexOf(left as (typeof MATERIAL_TYPE_ORDER)[number]);
  const rightIndex = MATERIAL_TYPE_ORDER.indexOf(right as (typeof MATERIAL_TYPE_ORDER)[number]);

  if (leftIndex === -1 && rightIndex === -1) {
    return left.localeCompare(right);
  }

  if (leftIndex === -1) {
    return 1;
  }

  if (rightIndex === -1) {
    return -1;
  }

  return leftIndex - rightIndex;
}
