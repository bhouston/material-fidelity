import type { RendererDescriptor } from './types.js';

/** Built-in renderer names and categories without importing renderer packages (for viewer index). */
export const BUILT_IN_RENDERER_DESCRIPTORS: RendererDescriptor[] = [
  {
    name: 'materialxview',
    category: 'raytracer',
    sortIndex: 10,
    description: 'Reference viewer from the MaterialX project',
    packageName: '@material-fidelity/renderer-materialxview',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-materialxview',
  },
  {
    name: 'blender-new',
    category: 'pathtracer',
    sortIndex: 20,
    description: 'Experimental MaterialX loader for Blender Cycles',
    packageName: '@material-fidelity/renderer-blender',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-blender',
  },
  {
    name: 'blender-nodes',
    category: 'pathtracer',
    sortIndex: 30,
    description: 'Experimental MaterialX loader using patched Blender custom nodes through Cycles',
    packageName: '@material-fidelity/renderer-blender',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-blender',
  },
  {
    name: 'blender-eevee-nodes',
    category: 'rasterizer',
    sortIndex: 40,
    description: 'Experimental MaterialX loader using patched Blender custom nodes through Eevee',
    packageName: '@material-fidelity/renderer-blender',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-blender',
  },
  {
    name: 'blender-io-mtlx',
    category: 'pathtracer',
    sortIndex: 50,
    description: 'io_blender_mtlx MaterialX add-on rendered through Blender Cycles',
    packageName: '@material-fidelity/renderer-blender',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-blender',
  },
  {
    name: 'materialxjs',
    category: 'rasterizer',
    sortIndex: 60,
    description: 'Experimental MaterialX loader project',
    packageName: '@material-fidelity/renderer-materialxjs',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-materialxjs',
  },
  {
    name: 'threejs-current',
    category: 'rasterizer',
    sortIndex: 70,
    description: 'Built-in Three.js MaterialX loader',
    packageName: '@material-fidelity/renderer-threejs',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-threejs',
  },
  {
    name: 'threejs-new',
    category: 'rasterizer',
    sortIndex: 80,
    description: 'Experimental MaterialX loader',
    packageName: '@material-fidelity/renderer-threejs',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-threejs',
  },
];

export function sortRendererDescriptors(left: RendererDescriptor, right: RendererDescriptor): number {
  if (left.sortIndex !== right.sortIndex) {
    return left.sortIndex - right.sortIndex;
  }
  return left.name.localeCompare(right.name);
}
