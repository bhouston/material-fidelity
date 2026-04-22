import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ExternalLink, DownloadIcon } from 'lucide-react';
import { useGoogleAnalytics } from 'tanstack-router-ga4';
import { getViewerIndexData } from '#/lib/material-index';

const SURFACE_TYPES = ['gltf_pbr', 'open_pbr_surface', 'standard_surface'] as const;
type SurfaceType = (typeof SURFACE_TYPES)[number];

function toCsvSurfaceSelection(value: readonly SurfaceType[]): string | undefined {
  if (value.length === SURFACE_TYPES.length) {
    return undefined;
  }
  return value.join(',');
}

function toSelectedSurfaceTypes(rawValue: unknown): SurfaceType[] {
  if (typeof rawValue !== 'string') {
    return [...SURFACE_TYPES];
  }

  const selected = rawValue
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is SurfaceType => SURFACE_TYPES.includes(part as SurfaceType))
    .filter((part, index, array) => array.indexOf(part) === index);

  if (selected.length === 0) {
    return [...SURFACE_TYPES];
  }

  return selected;
}

const getViewerData = createServerFn({
  method: 'GET',
}).handler(async () => getViewerIndexData());

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => {
    const materials = typeof search.materials === 'string' ? search.materials.trim() : '';
    const selectedSurfaces = toSelectedSurfaceTypes(search.surfaces);
    return {
      materials: materials.length > 0 ? materials : undefined,
      surfaces: toCsvSurfaceSelection(selectedSurfaces),
    };
  },
  loader: () => getViewerData(),
  component: App,
});

