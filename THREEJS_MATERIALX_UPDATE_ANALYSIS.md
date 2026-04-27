# Three.js MaterialX Loader Update Analysis

## Executive Summary

This compares the current upstream Three.js MaterialX implementation in `../three.js` against the proposed vendored implementation in `packages/renderer-threejs/viewer/src/vendor`.

The current upstream implementation is intentionally small: most of the loader, parser, graph resolver, node-library table, and surface mapping live in `examples/jsm/loaders/MaterialXLoader.js`, with reusable `mx_*` helper nodes in `src/nodes/materialx/MaterialXNodes.js`. It supports a useful subset of math/procedural nodes and a partial `standard_surface` mapping, but it has weak MaterialX parity: `gltf_pbr` is effectively stubbed, OpenPBR is absent, defaults are incomplete, error reporting is mostly `console.warn`, matrix/string/boolean handling is shallow, and several node semantics rely directly on Three.js TSL functions even where MaterialX behavior differs.

The proposed implementation is more like a translator subsystem than a single loader. It splits parsing, document state, archive handling, compile dispatch, node-library dispatch, surface mapping, warnings, and category validation into separate modules. This adds complexity and bookkeeping, but most of it is explainable by the parity goal: better surface coverage, stricter CI feedback, better defaults, better reference resolution, correct MaterialX-oriented UV/matrix semantics, and targeted replacements for TSL helpers that do not match MaterialX.

My recommendation is to preserve the new architecture's parity-critical parts, but avoid upstreaming all of its runtime bookkeeping as-is. In particular, the duplicate/fixed `mx_*` behavior should move into Three.js TSL or replace the faulty TSL implementations so the loader does not carry private forks of core MaterialX semantics.

## Files Compared

Current Three.js implementation:

- `../three.js/examples/jsm/loaders/MaterialXLoader.js`
- `../three.js/src/nodes/materialx/MaterialXNodes.js`
- `../three.js/src/nodes/materialx/lib/mx_noise.js`
- `../three.js/src/nodes/materialx/lib/mx_hsv.js`
- `../three.js/src/nodes/materialx/lib/mx_transform_color.js`
- `../three.js/docs/pages/MaterialXLoader.html.md`

Proposed vendored implementation:

- `packages/renderer-threejs/viewer/src/vendor/MaterialXLoader.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXDocument.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXArchive.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/parse/MaterialXParser.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/compile/MaterialXCompileRegistry.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXNodeLibrary.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXSurfaceRegistry.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXSurfaceMappings.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXWarnings.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXNodeRegistry.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/generated/MaterialXNodeRegistry.generated.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXUtils.js`
- `packages/renderer-threejs/viewer/src/vendor/materialx/MaterialXTranslatorTypes.js`

## Architecture: Old vs New

### Current Three.js

The upstream loader has a compact architecture:

- `MaterialXLoader` loads text via `FileLoader` and calls `parse(text)`.
- `MaterialX` owns a `nodesXLib` path registry, an `ImageBitmapLoader`, and a texture cache.
- `MaterialXNode` wraps each XML element, resolves graph references, compiles constants and known element names, and maps surfaces to `MeshPhysicalNodeMaterial`.
- `MXElement` and `MtlXLibrary` are defined in the loader file as an ordered table of node names to TSL functions.
- `MaterialXNodes.js` defines reusable `mx_*` TSL helpers and exports noise/color utilities.

This keeps the loader easy to read, but it also means there is no clean boundary between XML parsing, graph resolution, node compilation, surface mapping, error policy, and resource lifecycle.

### Proposed Vendored Loader

The proposed implementation separates responsibilities:

- `MaterialXLoader.js` handles loader API, `ArrayBuffer` loading, issue policy, selected material name, `.mtlx.zip` detection, and archive resource disposal.
- `MaterialXArchive.js` handles zipped MaterialX packages and creates Blob URLs for textures.
- `MaterialXParser.js` handles DOM parsing and recursive node-tree construction.
- `MaterialXDocument.js` owns document state, texture loading, path resolution, compile context, matrix/UV/hextile helpers, and the `MaterialXNode` evaluator.
- `MaterialXCompileRegistry.js` handles special node categories that need custom compilation.
- `MaterialXNodeLibrary.js` handles generic node categories through `MXElement` descriptors with ordered inputs and defaults.
- `MaterialXSurfaceRegistry.js` and `MaterialXSurfaceMappings.js` handle `standard_surface`, `gltf_pbr`, and `open_pbr_surface`.
- `MaterialXWarnings.js` provides structured warnings/errors and strict policies.
- `MaterialXNodeRegistry.js` validates compile/surface registry category names against generated MaterialX category metadata.

