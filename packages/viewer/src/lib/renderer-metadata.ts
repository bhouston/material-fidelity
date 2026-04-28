export interface RendererMetadata {
  rendererName: string;
  packageName: string;
  packageUrl: string;
  observerDescription: string;
}

const RENDERER_METADATA_BY_NAME: Record<string, RendererMetadata> = {
  blender: {
    rendererName: 'blender',
    packageName: '@material-fidelity/renderer-blender',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-blender',
    observerDescription: "This is Blender's bundled MaterialX support rendered through Cycles.",
  },
  materialxview: {
    rendererName: 'materialxview',
    packageName: '@material-fidelity/renderer-materialxview',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-materialxview',
    observerDescription: 'This is the reference MaterialX viewer from the open source project.',
  },
  'threejs-current': {
    rendererName: 'threejs-current',
    packageName: '@material-fidelity/renderer-threejs',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-threejs',
    observerDescription: 'This is the built-in Three.js MaterialX loader.',
  },
  'threejs-new': {
    rendererName: 'threejs-new',
    packageName: '@material-fidelity/renderer-threejs',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-threejs',
    observerDescription: 'This is the proposed new MaterialX loader.',
  },
  materialxjs: {
    rendererName: 'materialxjs',
    packageName: '@material-fidelity/renderer-materialxjs',
    packageUrl: 'https://github.com/bhouston/material-fidelity/tree/main/packages/renderer-materialxjs',
    observerDescription: 'This is an experimental MaterialX loader project.',
  },
};

export function getRendererMetadata(rendererName: string): RendererMetadata | undefined {
  return RENDERER_METADATA_BY_NAME[rendererName];
}
