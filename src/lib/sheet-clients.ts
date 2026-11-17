import { gsheetReadRows } from './gsheet';

export type SheetClientsSource = {
  url: string;
  renameMap?: Record<string, string>;
};

export interface SheetParseError {
  kind: 'parse';
  message: string;
  raw: unknown;
}

export interface GsheetClientsParsed {
  items: {
    id: string;
    name: string;
    rows: Record<string, unknown>[];
  }[];
  raw: unknown;
}

export async function readSheetClientsSource(
  source: SheetClientsSource,
): Promise<{ ok: true; data: GsheetClientsParsed } | { ok: false; error: SheetParseError }> {
  const spreadIdMatch = source.url.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (!spreadIdMatch) {
    return {
      ok: false,
      error: { kind: 'parse', message: 'URL de Google Sheets invalide.', raw: source.url },
    };
  }
  const spreadId = spreadIdMatch[1];

  let resultRows: unknown[][];
  try {
    const result = await gsheetReadRows(spreadId, 'Sheet1!A1:F200');
    resultRows = result.rows;
  } catch (cause) {
    return {
      ok: false,
      error: { kind: 'parse', message: cause instanceof Error ? cause.message : 'Erreur lecture sheet.', raw: cause },
    };
  }

  const parsed = interpretSheetRows(resultRows, source.renameMap);
  return { ok: true, data: parsed };
}

type StringRecord = { [k: string | number]: unknown };

function interpretSheetRows(
  rows: unknown[][],
  renameMap?: Record<string, string>,
): GsheetClientsParsed {
  const headerIndex = findHeader(rows, ['client', 'nom', 'nom client', 'client name']);
  if (headerIndex < 0) {
    return { items: [], raw: rows };
  }
  const header = rows[headerIndex] as string[];
  const idCol = findColumnCaseInsensitive(header, 'id');
  const nameCol = findColumnCaseInsensitive(header, 'name', 'client', 'nom');
  if (idCol < 0 || nameCol < 0) {
    return { items: [], raw: rows };
  }

  const items: GsheetClientsParsed['items'] = [];
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const rawId = row[idCol];
    const rawName = row[nameCol];
    const id = String(rawId ?? '').trim();
    const name = String(rawName ?? '').trim();
    if (!id || !name) continue;

    const record: StringRecord = Object.fromEntries(
      header.map((h, i) => [h.trim() || '', row[i] ?? '']),
    );
    const sortedKeys = Object.keys(record).sort();
    const cleanRecord: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      cleanRecord[key] = record[key];
    }

    items.push({
      id: id.startsWith('client_') ? id : `client_${id.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
      name: renameMap?.[name] ?? name,
      rows: [cleanRecord] as unknown as Record<string, unknown>[],
    });
  }

  return { items, raw: rows };
}

function findHeader(rows: unknown[][], candidates: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 4); i++) {
    const row = rows[i] as string[];
    for (const c of candidates) {
      if (row.some((cell) => typeof cell === 'string' && cell.trim().toLowerCase() === c)) return i;
    }
  }
  return -1;
}

function findColumnCaseInsensitive(header: string[], ...candidates: string[]): number {
  const target = new Set(candidates.map((c) => c.toLowerCase()));
  for (let i = 0; i < header.length; i++) {
    if (target.has(header[i]?.toLowerCase() ?? '')) return i;
  }
  return -1;
}
