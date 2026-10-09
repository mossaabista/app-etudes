import { inflateRawSync } from "node:zlib";

/**
 * The text of a .docx, without a dependency: a .docx is a zip archive whose body is
 * word/document.xml. Reads the zip's central directory, inflates that one entry, and
 * turns paragraphs into lines and table cells into tab-separated columns.
 * Returns null when the file is not a readable .docx.
 */
export function docxText(buf: Buffer): string | null {
  const xml = zipEntry(buf, "word/document.xml");
  if (!xml) return null;
  const text = xml
    .toString("utf8")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    // A table row reads as one line: cells joined by tabs, the row ending the line.
    .replace(/<\/w:p>\s*<\/w:tc>/g, "\t")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
  return text
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MAX_ENTRY = 20 * 1024 * 1024;

/** One file from a zip archive, or null. Supports stored and deflated entries. */
export function zipEntry(buf: Buffer, name: string): Buffer | null {
  // The end-of-central-directory record sits in the last 64 KB + 22 bytes.
  const from = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= from; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const entry = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    if (entry === name) {
      if (buf.readUInt32LE(local) !== 0x04034b50 || size > MAX_ENTRY) return null;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      try {
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_ENTRY });
      } catch {
        return null;
      }
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
