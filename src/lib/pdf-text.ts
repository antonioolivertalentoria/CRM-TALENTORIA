import type { PDFFont } from "pdf-lib";

/**
 * Texto para los PDFs que arma el CRM con pdf-lib (reporte semanal y
 * reporte de productividad). Las fuentes estándar usan WinAnsi: los
 * acentos y la ñ pasan, los emojis y la puntuación tipográfica no.
 */

/** Sustituye puntuación tipográfica, quita emojis y junta espacios. */
export function clean(text: string): string {
  return text
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^ -ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parte un texto en renglones que caben en `maxWidth`. */
export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = clean(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Recorta un texto a un renglón con "..." si no cabe. */
export function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const c = clean(text);
  if (font.widthOfTextAtSize(c, size) <= maxWidth) return c;
  let s = c;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}...`;
}
