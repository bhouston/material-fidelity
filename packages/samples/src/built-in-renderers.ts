import type { RendererDescriptor } from './types.js';

/** Built-in renderer names and categories without importing renderer packages (for viewer index). */
export const BUILT_IN_RENDERER_DESCRIPTORS: RendererDescriptor[] = [
  {
    name: 'materialxview',
    category: 'raytracer',
    sortIndex: 10,
    description: 'Reference viewer from the MaterialX project',
    packageName: '@material-fidelity/renderer-materialxview',
    sourceName: 'MaterialXView',
    sourceUrl: 'https://github.com/AcademySoftwareFoundation/MaterialX/tree/main/source/MaterialXView',
  },
  {
    name: 'blender-new',
    category: 'pathtracer',
    sortIndex: 20,
    description: 'Blender MaterialX Importer rendered through Cycles',
    packageName: '@material-fidelity/renderer-blender',
    sourceName: 'Blender MaterialX Importer',
    sourceUrl: 'https://github.com/bhouston/blender-materialx-importer',
  },
  {
    name: 'blender-nodes',
    category: 'pathtracer',
    sortIndex: 30,
    description: 'Blender MaterialX Importer through Cycles with Blender custom MaterialX nodes PR #158054',
    packageName: '@material-fidelity/renderer-blender',
    sourceName: 'Blender MaterialX Importer',
    sourceUrl: 'https://github.com/bhouston/blender-materialx-importer',
  },
  {
    name: 'blender-eevee-nodes',
    category: 'rasterizer',
    sortIndex: 40,
    description: 'Blender MaterialX Importer through Eevee with Blender custom MaterialX nodes PR #158054',
    packageName: '@material-fidelity/renderer-blender',
    sourceName: 'Blender MaterialX Importer',
    sourceUrl: 'https://github.com/bhouston/blender-materialx-importer',
  },
  {
    name: 'blender-io-mtlx',
    category: 'pathtracer',
    sortIndex: 50,
    description: 'io_blender_mtlx MaterialX add-on rendered through Blender Cycles',
    packageName: '@material-fidelity/renderer-blender',
    sourceName: 'io_blender_mtlx',
    sourceUrl: 'https://github.com/Activision/io_blender_mtlx',
  },
  {
    name: 'materialxjs',
    category: 'rasterizer',
    sortIndex: 60,
    description: 'Experimental MaterialX loader project',
    packageName: '@material-fidelity/renderer-materialxjs',
    sourceName: 'MaterialX JavaScript',
    sourceUrl: 'https://github.com/AcademySoftwareFoundation/MaterialX/tree/main/javascript',
  },
  {
    name: 'threejs-current',
    category: 'rasterizer',
    sortIndex: 70,
    description: 'Built-in Three.js MaterialX loader',
    packageName: '@material-fidelity/renderer-threejs',
    sourceName: 'Three.js',
    sourceUrl: 'https://github.com/mrdoob/three.js',
  },
  {
    name: 'threejs-new',
    category: 'rasterizer',
    sortIndex: 80,
    description: 'Experimental MaterialX loader',
    packageName: '@material-fidelity/renderer-threejs',
    sourceName: 'Three.js PR #33485',
    sourceUrl: 'https://github.com/mrdoob/three.js/pull/33485',
  },
];

export function sortRendererDescriptors(left: RendererDescriptor, right: RendererDescriptor): number {
  if (left.sortIndex !== right.sortIndex) {
    return left.sortIndex - right.sortIndex;
  }
  return left.name.localeCompare(right.name);
}
