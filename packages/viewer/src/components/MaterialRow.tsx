import { DownloadIcon, ExternalLink, Info } from 'lucide-react';
import type {
  MaterialViewModel,
  RendererCategoryGroupViewModel,
} from '#/lib/material-index';

function toAnchorId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface MaterialRowProps {
  material: MaterialViewModel;
  rendererGroups: RendererCategoryGroupViewModel[];
  onTrackMaterialAction: (
    action: 'download_mtlx' | 'open_live_viewer',
    material: MaterialViewModel,
  ) => void;
  onOpenReport: (report: {
    materialName: string;
    rendererName: string;
    reportUrl: string;
  }) => void;
}

export function MaterialRow({
  material,
  rendererGroups,
  onTrackMaterialAction,
  onOpenReport,
}: MaterialRowProps) {
  const materialId = toAnchorId(material.id);

  return (
    <article className="border-b border-border py-4 last:border-b-0">
      <div className="group flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={materialId} className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span>{material.displayPath}</span>
          <a
            aria-label={`Link to ${material.displayPath}`}
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
            onClick={() => onTrackMaterialAction('download_mtlx', material)}
          >
            <DownloadIcon className="size-3.5" />
            <span>Download</span>
          </a>
          <a
            className="inline-flex items-center gap-1 rounded-none border border-border bg-muted/40 px-2.5 py-1.5 font-normal text-foreground transition-colors hover:border-primary/40 hover:bg-muted/60"
            href={material.liveViewerUrl}
            onClick={() => onTrackMaterialAction('open_live_viewer', material)}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" /> <span>Viewer</span>
          </a>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto pb-2">
        <div className="flex min-w-full justify-center gap-4">
          {rendererGroups.map((rendererGroup, groupIndex) => (
            <div key={rendererGroup.category} className="flex flex-none items-stretch gap-4">
              {rendererGroup.renderers.map((rendererName) => {
                const imageUrl = material.images[rendererName];
                const reportUrl = material.reports[rendererName];
                return (
                  <figure key={rendererName} className="flex w-[170px] flex-none flex-col gap-2 sm:w-[200px]">
                    <div className="relative">
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
                      {reportUrl ? (
                        <button
                          aria-label={`Show render report for ${material.name} on ${rendererName}`}
                          className="absolute right-2 bottom-2 inline-flex size-7 items-center justify-center rounded-full border border-border bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
                          onClick={() =>
                            onOpenReport({ materialName: material.name, rendererName, reportUrl })
                          }
                          type="button"
                        >
                          <Info className="size-4" />
                        </button>
                      ) : null}
                    </div>
                    <figcaption className="text-center text-xs font-medium text-muted-foreground">
                      {rendererName}
                    </figcaption>
                  </figure>
                );
              })}
              {groupIndex < rendererGroups.length - 1 ? (
                <div aria-hidden="true" className="my-1 w-px self-stretch bg-border" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