This is a clear complexity increase. The new code is more modular, but it also adds a compile context, registry validation, issue collector, archive disposal, surface registries, generated category metadata, and many default-value factories. Those are not free, and only some of them are directly required for MaterialX parity.

## Node Coverage and Translation

### Generic Node Library

The old loader has about 80 `MXElement` entries in `MaterialXLoader.js`. It covers common math, ramps, noise, conditionals, image nodes, `place2d`, separate/combine, and a few utility nodes. Several entries are duplicated or inaccurate in the table, for example `crossproduct`, `floor`, and `ceil` appear twice and the later entries win. Some parameter lists are also suspicious, such as `absval` and `sign` using `['in1', 'in2']` before later one-input cleanup only for `floor`/`ceil`.

The new loader has about 100 `MXElement` entries in `MaterialXNodeLibrary.js`, plus 16 compile-registry registrations that cover multiple special categories. Meaningful additions include:

- Correct defaults for nearly every generic node input.
- `range`, `fract`, `viewdirection`, `dot`, logic nodes (`and`, `or`, `xor`, `not`), `checkerboard`, `circle`, `bump`, `blackbody`.
- Compositing/color nodes such as `minus`, `difference`, `screen`, `overlay`, `burn`, `dodge`, `colorcorrect`, `unpremult`.
- More complete ramp support through `ramp_gradient` and multi-interval `ramp`.
- `transformpoint`, `transformvector`, and `transformnormal`.
- More MaterialX-specific versions of Worley/unified noise.
- More robust `separate*` output channel handling.

The new implementation is not a full MaterialX implementation. The generated category registry is broader than actual support; unsupported BSDFs, lights, Lama nodes, triplanar projection, and many standard-library categories still fall back to structured unsupported-node warnings.

### Special Compile Registry

The old loader embeds special cases directly in `MaterialXNode.getNode()` for `convert`, `constant`, position/normal/tangent/texcoord/geomcolor, `image`, `tiledimage`, and `separate*` outputs.

The new loader moves those and more into `MaterialXCompileRegistry.js`. The special registry now handles:

- `convert`, `constant`
- geometry inputs: `position`, `normal`, `tangent`, `texcoord`, `geomcolor`
- `image`, `tiledimage`
- `hextiledimage`, `hextilednormalmap`
- `gltf_image`, `gltf_normalmap`, `gltf_colorimage`
- `gltf_anisotropy_image`
- `gltf_iridescence_thickness`
- `transformmatrix`
- `invertmatrix`

This is a good separation because these categories are not just simple function calls. They need resource lookup, UV conversion, output-channel selection, matrix layout rules, or multi-output behavior.

## Surface Mapping

### Current Three.js

The old loader primarily maps `standard_surface` into `MeshPhysicalNodeMaterial`. `gltf_pbr` is present only as a stub. There is no OpenPBR surface mapper.

The `standard_surface` mapping covers base color, opacity, roughness, metalness, specular, IOR, anisotropy, transmission, thin film, sheen, coat, normal, and emission. However, it has a number of parity weaknesses:

- `gltf_pbr` is not implemented.
- OpenPBR is not implemented.
- `coat_color` is multiplied into base color, which is an approximation rather than a physically faithful layer mapping.
- Thin film enablement checks `thinFilmThicknessNode.value`, which only works reliably for constant nodes.
- Normal values are assigned directly, without the explicit `transformNormalToView()` used by the new mapping.
- It sets many material nodes to defaults even when the authored value is effectively the default.

### Proposed Vendored Loader

The new loader has three surface mappers:

- `standard_surface`
- `gltf_pbr`
- `open_pbr_surface`

This is one of the most important parity improvements. The project goal is MaterialXView parity, and modern MaterialX sample sets increasingly exercise glTF PBR and OpenPBR. Without these mappers, Three.js remains far behind the reference viewer.

Important improvements:

