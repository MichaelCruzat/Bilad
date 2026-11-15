/** Save text as a file in the browser. */
export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC 4180 CSV from rows of plain values. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(cell).join(',')).join('\n');
}

/** Copy text, returning whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
