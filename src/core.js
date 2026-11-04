import { StringDecoder } from 'node:string_decoder';

/**
 * Splits a buffer or string on null bytes (U+0000).
 *
 * The input is decoded as UTF-8 when a Buffer is given. A trailing null byte
 * does not produce a final empty field; this matches the common convention for
 * null-terminated record streams (the terminator belongs to the previous record).
 *
 * @param {Buffer|string} input
 * @returns {string[]}
 */
export function splitNullDelimited(input) {
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  if (text.length === 0) return [];
  const parts = text.split('\u0000');
  // A trailing separator terminates the last record rather than starting an
  // empty one, so drop the empty tail it produces.
  if (parts.length > 1 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

/**
 * Splits a stream of chunks on null bytes without buffering the whole input.
 *
 * The returned async generator yields each record as a string. Chunks are
 * decoded incrementally with StringDecoder so that multi-byte UTF-8 sequences
 * split across chunk boundaries are reassembled correctly. A trailing null
 * byte terminates the final record and does not yield an empty string.
 *
 * @param {AsyncIterable<Buffer|string>} source
 * @returns {AsyncGenerator<string, void, void>}
 */
export async function* splitNullDelimitedStream(source) {
  const decoder = new StringDecoder('utf8');
  let pending = '';

  for await (const chunk of source) {
    const text =
      typeof chunk === 'string' ? chunk : decoder.write(chunk);
    pending += text;

    let start = 0;
    let idx;
    while ((idx = pending.indexOf('\u0000', start)) !== -1) {
      yield pending.slice(start, idx);
      start = idx + 1;
    }
    pending = pending.slice(start);
  }

  pending += decoder.end();
  if (pending.length > 0) {
    yield pending;
  }
}
