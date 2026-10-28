#!/usr/bin/env node

const assert = require('node:assert/strict');
global.buildAgentUnifiedDiff = require('../src/ai-diff.js').buildAgentUnifiedDiff;
const { buildAgentToolReview } = require('../src/ai-tool-review.js');

const edit = buildAgentToolReview({ name:'ws_edit_file', args:{ path:'src/main.js', old_string:'old();', new_string:'new();', replace_all:true } });
assert.equal(edit.target, 'src/main.js');
assert.deepEqual(edit.sections.map((section) => section.title), ['替换前','替换后','范围']);
assert.equal(edit.sections[1].text, 'new();');
const reviewedEdit = buildAgentToolReview({ name:'ws_edit_file', args:{ path:'src/main.js', old_string:'old();', new_string:'new();' }, review:{ path:'src/main.js', before:'old();\n', after:'new();\n' } });
assert.equal(reviewedEdit.sections[0].title, '文件差异');
assert.match(reviewedEdit.sections[0].text, /-old\(\);\n\+new\(\);/);

const overwrite = buildAgentToolReview({ name:'ws_write_file', args:{ path:'notes/a.md', content:'x'.repeat(15000) } });
assert.equal(overwrite.sections[0].truncated, true, 'Large overwrite previews disclose truncation.');
assert.equal(overwrite.sections[0].length, 15000);
assert.equal(overwrite.sections[0].fullText.length, 15000, 'The full content remains available for review.');

const command = buildAgentToolReview({ name:'sys_run_command', args:{ id:'build' }, review:{ command:'node', args:['build.js'], cwd:'/project' } }, 'en');
assert.equal(command.target, '/project');
assert.equal(command.sections[0].text, '[\n  "node",\n  "build.js"\n]', 'Approval shows the exact configured program and argument boundaries.');

console.log('AI tool review checks passed');
