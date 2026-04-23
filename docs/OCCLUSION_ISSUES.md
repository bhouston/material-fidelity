# Occlusion Issues: `gltf_pbr` Translation vs `MaterialXView`

## Summary

There is a real mismatch in occlusion handling between the two translation-based renderers (`threejs` and `materialxjs`) and the reference renderer (`materialxview`):

- `materialxview` does not appear to apply the MaterialX `gltf_pbr` surface input named `occlusion` during shading.
- `threejs` and `materialxjs` currently map `gltf_pbr.occlusion` directly to Three.js `aoNode`.
- Materials authored with low occlusion values (for example `surfaces/gltf_pbr/occlusion_zero`) therefore render much darker in the translation-based renderers than in `materialxview`.

## Scope of Investigation

This analysis focused on:

- Material sample: `third_party/material-samples/materials/surfaces/gltf_pbr/occlusion_zero/material.mtlx`
- In-repo translators:
  - `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXSurfaceMappings.js`
  - `third_party/material-viewer/packages/materialx-three/src/mapping/gltf-pbr.ts`
- Upstream references:
  - `../MaterialX` (`gltf_pbr` nodedef and `MaterialXView` rendering path)
  - `../three.js` (AO and glTF occlusion behavior)

## Key Evidence

### 1) Sample Material Uses Low Occlusion

The problematic sample sets occlusion explicitly to zero:

- `third_party/material-samples/materials/surfaces/gltf_pbr/occlusion_zero/material.mtlx`
  - `<input name="occlusion" type="float" value="0.0" />`

### 2) `MaterialX` Defines Occlusion Input but Does Not Wire It

`gltf_pbr` nodedef exposes an `occlusion` input in `../MaterialX/libraries/bxdf/gltf_pbr.mtlx`, but the implementation graph does not route `occlusion` into the final `surface` node. The final surface is built from `bsdf`, `edf`, and `opacity`.

Result: in `MaterialX` core shading for `gltf_pbr`, `occlusion` is effectively not participating in the shader output path.

### 3) `MaterialXView` AO Path Is Separate (Mesh-Sidecar AO)

`MaterialXView` handles AO as an optional render feature (`hwAmbientOcclusion`) and looks for AO textures derived from mesh name:

- `<mesh_basename>_ao.png`
- `<mesh_basename>_ao_<udim>.png`

This is implemented in `../MaterialX/source/MaterialXView/Viewer.cpp` (`getAmbientOcclusionImage`) and used by the GL and Metal pipelines via `shadowState.ambientOcclusionMap`.

Result: `MaterialXView` AO is not driven by the `gltf_pbr.occlusion` input; it is driven by optional AO sidecar maps and AO toggle/gain settings.

### 4) In-Repo Translators Currently Apply `gltf_pbr.occlusion`

Both translation paths consume `occlusion` as AO:

- `threejs` translator:
  - `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXSurfaceMappings.js`
  - `if (hasNodeValue(inputs.occlusion)) material.aoNode = inputs.occlusion;`
- `materialxjs` translator (`materialx-three`):
  - `third_party/material-viewer/packages/materialx-three/src/mapping/gltf-pbr.ts`
  - assignments include `aoNode: occlusion`

Result: `occlusion=0` strongly suppresses indirect lighting in Three-based renderers.

### 5) Three.js AO / glTF Semantics

In Three.js core and GLTFLoader:

- AO is typically `aoMap` (texture) plus `aoMapIntensity` factor (`occlusionTexture.strength` in glTF).
- The AO factor modulates indirect diffuse (and specular occlusion paths in physical shading).
- Node materials support AO via `aoNode` multiplication into ambient occlusion context.

Result: applying scalar occlusion directly to `aoNode` is physically impactful and can heavily darken images when low.

## Why `occlusion_zero` Diverges

For `surfaces/gltf_pbr/occlusion_zero`:

- `materialxview`: ignores `gltf_pbr.occlusion` in shader path, so appearance remains relatively bright.
- `threejs` / `materialxjs`: apply `occlusion=0` to AO path, so indirect lighting is attenuated strongly.

This explains the observed large differences from the reference images.

## Practical Conclusion

The current renderer mismatch is not only a numeric tuning issue; it is a semantic mismatch:

- Reference (`materialxview`) behavior: `gltf_pbr.occlusion` effectively unused in current path.
- Translation renderer behavior: `gltf_pbr.occlusion` actively used as AO.

## Candidate Resolution Options

### Option A: Match `MaterialXView` Reference (Recommended for Fidelity Harness)

For `gltf_pbr`, do not map `occlusion` to `aoNode` in:

- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXSurfaceMappings.js`
- `third_party/material-viewer/packages/materialx-three/src/mapping/gltf-pbr.ts`

Pros:

- Aligns translation renderers with current reference images.
- Minimizes divergence in fidelity comparisons.

Cons:

- Deviates from common glTF runtime expectations around occlusion behavior.

### Option B: Follow glTF-Like AO Semantics

Implement occlusion as a factor over AO texture contribution (or synthetic AO path), similar to Three.js `aoMap` + `aoMapIntensity` semantics.

Pros:

- Closer to glTF runtime expectations.

Cons:

- Will likely increase divergence from `materialxview` unless reference behavior is also changed.

### Option C: Dual-Mode Behavior

Provide a switch:

- `reference-compatible` mode (ignore `gltf_pbr.occlusion`)
- `gltf-semantic` mode (apply occlusion factor semantics)

Pros:

- Preserves fidelity workflows while enabling standards-aligned behavior for other use cases.

Cons:

- Adds maintenance complexity and testing matrix.

## Recommendation

For this repository's primary goal (fidelity against `materialxview` references), apply **Option A** first:

- Stop mapping `gltf_pbr.occlusion` to AO in both translation renderers.
- Regenerate relevant reference outputs.
- Validate that `occlusion_zero`, `occlusion_half`, and `occlusion_one` now track `materialxview` behavior more closely.

If desired, introduce Option C later so glTF-semantic behavior is still available behind an explicit mode.
