#!/usr/bin/env node
const assert = require('node:assert/strict');
const { buildAgentUnifiedDiff } = require('../src/ai-diff.js');

const changed = buildAgentUnifiedDiff('one\ntwo\nthree\n', 'one\nTWO\nthree\n', 'src/a.js');
assert.equal(changed.changed, true);
assert.match(changed.text, /--- a\/src\/a\.js\n\+\+\+ b\/src\/a\.js/);
assert.match(changed.text, /-two\n\+TWO/);
assert.match(changed.text, / three/);
assert.match(buildAgentUnifiedDiff('', 'new\n', 'new.txt').text, /@@ -0,0 \+1,1 @@\n\+new/, 'Creating a file adds one real line without a phantom blank line.');
assert.match(buildAgentUnifiedDiff('new', 'new\n', 'new.txt').text, /Final newline: before no, after yes/, 'A trailing newline-only change is visible.');
assert.equal(buildAgentUnifiedDiff('same', 'same', 'x').changed, false);
assert.equal(buildAgentUnifiedDiff('a\nb\nc', 'a\nx\nc', 'x', 0).coarse, true, 'Large changes can use a bounded fallback.');

console.log('AI file diff checks passed');