- `gltf_pbr` is fully mapped, including base color, occlusion, roughness, metallic, normal, transmission, specular, alpha modes, alpha cutoff, iridescence, sheen, clearcoat, attenuation, thickness, dispersion, anisotropy, and emissive.
- `open_pbr_surface` is mapped onto available `MeshPhysicalNodeMaterial` concepts, including base/specular/coat/fuzz/transmission/thin-film/emission approximations.
- Surface mappers warn on ignored inputs, which makes parity gaps visible.
- The code avoids setting some material properties when inputs are absent or effectively default.
- Normals and clearcoat normals are transformed to view space.
- Transmission defaults try to preserve visible volumetric behavior when depth/thickness is omitted.

Tradeoff: OpenPBR is richer than `MeshPhysicalNodeMaterial`, so parts of the mapping are necessarily approximations. The extra code is justified only if the target is visual parity, not strict semantic purity.

## Reference Resolution and Type Handling

The old loader supports path-based resolution through `nodegraph`/`output`, `nodename`, and `interfacename`, using a document-wide `nodesXLib` keyed by hierarchical node path. This is useful but fragile:

- Missing references can cause `undefined.getNode(...)` failures.
- Surface-level `nodename` references are less carefully resolved.
- Graph output forwarding can accidentally pass an output selector through to the resolved node.
- String, boolean, and matrix values are not handled well.

The new loader keeps the same general path registry but improves edge cases:

- Missing references are reported through `MaterialXIssueCollector` and fall back to `float(0)`.
- Surface-level references can resolve top-level siblings.
- When an `input` references a `nodegraph` plus `output`, the selected graph output is resolved without forwarding that output selector again to the target node.
- Boolean values become float masks for TSL compatibility.
- String values pass through for parameters such as `fromspace` and `tospace`.
- `matrix33` and `matrix44` constants are supported, including a reorder from MaterialX serialized matrix layout to TSL matrix construction layout.
- Channel outputs such as `outx`, `outr`, `outa`, `r`, `g`, `b`, `a` are handled more generally.

These changes are parity-relevant and should be preserved.

## Image, UV, Color Space, and Archive Handling

### Images and UVs

The old loader:

- Uses `ImageBitmapLoader`.
- Sets `imageOrientation: 'flipY'`.
- Samples images directly with `texture(textureFile, uvNode)`.
- Uses `mx_transform_uv` for `tiledimage`.
- Does not explicitly convert between MaterialX UV space and Three.js UV space.

The new loader:

- Uses `ImageBitmapLoader` with `imageOrientation: 'none'`.
- Sets texture `flipY = false`.
- Adds `mxToUvSpace()` and `mxFromUvSpace()` helpers that flip Y at MaterialX/Three boundaries.
- Applies UV conversion consistently for `texcoord`, `image`, `tiledimage`, glTF texture nodes, and hextile sampling.
- Uses `ImageLoader` for SVGs.
- Handles missing texture files with fallbacks and issues.

The UV conversion is important parity work. It should not remain a private behavior inside a vendored loader if MaterialX support is upstreamed.

### Color Space

Both implementations have very limited explicit color-space support. They look for `colorspace` on filename inputs and root `materialx`, then build a transform name like `mx_srgb_texture_to_lin_rec709`.

In both cases, the only wired transform is effectively `mx_srgb_texture_to_lin_rec709`. This is not full OCIO or full MaterialX color management. The new loader does not solve color management broadly; it mostly preserves the old mechanism with better null checks.

### Archives

The old loader reads raw `.mtlx` text only.

The new loader reads `ArrayBuffer`, detects ZIP input, requires exactly one `.mtlx` file, and resolves texture URIs from the archive to Blob URLs. It also exposes `dispose()`/`clearArchiveResources()` to revoke Blob URLs.

This is useful for browser workflows and self-contained MaterialX packages, but it is not strictly necessary for core MaterialX parity. If upstream Three.js wants minimal loader scope, archive support could be a separate enhancement.

## Duplicated or Reimplemented TSL Functionality

This is the most important section for upstreaming.

The new implementation includes several local replacements or wrappers because the Three.js TSL helpers either do not match MaterialX semantics or do not cover the needed behavior. These should be reviewed for migration into `three/tsl` / `src/nodes/materialx/MaterialXNodes.js` so the loader does not carry duplicate MaterialX semantics.

### Conditional Branch Order

`MaterialXNodeLibrary.js` explicitly says the TSL conditional helpers currently pick the opposite branch ordering relative to MaterialX:

