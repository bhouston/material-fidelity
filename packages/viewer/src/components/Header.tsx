import { Link } from '@tanstack/react-router';
import { Filter, Github, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { getRendererMetadata } from '#/lib/renderer-metadata';
import { SITE_NAME } from '#/lib/site-config';

interface HeaderProps {
  availableRenderers: string[];
  materialFilter: string;
  selectedRenderers: string[];
  shownMaterialCount: number;
  totalMaterialCount: number;
  onMaterialFilterChange: (value: string) => void;
  onRendererToggle: (rendererName: string, enabled: boolean) => void;
  onSelectAllRenderers: () => void;
}

export default function Header({
  availableRenderers,
  materialFilter,
  selectedRenderers,
  shownMaterialCount,
  totalMaterialCount,
  onMaterialFilterChange,
  onRendererToggle,
  onSelectAllRenderers,
}: HeaderProps) {
  const [isRendererFilterOpen, setIsRendererFilterOpen] = useState(false);
  const rendererDialogTitleId = useId();
  const selectedRendererSet = new Set(selectedRenderers);

  useEffect(() => {
    if (!isRendererFilterOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRendererFilterOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isRendererFilterOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-2 px-4 sm:px-6 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <a
            aria-label="MaterialX project"
            className="shrink-0"
            href="https://materialx.org/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <img alt="MaterialX logo" className="size-7" src="/materialx-logo.svg" />
          </a>
          <Link
            className="text-base font-semibold text-foreground no-underline sm:text-xl"
            search={(prev) => ({ materials: prev.materials, renderers: prev.renderers })}
            to="/"
          >
            {SITE_NAME}
          </Link>
          <a
            aria-label="MaterialX Fidelity Testing repository"
            className="ml-auto inline-flex items-center text-muted-foreground transition-colors hover:text-foreground md:hidden"
            href="https://github.com/bhouston/material-fidelity"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Github className="size-4" />
          </a>
        </div>

        <div className="flex items-center gap-2 md:ml-auto">
          <input
            className="h-9 w-full min-w-0 rounded-none border border-border bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary md:w-80"
            onChange={(event) => onMaterialFilterChange(event.currentTarget.value)}
            placeholder="Material Filter"
            type="text"
            value={materialFilter}
          />
          <button
            aria-expanded={isRendererFilterOpen}
            aria-haspopup="dialog"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-none border border-border bg-muted/40 px-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-muted/60"
            onClick={() => setIsRendererFilterOpen(true)}
            type="button"
          >
            <Filter className="size-4" />
            <span className="hidden sm:inline">Renderers</span>
            <span className="text-muted-foreground">
              {selectedRenderers.length}/{availableRenderers.length}
            </span>
          </button>
          <span className="shrink-0 text-sm text-muted-foreground">
            {shownMaterialCount}/{totalMaterialCount}
          </span>
          <a
            aria-label="MaterialX Fidelity Testing repository"
            className="ml-1 hidden items-center text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            href="https://github.com/bhouston/material-fidelity"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Github className="size-4" />
          </a>
        </div>
      </div>

      {isRendererFilterOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-20"
          onClick={() => setIsRendererFilterOpen(false)}
          role="presentation"
        >
          <section
            aria-labelledby={rendererDialogTitleId}
            aria-modal="true"
            className="w-full max-w-md rounded-lg border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id={rendererDialogTitleId} className="text-base font-semibold text-foreground">
                  Renderer Filter
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose which renderer columns are shown in the comparison grid.
                </p>
              </div>
              <button
                aria-label="Close renderer filter"
                className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setIsRendererFilterOpen(false)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {selectedRenderers.length} of {availableRenderers.length} enabled
                </p>
                <button
                  className="text-sm font-medium text-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground"
                  onClick={onSelectAllRenderers}
                  type="button"
                >
                  Select all
                </button>
              </div>

              <div className="space-y-3">
                {availableRenderers.map((rendererName) => {
                  const metadata = getRendererMetadata(rendererName);
                  return (
                    <label
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40"
                      key={rendererName}
                    >
                      <input
                        checked={selectedRendererSet.has(rendererName)}
                        className="mt-1 size-4 accent-primary"
                        onChange={(event) => onRendererToggle(rendererName, event.currentTarget.checked)}
                        type="checkbox"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{rendererName}</span>
                        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                          {metadata?.observerDescription ?? 'Renderer description unavailable.'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </header>
  );
}
