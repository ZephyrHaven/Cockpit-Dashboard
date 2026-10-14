#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const api = require('../src/jsonl-log.js');

assert.deepEqual(api.cockpitTrimJsonlRows(['a', '', 'b', 'c'], 2, 1024), ['b', 'c'], 'Trimming keeps the newest rows.');
assert.deepEqual(api.cockpitTrimJsonlRows(['x'.repeat(800), 'y'.repeat(800)], 10, 1024), ['y'.repeat(800)], 'Trimming respects the byte budget.');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-jsonl-'));
  const file = path.join(dir, 'nested', 'runs.jsonl');
  await Promise.all(Array.from({ length:40 }, (_, i) => api.cockpitAppendJsonl(file, { i }, { limit:10, maxBytes:4096 })));
  const rows = api.cockpitReadJsonl(file, 10);
  assert.equal(rows.length, 10, 'Reads return at most the configured number of rows.');
  assert.equal(rows[0].i, 39, 'Concurrent appends are serialized and newest comes first.');
  assert.ok(fs.readFileSync(file, 'utf8').trim().split('\n').length <= 12, 'The file is compacted once it grows past the limit.');
  await api.cockpitClearJsonl(file);
  assert.deepEqual(api.cockpitReadJsonl(file), []);
  fs.rmSync(dir, { recursive:true, force:true });
  for (const name of ['scheduled-tasks.js', 'toolbar-custom.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../src', name), 'utf8'), /writeFileSync|readFileSync\(file/, name + ' uses the async JSONL helper.');
  }
  console.log('jsonl-log ok');
})().catch((e) => { console.error(e); process.exit(1); });
