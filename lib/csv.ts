export type ParsedCsvRow = Record<string, string>;

export type ParsedCsv = {
  rows: ParsedCsvRow[];
  headers: string[];
  delimiter: ',' | ';' | '\t';
  errors: string[];
};

const delimiters = [',', '\t', ';'] as const;

function firstRecord(text: string) {
  let quoted = false;
  let record = '';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      record += '""';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
      record += character;
    } else if ((character === '\r' || character === '\n') && !quoted) {
      break;
    } else {
      record += character;
    }
  }
  return record;
}

function delimiterFor(text: string): ParsedCsv['delimiter'] {
  const record = firstRecord(text);
  let quoted = false;
  const counts = new Map<ParsedCsv['delimiter'], number>(delimiters.map((delimiter) => [delimiter, 0]));
  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    const next = record[index + 1];
    if (character === '"' && quoted && next === '"') index += 1;
    else if (character === '"') quoted = !quoted;
    else if (!quoted && delimiters.includes(character as ParsedCsv['delimiter'])) {
      const delimiter = character as ParsedCsv['delimiter'];
      counts.set(delimiter, (counts.get(delimiter) || 0) + 1);
    }
  }
  return delimiters.reduce((best, candidate) =>
    (counts.get(candidate) || 0) > (counts.get(best) || 0) ? candidate : best
  , ',');
}

export function parseCsvText(text: string): ParsedCsv {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = delimiterFor(source);
  const matrix: string[][] = [];
  const errors: string[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const finishRow = () => {
    row.push(cell.trim());
    if (row.some((value) => value !== '')) matrix.push(row);
    row = [];
    cell = '';
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\r' || character === '\n') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      finishRow();
    } else {
      cell += character;
    }
  }
  if (quoted) errors.push('The file contains an unclosed quoted field.');
  if (cell !== '' || row.length) finishRow();

  const headers = (matrix.shift() || []).map((header) => header.trim());
  if (!headers.length || headers.every((header) => !header)) {
    errors.push('The file needs a header row.');
    return { rows: [], headers: [], delimiter, errors };
  }
  const emptyHeader = headers.findIndex((header) => !header);
  if (emptyHeader >= 0) errors.push(`Column ${emptyHeader + 1} has no header.`);
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const duplicate = normalized.find((header, index) => header && normalized.indexOf(header) !== index);
  if (duplicate) errors.push('The file contains duplicate column headers.');

  const rows = matrix.map((values, rowIndex) => {
    if (values.length > headers.length) {
      errors.push(`Row ${rowIndex + 1} contains more values than the header row.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
  return { rows, headers, delimiter, errors };
}
