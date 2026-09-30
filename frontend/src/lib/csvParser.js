/**
 * Pure client-side CSV parsing and validation utilities.
 * No external library — zero dependencies.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse raw CSV text into rows of { email, name }.
 *
 * Rules:
 *  - Supports \r\n, \r, \n line endings
 *  - Trims whitespace from every field
 *  - Strips surrounding double-quotes
 *  - Skips the header row if the first field is "email" (case-insensitive)
 *  - Skips fully empty lines
 *
 * @param {string} text
 * @returns {{ email: string, name: string }[]}
 */
export function parseCSV(text) {
  if (!text) return [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .split('\n');

  if (lines.length === 0) return [];

  // Detect and skip header row
  const firstField = lines[0].split(',')[0].trim().replace(/^"|"$/g, '').toLowerCase();
  const dataLines  = firstField === 'email' ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = splitCSVLine(line);
      return {
        email: sanitizeCsvField((parts[0] || '').trim()),
        name:  sanitizeCsvField((parts[1] || '').trim()),
      };
    })
    .filter((row) => row.email.length > 0); // drop blank lines
}

/**
 * Protect against CSV Injection (Formula Injection)
 * Prepend a single quote if the field starts with =, +, -, @, or \t, \r
 */
function sanitizeCsvField(field) {
  if (/^[=+\-@\t\r]/.test(field)) {
    return "'" + field;
  }
  return field;
}

/**
 * Minimal CSV line splitter that respects double-quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Analyse parsed rows and return validation statistics.
 *
 * @param {{ email: string, name: string }[]} rows
 * @returns {{
 *   totalRows:     number,
 *   validRows:     { email: string, name: string }[],
 *   invalidRows:   { email: string, name: string }[],
 *   duplicateRows: { email: string, name: string }[],
 *   uniqueRows:    { email: string, name: string }[],   // valid, deduplicated
 * }}
 */
export function analyseCSV(rows) {
  const validRows   = [];
  const invalidRows = [];

  for (const row of rows) {
    if (EMAIL_RE.test(row.email)) {
      validRows.push({ ...row, email: row.email.toLowerCase() });
    } else {
      invalidRows.push(row);
    }
  }

  // Deduplicate by normalised email, preserving first occurrence
  const seen         = new Set();
  const uniqueRows   = [];
  const duplicateRows = [];

  for (const row of validRows) {
    const key = row.email.toLowerCase();
    if (seen.has(key)) {
      duplicateRows.push(row);
    } else {
      seen.add(key);
      uniqueRows.push(row);
    }
  }

  return {
    totalRows:     rows.length,
    validRows,
    invalidRows,
    duplicateRows,
    uniqueRows,
  };
}

/**
 * Given uniqueRows and a set of unsubscribed emails,
 * return the final sendable recipient list.
 *
 * @param {{ email: string, name: string }[]} uniqueRows
 * @param {string[]} unsubscribedEmails
 * @returns {{ email: string, name: string }[]}
 */
export function buildFinalRecipients(uniqueRows, unsubscribedEmails) {
  const suppressed = new Set(unsubscribedEmails.map((e) => e.toLowerCase()));
  return uniqueRows.filter((r) => !suppressed.has(r.email.toLowerCase()));
}
