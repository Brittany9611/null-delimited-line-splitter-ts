import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { splitNullDelimited, splitNullDelimitedStream } from '../src/index.js';

test('splits a simple null-delimited buffer', () => {
  const input = Buffer.from('a\u0000b\u0000c', 'utf8');
  assert.deepEqual(splitNullDelimited(input), ['a', 'b', 'c']);
});

test('splits a string with a trailing null byte', () => {
  assert.deepEqual(splitNullDelimited('one\u0000two\u0000'), ['one', 'two']);
});

test('empty input yields no records', () => {
  assert.deepEqual(splitNullDelimited(''), []);
  assert.deepEqual(splitNullDelimited(Buffer.alloc(0)), []);
});

test('a single null byte yields one empty record', () => {
  // The leading terminator closes an empty first record; there is no trailing
  // terminator after it, so no further record is produced.
  assert.deepEqual(splitNullDelimited('\u0000'), ['']);
});

test('consecutive null bytes produce empty records in the middle', () => {
  assert.deepEqual(splitNullDelimited('a\u0000\u0000b'), ['a', '', 'b']);
});

test('does not split on newlines', () => {
  assert.deepEqual(splitNullDelimited('a\nb\u0000c\nd'), ['a\nb', 'c\nd']);
});

test('handles multi-byte utf-8 characters', () => {
  const input = Buffer.from('\u00e9\u0000\u4e2d\u6587\u0000\ud83d\ude00', 'utf8');
  assert.deepEqual(splitNullDelimited(input), ['\u00e9', '\u4e2d\u6587', '\ud83d\ude00']);
});

test('stream splits across chunk boundaries', async () => {
  const chunks = ['ab\u0000c', 'd\u0000e\u0000', 'f'];
  const source = Readable.from(chunks.map((c) => Buffer.from(c, 'utf8')));
  const out = [];
  for await (const record of splitNullDelimitedStream(source)) {
    out.push(record);
  }
  assert.deepEqual(out, ['ab', 'cd', 'e', 'f']);
});

test('stream reassembles a multi-byte character split across chunks', async () => {
  const full = Buffer.from('\u4e2d\u0000\u4e2d', 'utf8');
  // Split the first character's three bytes after the first byte.
  const first = full.subarray(0, 1);
  const rest = full.subarray(1);
  const source = Readable.from([first, rest]);
  const out = [];
  for await (const record of splitNullDelimitedStream(source)) {
    out.push(record);
  }
  assert.deepEqual(out, ['\u4e2d', '\u4e2d']);
});

test('stream with trailing null does not yield a final empty record', async () => {
  const source = Readable.from([Buffer.from('x\u0000', 'utf8')]);
  const out = [];
  for await (const record of splitNullDelimitedStream(source)) {
    out.push(record);
  }
  assert.deepEqual(out, ['x']);
});

test('stream with empty source yields nothing', async () => {
  const source = Readable.from([]);
  const out = [];
  for await (const record of splitNullDelimitedStream(source)) {
    out.push(record);
  }
  assert.deepEqual(out, []);
});

test('stream accepts string chunks', async () => {
  async function* gen() {
    yield 'a\u0000b';
    yield '\u0000c';
  }
  const out = [];
  for await (const record of splitNullDelimitedStream(gen())) {
    out.push(record);
  }
  assert.deepEqual(out, ['a', 'b', 'c']);
});
