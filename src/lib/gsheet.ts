export async function gsheetReadRows(
  spreadsheetId: string,
  range: string,
): Promise<{ rows: unknown[][] }> {
  const chan = (typeof window !== 'undefined' && (window as unknown as { desktop?: { gsheetReadRows: (spreadsheetId: string, range: string) => Promise<{ rows: unknown[][] }> } }).desktop) ?? undefined;
  if (!chan) throw new Error('gsheet non configuré');
  const res = await chan.gsheetReadRows(spreadsheetId, range);
  if (!Array.isArray(res.rows)) return { rows: [] };
  return res;
}