- `mx_ifgreater_materialx(value1, value2, in1, in2)` calls TSL `mx_ifgreater(value1, value2, in2, in1)`.
- `mx_ifgreatereq_materialx(...)` swaps branches.
- `mx_ifequal_materialx(...)` swaps branches.

This is the clearest case where Three.js TSL should be corrected or given MaterialX-correct helpers. Carrying private wrappers in the loader is undesirable.

### Smoothstep Degenerate Range Semantics

The new loader adds `mx_smoothstep_materialx()` because MaterialX defines behavior for degenerate ranges. When `high <= low`, the new function behaves like `step(high, in)` instead of relying on undefined GPU behavior.

This should probably become the Three.js MaterialX smoothstep implementation, because every MaterialX loader using TSL should get the same semantics.

### Worley, Cell, and Unified Noise

The old loader uses Three.js `mx_cell_noise_float`, `mx_worley_noise_float`, `mx_unifiednoise2d`, and `mx_unifiednoise3d` from `three/tsl`.

The new loader reimplements:

- Bob Jenkins style hash helpers.
- `mx_cell_noise_vec3_materialx`.
- `mx_worley_noise_float_materialx_2d`.
- `mx_worley_noise_float_materialx_3d`.
- `mx_unifiednoise2d_materialx`.
- `mx_unifiednoise3d_materialx`.

This suggests the existing TSL MaterialX noise helpers were not close enough to MaterialXView/reference output. These are expensive helpers to keep private. If they are correct against MaterialXView, they should replace or augment the Three.js `mx_*` noise exports.

### Place2d and Rotate Semantics

The old `mx_place2d` ignores `operationorder` and applies a simple pivot/scale/rotate/offset sequence.

The new `mx_place2d_materialx()` implements both SRT and TRS order and switches by `operationorder`. The new `mx_rotate2d_materialx()` and `mx_rotate3d_materialx()` also use explicit MaterialX-oriented formulas instead of relying on the old generic helper behavior.

These are MaterialX semantics, not loader-specific concerns. They should move into Three.js TSL MaterialX helpers.

### Matrix Handling

The old loader maps `transformmatrix` directly to `mul` and `invertmatrix` directly to TSL `inverse`.

The new loader adds:

- Matrix constants for `matrix33`/`matrix44`.
- MaterialX matrix serialization reordering.
- CPU inversion for constant matrices.
- Dynamic TSL inversion for matrix nodes.
- `transformmatrix` handling that depends on `nodedef` (`ND_transformmatrix_vector2M3`, `ND_transformmatrix_vector3`, `ND_transformmatrix_vector3M4`, etc.).

This is likely a mix of TSL gap and MaterialX-specific compile logic. The matrix literal layout and `transformmatrix` nodedef behavior belong in the MaterialX translator. If TSL `inverse` is incorrect for the matrix node shapes or layout involved, that should be fixed in TSL.

### Modulo

The new loader uses `mx_mod(in1, in2) = in1 - in2 * floor(in1 / in2)` instead of TSL `mod`. This may be intended to match MaterialX/reference modulo behavior, especially for negative values. This should be verified against MaterialXView and, if confirmed, moved into the shared `mx_modulo` implementation.

### Hextile

The new hextile code is not a duplicate of a built-in TSL MaterialX function. It is a non-standard extension path (`hextiledimage`, `hextilednormalmap`) with stochastic sampling, derivatives, blending, and texture gradients.

This is useful functionality, but it should not be mixed up with fixing broken built-ins. It is a feature extension and should be justified separately if proposed upstream.

## Added Complexity and Whether It Is Justified

### Clearly Justified by MaterialX Parity

- Broader surface mapping: `gltf_pbr` and `open_pbr_surface` are essential for modern MaterialX sample parity.
- Default input values in `MXElement`: MaterialX graphs often omit defaulted inputs; using defaults reduces false unsupported/fallback output.
- Structured missing-reference/unsupported/invalid-value reporting: this is critical for a fidelity project and useful for users.
- Correct boolean/string/matrix handling: required for many real MaterialX graphs.
- UV space conversion: required for visual parity.
- Matrix layout and transformmatrix handling: required for correct transform node output.
- MaterialX-correct conditionals, smoothstep, noise, place2d, and rotation semantics: required for node parity.
- Surface ignored-input warnings: required to know whether a render is close because it is correct or merely because unsupported inputs were silent.

