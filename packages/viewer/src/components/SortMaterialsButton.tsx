import { ArrowUpDown } from 'lucide-react';
import { MATERIAL_SORT_OPTIONS, type MaterialSortValue } from '#/lib/material-sort';

interface SortMaterialsButtonProps {
  value: MaterialSortValue;
  onChange: (value: MaterialSortValue) => void;
}

export function SortMaterialsButton({ value, onChange }: SortMaterialsButtonProps) {
  const selectedOption = MATERIAL_SORT_OPTIONS.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? 'Default';

  return (
    <div className="relative shrink-0">
      <label className="sr-only" htmlFor="material-sort">
        Sort materials: {selectedLabel}
      </label>
      <ArrowUpDown className="pointer-events-none absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-foreground" />
      <select
        aria-label={`Sort materials: ${selectedLabel}`}
        className="h-9 w-9 appearance-none rounded-none border border-border bg-muted/40 p-0 text-sm font-medium text-transparent shadow-xs outline-none transition-colors hover:border-primary/40 hover:bg-muted/60 focus:border-primary"
        id="material-sort"
        onChange={(event) => onChange(event.currentTarget.value as MaterialSortValue)}
        title={`Sort materials: ${selectedLabel}`}
        value={value}
      >
        {MATERIAL_SORT_OPTIONS.map((option) => (
          <option className="text-foreground" key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
