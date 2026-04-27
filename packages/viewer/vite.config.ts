import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { nitro } from 'nitro/vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

const viewerRenderers = process.env.VIEWER_RENDERERS ?? '';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    'import.meta.env.VITE_VIEWER_RENDERERS': JSON.stringify(viewerRenderers),
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    nitro({
      preset: 'node-server',
      routeRules: {
        '/assets/**': {
          headers: {
            'cache-control': 'public, max-age=31536000, immutable',
          },
        },
      },
    }),
  ],
});

export default config;
