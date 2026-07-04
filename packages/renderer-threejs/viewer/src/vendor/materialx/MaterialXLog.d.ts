export interface MaterialXLogCode {
  label: string;
  severity: 'error' | 'warning';
}

export const MaterialXLogCodes: Record<string, MaterialXLogCode>;

export interface MaterialXLogEntry {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  nodeName?: string;
}

export class MaterialXLog {
  entries: MaterialXLogEntry[];
  readonly errors: MaterialXLogEntry[];
  readonly warnings: MaterialXLogEntry[];
  add(code: MaterialXLogCode, message: string, nodeName?: string): void;
}