function toAnchorId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function App() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const ga = useGoogleAnalytics();
  const selectedSurfaces = toSelectedSurfaceTypes(search.surfaces);
  const selectedSurfaceSet = new Set(selectedSurfaces);
  const materialSearch = search.materials?.trim().toLocaleLowerCase() ?? '';
  const filteredGroups = data.groups
    .filter((group) => selectedSurfaceSet.has(group.type as SurfaceType))
    .map((group) => ({
      ...group,
      materials: group.materials.filter((material) => material.name.toLocaleLowerCase().includes(materialSearch)),
    }))
    .filter((group) => group.materials.length > 0);
  const shownMaterialCount = filteredGroups.reduce((total, group) => total + group.materials.length, 0);
  const totalMaterialCount = data.groups.reduce((total, group) => total + group.materials.length, 0);

  const trackMaterialAction = (
    action: 'download_mtlx' | 'open_live_viewer' | 'open_source',
    material: {
      type: string;
      name: string;
      downloadMtlxZipUrl: string;
      liveViewerUrl: string;
      sourceUrl: string;
    },
  ) => {
    const destinationUrl =
      action === 'download_mtlx'
        ? material.downloadMtlxZipUrl
        : action === 'open_live_viewer'
          ? material.liveViewerUrl
          : material.sourceUrl;

    ga.event(action, {
      material_name: material.name,
      material_type: material.type,
      destination_url: destinationUrl,
    });
  };

  const updateFilters = (next: { materials: string | undefined; surfaces: readonly SurfaceType[] }) => {
    navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        materials: next.materials,
        surfaces: toCsvSurfaceSelection(next.surfaces),
      }),
    });
  };

  const handleMaterialSearchChange = (value: string) => {
    const trimmed = value.trim();
    updateFilters({
      materials: trimmed.length > 0 ? value : undefined,
      surfaces: selectedSurfaces,
    });
  };

  const handleSurfaceToggle = (surfaceType: SurfaceType, checked: boolean) => {
    const nextSelected = checked
      ? [...new Set([...selectedSurfaces, surfaceType])]
      : selectedSurfaces.filter((value) => value !== surfaceType);
    const normalizedSelected = nextSelected.length > 0 ? nextSelected : [...SURFACE_TYPES];

    updateFilters({
      materials: search.materials,
      surfaces: normalizedSelected,
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-4 py-8 sm:px-6">
      <section>
        <p className="max-w-5xl text-sm leading-6 text-muted-foreground sm:text-base">
          This viewer lists{' '}
          <a
            className="underline underline-offset-2 hover:no-underline"
            href="https://materialx.org/"
            rel="noreferrer"
            target="_blank"
          >
            MaterialX
          </a>{' '}
          sample materials and compares renderer reference renders side-by-side so you can quickly spot visual
          differences and missing captures.
        </p>
        <div className="mt-3 max-w-5xl text-sm leading-6 text-muted-foreground sm:text-base">
          <p className="font-medium text-foreground">Supported renderers:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <a
                className="underline underline-offset-2 hover:no-underline"
                href="https://github.com/bhouston/MaterialX-FidelityTesting/tree/main/packages/renderer-materialxview"
                target="_blank"
              >
                @materialx-fidelity/renderer-materialxview
              </a>{' '}
              - Creates renders using the official{' '}
              <a
                className="underline underline-offset-2 hover:no-underline"
                href="https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/documents/DeveloperGuide/Viewer.md"
                target="_blank"
              >
                MaterialX Viewer
              </a>
              .
            </li>
            <li>
              <a
                className="underline underline-offset-2 hover:no-underline"
                href="https://github.com/bhouston/MaterialX-FidelityTesting/tree/main/packages/renderer-threejs"
                target="_blank"
              >
                @materialx-fidelity/renderer-threejs
              </a>{' '}
              - Uses the MaterialXLoader from the{' '}
              <a
                className="underline underline-offset-2 hover:no-underline"
                href="https://threejs.org/"
                target="_blank"
              >
                Three.js project
              </a>{' '}
              with the WebGPU Renderer.
            </li>
          </ul>
        </div>
        <div className="mt-3 max-w-5xl text-sm leading-6 text-muted-foreground sm:text-base">
          <p>Want to contribute?</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <a
                className="underline underline-offset-2 hover:no-underline"
                href="https://github.com/bhouston/materialx-fidelity"
                target="_blank"
              >
                Add your own renderer here.
              </a>
            </li>
            <li>
              <a
                className="underline underline-offset-2 hover:no-underline"
                href="https://github.com/bhouston/materialx-samples"
                target="_blank"
              >
                Add more reference samples here.
              </a>
            </li>
          </ul>
        </div>
        <p className="mt-3 max-w-5xl text-sm leading-6 text-muted-foreground sm:text-base">
          This is an independent project maintained by{' '}
          <a className="underline underline-offset-2 hover:no-underline" href="https://ben3d.ca" target="_blank">
            Ben Houston
          </a>
          , and sponsored by{' '}
          <a
            className="underline underline-offset-2 hover:no-underline"
            href="https://landofassets.com"
            target="_blank"
          >
            Land of Assets
          </a>
          .
        </p>
      </section>

      {data.errors.length > 0 && (
        <section className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <h2 className="text-base font-semibold">Configuration warnings</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.errors.map((errorMessage) => (
              <li key={errorMessage}>{errorMessage}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            Material name filter
            <input
              className="h-10 rounded-none border border-border bg-background px-3 text-sm font-normal text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              onChange={(event) => handleMaterialSearchChange(event.currentTarget.value)}
              placeholder="Search materials..."
              type="text"
              value={search.materials ?? ''}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Surface types</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SURFACE_TYPES.map((surfaceType) => (
                <label key={surfaceType} className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    checked={selectedSurfaceSet.has(surfaceType)}
                    className="size-4 border-border accent-primary"
                    onChange={(event) => handleSurfaceToggle(surfaceType, event.currentTarget.checked)}
                    type="checkbox"
                  />
                  <span>{surfaceType}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Showing {shownMaterialCount} materials of {totalMaterialCount} total
        </p>
      </section>

      <div className="border-t border-border" />

      {filteredGroups.map((group) => {
        const groupId = toAnchorId(group.type);
        return (
          <section key={group.type} className="pt-2">
            <h2 id={groupId} className="group flex items-center gap-2 text-xl font-semibold capitalize text-foreground">
              <span>{group.type}</span>
              <a
                aria-label={`Link to ${group.type}`}
                className="text-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                href={`#${groupId}`}
              >
                #
              </a>
            </h2>

            <div className="mt-3 border-t border-border">
              {group.materials.map((material) => {
                const materialId = `${groupId}-${toAnchorId(material.name)}`;
                return (
                  <article
                    key={`${material.type}/${material.name}`}
                    className="border-b border-border py-4 last:border-b-0"
                  >
                    <div className="group flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 id={materialId} className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <span>{material.name}</span>
                        <a
                          aria-label={`Link to ${material.name}`}
                          className="text-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                          href={`#${materialId}`}
                        >
                          #
                        </a>
                      </h3>
                      <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm">
                        <a
                          className="inline-flex items-center gap-1 rounded-none border border-border bg-muted/40 px-2.5 py-1.5 font-normal text-foreground transition-colors hover:border-primary/40 hover:bg-muted/60"
                          download
                          href={material.downloadMtlxZipUrl}
                          onClick={() => trackMaterialAction('download_mtlx', material)}
                        >
                          <DownloadIcon className="size-3.5" />
                          <span>Download</span>
                        </a>
                        <a
                          className="inline-flex items-center gap-1 rounded-none border border-border bg-muted/40 px-2.5 py-1.5 font-normal text-foreground transition-colors hover:border-primary/40 hover:bg-muted/60"
                          href={material.liveViewerUrl}
                          onClick={() => trackMaterialAction('open_live_viewer', material)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink aria-hidden="true" className="size-3.5" /> <span>Viewer</span>
                        </a>
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto pb-2">
                      <div className="flex min-w-full justify-center gap-4">
                        {data.rendererGroups.map((rendererGroup, groupIndex) => (
                          <div key={rendererGroup.category} className="flex flex-none items-stretch gap-4">
                            {rendererGroup.renderers.map((rendererName) => {
                              const imageUrl = material.images[rendererName];
                              return (
                                <figure key={rendererName} className="flex w-[170px] flex-none flex-col gap-2 sm:w-[200px]">
                                  {imageUrl ? (
                                    <img
                                      alt={`${material.name} rendered by ${rendererName}`}
                                      className="aspect-square w-full border border-border object-cover"
                                      loading="lazy"
                                      src={imageUrl}
                                    />
                                  ) : (
                                    <div className="flex aspect-square w-full items-center justify-center border border-dashed border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      missing
                                    </div>
                                  )}
                                  <figcaption className="text-center text-xs font-medium text-muted-foreground">
                                    {rendererName}
                                  </figcaption>
                                </figure>
                              );
                            })}
                            {groupIndex < data.rendererGroups.length - 1 ? (
                              <div
                                aria-hidden="true"
                                className="my-1 w-px self-stretch bg-border"
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
