import { RATING_MAX, RATING_MIN } from '../config/limits.js';
import { POSITIONS } from '../models/Footballer.js';

const POSITION_SET = new Set(POSITIONS);
const DELIMITER = /[,;\t|]/;
const HEADER = /^name[\s,;|]+pos/i;
const WHOLE_NUMBER = /^\d+$/;

/** "Lionel Messi, RWF, 99" and "Lionel Messi RWF 99" both become ["Lionel Messi", "RWF", "99"]. */
function splitFields(line) {
  if (DELIMITER.test(line)) {
    return line
      .split(DELIMITER)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const words = line.split(/\s+/);
  return words.length > 2 ? [words.slice(0, -2).join(' '), ...words.slice(-2)] : words;
}

function parseLine(line) {
  const [name, ...rest] = splitFields(line);
  const numbers = rest.filter((field) => WHOLE_NUMBER.test(field));
  const words = rest.filter((field) => !WHOLE_NUMBER.test(field));

  if (!name || rest.length !== 2 || numbers.length !== 1 || words.length !== 1) {
    return { error: 'Expected a name, a position and a rating, like "Lionel Messi, RWF, 99"' };
  }
  if (name.length < 2 || name.length > 40) return { error: 'The name must be 2-40 characters' };

  const position = words[0].toUpperCase();
  if (!POSITION_SET.has(position)) {
    return { error: `Unknown position "${words[0]}". Use one of ${POSITIONS.join(', ')}` };
  }
  const rating = Number(numbers[0]);
  if (rating < RATING_MIN || rating > RATING_MAX) {
    return { error: `The rating must be a whole number from ${RATING_MIN} to ${RATING_MAX}` };
  }
  return { name, position, rating };
}

/**
 * Reads a pasted squad list, one player per line, as "Name, Position, Rating" (commas, tabs,
 * semicolons, pipes or plain spaces). Blank lines and a header row are ignored. Nothing is
 * thrown for a bad line: it is reported with its line number so the rest can still be used.
 */
export function parseSquadText(text) {
  const entries = [];
  const errors = [];
  let lineCount = 0;
  let firstLine = true;

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;

    const isFirst = firstLine;
    firstLine = false;
    if (isFirst && HEADER.test(line)) return;

    lineCount += 1;
    const parsed = parseLine(line);
    if (parsed.error) errors.push({ line: index + 1, text: line, reason: parsed.error });
    else entries.push({ line: index + 1, text: line, ...parsed });
  });

  return { entries, errors, lineCount };
}
