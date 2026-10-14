#!/usr/bin/env node
const assert = require('node:assert/strict');
const { cockpitShellInvocation, cockpitShellLabel } = require('../src/shell-runner.js');

assert.deepEqual(cockpitShellInvocation('echo hi', 'darwin', {}), { file:'/bin/zsh', args:['-lc', 'echo hi'], label:'zsh' }, 'macOS keeps the zsh login shell.');
assert.deepEqual(cockpitShellInvocation('echo hi', 'linux', { SHELL:'/bin/bash' }).args, ['-lc', 'echo hi'], 'Linux bash runs as a login shell.');
assert.equal(cockpitShellInvocation('echo hi', 'linux', {}).file, '/bin/sh', 'Linux without $SHELL falls back to /bin/sh.');
assert.deepEqual(cockpitShellInvocation('echo hi', 'linux', {}).args, ['-c', 'echo hi'], '/bin/sh is not passed the login flag.');
assert.equal(cockpitShellInvocation('x', 'linux', { SHELL:'bash; rm -rf /' }).file, '/bin/sh', 'Malformed $SHELL values are ignored.');
const win = cockpitShellInvocation('dir', 'win32', { ComSpec:'C:\\Windows\\system32\\cmd.exe' });
assert.equal(win.file, 'C:\\Windows\\system32\\cmd.exe');
assert.deepEqual(win.args, ['/d', '/s', '/c', 'dir']);
assert.equal(cockpitShellLabel('darwin'), 'zsh');

const fs = require('node:fs');
for (const file of ['workflows.js', 'scheduled-tasks.js', 'toolbar-custom.js']) {
  assert.doesNotMatch(fs.readFileSync(require('node:path').join(__dirname, '../src', file), 'utf8'), /execFile\('\/bin\/zsh'/, file + ' must not hardcode /bin/zsh.');
}
console.log('shell-runner ok');
