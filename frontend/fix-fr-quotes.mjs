import { readFileSync, writeFileSync } from 'fs';

const OPEN_CURLY = '‘';   // LEFT SINGLE QUOTATION MARK
const CLOSE_CURLY = '’';  // RIGHT SINGLE QUOTATION MARK
const STRAIGHT = ''';     // APOSTROPHE
const DQUOTE = '"';       // QUOTATION MARK

const text = readFileSync('src/locales/fr.js', 'utf8');
const lines = text.split('\n');

const fixed = lines.map(line => {
  // Only process lines where position 2 (0-indexed) is a curly left quote
  if (line.length <= 2 || line.charCodeAt(2) !== 0x2018) return line;

  let i = 2;
  let result = line.slice(0, 2) + STRAIGHT;
  i++;

  // Scan key content until key closer
  while (i < line.length && line[i] !== CLOSE_CURLY) {
    result += line[i];
    i++;
  }
  // Replace key closer with straight quote
  if (i < line.length && line[i] === CLOSE_CURLY) {
    result += STRAIGHT;
    i++;
  }

  // Copy colon + space between key and value
  while (i < line.length && line[i] !== OPEN_CURLY) {
    result += line[i];
    i++;
  }

  // Skip value opener
  if (i < line.length && line[i] === OPEN_CURLY) {
    i++;

    // Collect rest of line as raw value text (includes value content + closer + comma)
    let rest = line.slice(i);

    // Strip trailing comma if present
    let trailingComma = '';
    if (rest.endsWith(',')) {
      trailingComma = ',';
      rest = rest.slice(0, -1);
    }

    // Strip value closer (last CLOSE_CURLY in rest)
    const lastClose = rest.lastIndexOf(CLOSE_CURLY);
    let valueContent = lastClose !== -1 ? rest.slice(0, lastClose) + rest.slice(lastClose + 1) : rest;

    // Replace any remaining OPEN_CURLY in value with STRAIGHT
    valueContent = valueContent.split(OPEN_CURLY).join(STRAIGHT);

    // Choose delimiter: double quotes if value contains straight apostrophes
    if (valueContent.includes(STRAIGHT)) {
      // Replace curly apostrophes inside value with straight (they're now inside double-quoted string)
      valueContent = valueContent.split(CLOSE_CURLY).join(STRAIGHT);
      result += DQUOTE + valueContent + DQUOTE + trailingComma;
    } else {
      // Safe to use straight single quotes
      valueContent = valueContent.split(CLOSE_CURLY).join(STRAIGHT);
      result += STRAIGHT + valueContent + STRAIGHT + trailingComma;
    }
  }

  return result;
});

const countFixed = lines.filter(l => l.length > 2 && l.charCodeAt(2) === 0x2018).length;
writeFileSync('src/locales/fr.js', fixed.join('\n'), 'utf8');
console.log(`Fixed ${countFixed} lines with curly-quote keys`);
