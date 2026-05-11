/**
 * Utility for extracting React Server Components (RSC) and JSON data
 * embedded within Cricbuzz HTML pages.
 */

/**
 * Walk html from startIdx and extract a balanced [...] or {...} block.
 * `isEscaped=true` means string delimiters inside are \\" (RSC payload mode).
 * Returns the block text, unescaping when needed.
 */
export function extractJsonBlock(html: string, startIdx: number, isEscaped = false): string | null {
  const open = html[startIdx];
  const close = open === '[' ? ']' : open === '{' ? '}' : null;
  if (!close) return null;

  let depth = 0;
  let inStr = false;
  const limit = Math.min(startIdx + 500_000, html.length);

  for (let i = startIdx; i < limit; i++) {
    if (isEscaped) {
      // In RSC mode: string delimiters are \" (two chars: backslash + quote)
      if (html[i] === '\\' && i + 1 < limit) {
        if (html[i + 1] === '"') {
          inStr = !inStr;
          i++; // consume both chars
          continue;
        }
        if (html[i + 1] === '\\') {
          i++; // skip escaped backslash
          continue;
        }
      }
    } else {
      // Normal JSON mode: string delimiter is "
      if (html[i] === '\\' && inStr) {
        i++; // skip escaped char inside normal string
        continue;
      }
      if (html[i] === '"') { inStr = !inStr; continue; }
    }

    if (!inStr) {
      if (html[i] === open) depth++;
      else if (html[i] === close) {
        depth--;
        if (depth === 0) {
          const raw = html.substring(startIdx, i + 1);
          // Unescape RSC escaped content into proper JSON
          return isEscaped ? raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : raw;
        }
      }
    }
  }
  return null;
}

/**
 * Find first parseable JSON value for `key` in html.
 * Tries raw JSON form ("key":) first, then RSC escaped form (\"key\":).
 */
export function findJsonValue(html: string, key: string): unknown {
  // Raw JSON key (e.g. inside <script> tags)
  const rawKey = `"${key}":`;
  let pos = 0;
  while (true) {
    const idx = html.indexOf(rawKey, pos);
    if (idx === -1) break;
    const valStart = idx + rawKey.length;
    const fc = html[valStart];
    if (fc === '[' || fc === '{') {
      const block = extractJsonBlock(html, valStart, false);
      if (block) { try { return JSON.parse(block); } catch { /* next */ } }
    }
    pos = idx + 1;
  }

  // RSC escaped key: literal \\"key\\" in the HTML bytes
  const escKey = `\\"${key}\\":`; // = \" + key + \":  in the actual string
  pos = 0;
  while (true) {
    const idx = html.indexOf(escKey, pos);
    if (idx === -1) break;
    const valStart = idx + escKey.length;
    const fc = html[valStart];
    if (fc === '[' || fc === '{') {
      const block = extractJsonBlock(html, valStart, true);
      if (block) { try { return JSON.parse(block); } catch { /* next */ } }
    }
    pos = idx + 1;
  }

  return null;
}
