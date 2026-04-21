# MaterialX Fidelity Testing

MaterialX Fidelity Testing is a TypeScript monorepo for generating and comparing renderer output for known MaterialX sample scenes.

The initial scaffold focuses on reference-image generation:

- discover MaterialX materials in a samples repository,
- load a renderer adapter from `adapters/*`,
- generate deterministic PNG reference images beside each `material.mtlx`.

## Repository Layout

- `packages/core` - adapter interfaces, adapter loading, and reference-generation orchestration.
- `packages/mtlx-fidelity-cli` - `mtlx-fidelity` command line tool.
- `packages/viewer` - TanStack Start website for browsing fidelity reference images.
- `adapters/materialxview` - adapter that wraps `materialxview` / `MaterialXView`.
- `adapters/threejs` - adapter that serves a Three.js capture viewer and renders via Playwright.

## Requirements

- Node.js 24+
- pnpm 10+
- `materialxview` (or `MaterialXView`) available on your `PATH`
- third-party root at `../` containing `materialX-samples` and `three.js` repositories

Expected third-party layout:

- `../materialX-samples/materials/**/material.mtlx`
- `../materialX-samples/viewer/san_giuseppe_bridge_2k.hdr`
- `../materialX-samples/viewer/ShaderBall.glb`
- `../three.js/build/three.module.js`
- `../three.js/examples/jsm/loaders/MaterialXLoader.js`

## Install

```bash
pnpm install
```

## Build and Validate

```bash
pnpm build
pnpm tsc
pnpm lint
pnpm format
pnpm test
```

## CLI

Generate adapter-specific reference images:

```bash
pnpm cli create-references --adapters materialxview
```

```bash
pnpm cli create-references --adapters threejs --third-party-root ../ --adapters-root ./adapters
```

This command writes `<adapter-name>.png` in each directory containing a `material.mtlx`.
If `--adapters` is omitted, all discovered adapters are used.

Optional flags:

- `--third-party-root <path>` override default `../`
- `--adapters-root <path>` override default `./adapters`
- `--adapters <name[,name...]>` optional adapter filter; supports repeated flags and comma-separated values
- `--materials <selector[,selector...]>` optional material filter; supports repeated flags, comma-separated values, substring matches, and regex selectors (`re:...` or `/.../flags`)
- `--concurrency <number>` default `1`
- all adapters render with a fixed black background (`0,0,0`)
- all generated reference images are rendered at a fixed resolution of `1024x1024`
- all generated images are validated; fully black images are treated as empty render failures and deleted

## Adapter Framing Source Of Truth

To keep reference renders visually comparable between `materialxview` and `threejs`, both adapters should follow this framing setup:

- camera: perspective, FOV `45`, near `0.05`, eye `(0,0,5)`, look target `(0,0,0)`
- model normalization: center the loaded `ShaderBall.glb` at the origin, then scale it so the bounding-box sphere radius is `2.0` (matching `MaterialXView`'s `IDEAL_MESH_SPHERE_RADIUS`)
- lighting for capture: IBL from `san_giuseppe_bridge_2k.hdr`, environment background disabled, direct light disabled, shadow map disabled
- environment orientation parity: apply a Y rotation offset of `-90` degrees in the Three.js viewer (`scene.environmentRotation.y`) to match MaterialXView lighting orientation
- color/output: no tone mapping, sRGB output encoding

These values are intentionally aligned with `MaterialXView` defaults and its scene normalization behavior in `source/MaterialXView/Viewer.cpp`.

## Viewer

Run the MaterialX fidelity reference viewer:

```bash
pnpm viewer
```

The viewer scans MaterialX materials and adapter outputs using:

- `THIRD_PARTY_ROOT` (optional, default `../`) - root containing `materialX-samples`.
- `ADAPTERS_ROOT` (optional, default `./adapters`) - root containing adapter directories (`threejs`, `materialxview`, etc).

Example:

```bash
THIRD_PARTY_ROOT=../ ADAPTERS_ROOT=./adapters pnpm viewer
```

The page groups materials by type (`open_pbr_surface`, `gltf_pbr`, `standard_surface`) and displays each adapter image (`<adapter>.png`) side by side. Missing images render as a placeholder tile.

## Deploy

Cloud Run deployment workflows are provided in:

- `.github/workflows/deploy-viewer.yml`
- `.github/workflows/deploy-service.yml`

Examples:

- `--materials standard_surface` (path subset)
- `--materials /gltf_pbr/i` (regex literal)
- `--materials re:standard_surface/.*/brick` (regex with implicit `i` flag)

## CLI Interactive Mode

When run in an interactive terminal, the command displays a live Ink UI with:

- overall progress bar and completed/remaining counts,
- per-render completion log with adapter + material + success/failure status colors,
- elapsed time and ETA,
- Ctrl-C support to stop after in-flight renders complete.

## License

MIT. See `LICENSE`.
