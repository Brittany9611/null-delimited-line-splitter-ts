# null-delimited-line-splitter-ts

Splits file content on null bytes (U+0000) instead of newlines, for parsing null-separated record formats.

## Usage

```js
import { splitNullDelimited, splitNullDelimitedStream } from 'null-delimited-line-splitter-ts';
import { Readable } from 'node:stream';

// Buffer or string input:
const records = splitNullDelimited(Buffer.from('alpha\0beta\0gamma', 'utf8'));
// => ['alpha', 'beta', 'gamma']

// Streaming input (async iterable of Buffers or strings):
const source = Readable.from([Buffer.from('one\0two'), Buffer.from('\0three')]);
for await (const record of splitNullDelimitedStream(source)) {
  console.log(record); // 'one', 'two', 'three'
}
```

## Why this exists

Many tools emit records separated by null bytes rather than newlines: `find -print0`, `xargs -0`, `git ls-files -z`, and various log or index formats. Splitting on `\n` corrupts any record that legitimately contains a newline. This library splits on `\0` and nothing else.

The trade-off is that a trailing null byte is treated as a terminator, not as a separator introducing an empty final record. That is the convention used by null-terminated streams, and it means `splitNullDelimited('a\0')` returns `['a']`, not `['a', '']`. If your format uses null bytes purely as separators between non-empty fields, this is what you want; if you need to preserve a trailing empty field, append it yourself or inspect the raw bytes.

The streaming variant decodes incrementally with `StringDecoder`, so a multi-byte UTF-8 character split across two chunks is reassembled rather than mangled. It never buffers the entire input.

## Edge cases

- Empty input (`''` or a zero-length Buffer) yields `[]`.
- A lone null byte (`'\0'`) yields `['']`: the terminator closes an empty record and there is no data after it.
- Consecutive null bytes in the middle (`'a\0\0b'`) yield `['a', '', 'b']`.
- Newlines are ordinary characters and are never split on.