### Justified for This Project, But Optional for Upstream Core Loader

- `.mtlx.zip` archive support and Blob URL lifecycle: useful in browser workflows, not strictly required to improve node parity.
- `setMaterialName()`: useful when selecting one material from a document, but not central to MaterialX correctness.
- `warningCallback` and strict issue policies: very useful for CI and this fidelity viewer; upstream may prefer a smaller API or a single structured report.
- Generated category registry validation: useful to catch translator typos and drift, but it adds generated data and runtime validation that may feel heavy for Three.js examples code.
- Hextile image nodes: useful, but non-standard. They should be framed as an extension.

### Questionable or Worth Simplifying Before Upstreaming

- Keeping private `_materialx` wrappers for broken TSL helpers. These should be fixed in the shared Three.js MaterialX TSL library.
- Maintaining both generic `MtlXLibrary` entries and compile-registry overrides for `transformmatrix` and `invertmatrix`. The override is necessary now, but the generic entries become misleading.
- Runtime category validation against a generated registry. This may be better as a build/test-time assertion rather than runtime loader behavior.
- OpenPBR approximations need clear documentation. They improve visual parity, but they are not exact OpenPBR closure support.
- Hextile support should be isolated or documented as non-standard.

## What Changed Functionally

High-impact changes:

- `gltf_pbr` changed from stubbed/no-op to a real surface mapper.
- `open_pbr_surface` is newly supported.
- More MaterialX nodes have correct defaults.
- Missing references and unsupported nodes are collected into a report instead of only warning or failing indirectly.
- Loader can fail strictly with `error-core` or `error-all` policy.
- `.mtlx.zip` packages can load textures from the archive.
- Texture orientation/UV conversion is deliberately managed for MaterialX/Three parity.
- Matrix and string inputs are now meaningful.
- MaterialX-specific versions of conditionals, smoothstep, place2d, noise, and matrix behavior avoid known TSL mismatch.
- Surface mappings now warn about ignored inputs.

Potential behavior changes to watch:

- Textures may appear vertically different due to the explicit UV-space conversion and `flipY = false`.
- More missing or unsupported nodes become visible because the new issue collector reports them.
- Some materials may look less like the old Three.js output but closer to MaterialXView, especially transparent/transmissive materials, OpenPBR, glTF PBR, noise, and tiled images.
- The loader now returns `{ materials, report }`, while the old loader returned `{ materials }`.
- Strict issue policies can throw on documents that previously rendered with silent fallback nodes.

## Upstreaming Recommendations

1. Move semantic fixes into Three.js TSL first.

   Start with conditional branch order, `smoothstep` degenerate behavior, `place2d` operation order, rotate semantics, modulo, and the reference-matching noise variants. The loader should consume shared `mx_*` functions instead of carrying private `*_materialx` wrappers.

2. Keep the compile registry concept.

   A registry is justified for nodes whose behavior is not a simple TSL function call: images, tiled images, glTF image nodes, matrix transforms, constants, geometry inputs, and channel outputs.

3. Keep structured issues, but consider API shape.

   A parse `report` is valuable. Upstream Three.js may not want all strict policies and callbacks immediately, but silent fallback to `float(0)` is a major reason the current loader hides parity failures.

4. Keep `gltf_pbr` and `open_pbr_surface`, with documented approximations.

   These are core to the fidelity goal. Without them, Three.js MaterialX support remains poor relative to MaterialXView.

5. Move generated category validation out of runtime if upstream size/simplicity matters.

   It is useful for development, but it may be better as a test/build script in Three.js rather than code that runs when constructing the loader.

6. Treat archive and hextile support as optional upstream additions.

   They are useful, but they are not prerequisites for fixing core MaterialX parity.

## Bottom Line

The new implementation does add more complexity and bookkeeping than the old loader. A lot of that complexity is justified by the project goal: closing visible parity gaps with MaterialXView. The old implementation is small partly because it does not model enough of MaterialX's real behavior.

The most important cleanup before porting this back to Three.js is to avoid preserving duplicate MaterialX semantics inside the loader. Any private helper whose purpose is "Three.js TSL's MaterialX helper is wrong" should become a corrected Three.js TSL helper. Once those fixes live in `three/tsl`, the loader can stay focused on XML parsing, graph resolution, resource loading, and mapping MaterialX surfaces/nodes to shared TSL building blocks.
