/**
 * Robust CSV parser that handles quoted fields, embedded commas,
 * embedded newlines within quotes, and escaped quotes ("").
 */
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = splitCsvLines(text);
  if (lines.length === 0) return { columns: [], rows: [] };

  // Detect delimiter from header
  const headerLine = lines[0];
  const delimiter = detectDelimiter(headerLine);

  const columns = parseRow(headerLine, delimiter).map((c) => c.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    const vals = parseRow(line, delimiter);
    const row: Record<string, string> = {};
    columns.forEach((col, j) => {
      row[col] = vals[j]?.trim() ?? '';
    });
    rows.push(row);
  }

  return { columns, rows };
}

function detectDelimiter(header: string): string {
  if (header.includes('\t')) return '\t';
  // Count commas vs semicolons outside quotes
  let commas = 0;
  let semis = 0;
  let inQuote = false;
  for (const ch of header) {
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote) {
      if (ch === ',') commas++;
      if (ch === ';') semis++;
    }
  }
  if (semis > commas) return ';';
  return ',';
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
      if (current.trim().length > 0) {
        lines.push(current);
      }
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim().length > 0) {
    lines.push(current);
  }

  return lines;
}

function parseRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}
