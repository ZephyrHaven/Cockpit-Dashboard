#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { cockpitThemeDirectory, cockpitThemeFiles, cockpitReadTheme, cockpitInstallTheme } = require('../src/theme-installer');
const bundle = {
  manifest:JSON.parse(fs.readFileSync(path.join(__dirname, '../theme/cockpit-glass/manifest.json'), 'utf8')),
  css:fs.readFileSync(path.join(__dirname, '../theme/cockpit-glass/theme.css'), 'utf8')
};

(async () => {
  for (const configDir of ['', '../outside', '/absolute', 'C:\\config', 'folder//config', 'folder/./config', 'folder/../config']) {
    assert.throws(() => cockpitThemeDirectory({ configDir }), /theme-path-invalid/);
  }
  assert.throws(() => cockpitThemeFiles({ manifest:{ name:'other' }, css:'' }), /theme-bundle-invalid/);
  // Exercise the shipped payload format, including CSS dollar signs and escapes.
  const source = fs.readFileSync(path.join(__dirname, '../src/theme-installer.js'), 'utf8');
  const context = { module:{ exports:{} } };
  vm.runInNewContext(source.replace("'__COCKPIT_GLASS_BUNDLE__'", () => JSON.stringify(bundle)), context);
  assert.equal(context.module.exports.cockpitThemeFiles()['theme.css'], bundle.css);

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cockpit-theme-'));
  const diskPath = (name) => path.join(root, name);
  let writeHook = null;
  const writes = [];
  const adapter = {
    exists:async (name) => { try { await fsp.access(diskPath(name)); return true; } catch (_) { return false; } },
    read:(name) => fsp.readFile(diskPath(name), 'utf8'),
    mkdir:(name) => fsp.mkdir(diskPath(name)),
    remove:(name) => fsp.unlink(diskPath(name)),
    write:async (name, content) => {
      writes.push(name);
      if (writeHook) await writeHook(name, content);
      await fsp.writeFile(diskPath(name), content);
    }
  };
  const vault = { configDir:'.custom\\desktop', adapter };
  const directory = '.custom/desktop/themes/Cockpit Glass';
  const oldFiles = { 'theme.css':'/* personal adjustments */', 'manifest.json':'{"name":"Cockpit Glass","version":"1.1.0"}' };
  const seed = async (files) => {
    for (const [name, content] of Object.entries(files)) await fsp.writeFile(diskPath(directory + '/' + name), content);
  };
  try {
    assert.equal(cockpitThemeDirectory(vault), directory, 'Custom Windows-style config directories normalize to vault-relative paths.');
    assert.equal((await cockpitReadTheme(vault, bundle)).state, 'missing');
    await cockpitInstallTheme(vault, bundle);
    assert.equal((await cockpitReadTheme(vault, bundle)).state, 'current');
    const writeCount = writes.length;
    await cockpitInstallTheme(vault, bundle);
    assert.equal(writes.length, writeCount, 'Matching installs never rewrite files.');
    await fsp.writeFile(diskPath('.custom/desktop/appearance.json'), '{"keep":true}');
    await fsp.writeFile(diskPath(directory + '/notes.txt'), 'keep');
    await seed(oldFiles);
    assert.equal((await cockpitReadTheme(vault, bundle)).state, 'update');
    const [installed, concurrent] = await Promise.all([cockpitInstallTheme(vault, bundle), cockpitInstallTheme(vault, bundle)]);
    assert.equal(installed.backupDirectory, concurrent.backupDirectory, 'Concurrent calls share one installation.');
    for (const [name, content] of Object.entries(oldFiles)) assert.equal(await adapter.read(installed.backupDirectory + '/' + name), content);
    assert.equal(await adapter.read('.custom/desktop/appearance.json'), '{"keep":true}', 'Host preferences remain untouched.');
    assert.equal(await adapter.read(directory + '/notes.txt'), 'keep');

    await adapter.write(directory + '/theme.css', 'local modifications');
    assert.equal((await cockpitReadTheme(vault, bundle)).state, 'modified');
    await seed({ ...oldFiles, 'manifest.json':'{"name":"Cockpit Glass","version":"99.0.0"}' });
    assert.equal((await cockpitReadTheme(vault, bundle)).state, 'newer');
    await assert.rejects(cockpitInstallTheme(vault, bundle), /theme-newer-installed/);
    assert.equal(await adapter.read(directory + '/theme.css'), oldFiles['theme.css']);

    await seed(oldFiles);
    let failed = false;
    writeHook = async (name) => {
      if (name === directory + '/manifest.json' && !failed) {
        failed = true;
        await fsp.writeFile(diskPath(name), 'partial write');
        throw new Error('disk full');
      }
    };
    await assert.rejects(cockpitInstallTheme(vault, bundle), /theme-install-failed/);
    writeHook = null;
    for (const [name, content] of Object.entries(oldFiles)) assert.equal(await adapter.read(directory + '/' + name), content, 'Partial writes roll back both theme files.');

    writeHook = async (name) => { if (name.includes('/.cockpit-backups/')) throw new Error('backup denied'); };
    await assert.rejects(cockpitInstallTheme(vault, bundle), /backup denied/);
    writeHook = null;
    assert.equal(await adapter.read(directory + '/theme.css'), oldFiles['theme.css'], 'Backup failure cannot overwrite the installed theme.');

    writeHook = async (name) => {
      if (name.includes('/.cockpit-backups/') && name.endsWith('/theme.css')) await fsp.writeFile(diskPath(directory + '/theme.css'), 'external edit');
    };
    await assert.rejects(cockpitInstallTheme(vault, bundle), /theme-changed-during-install/);
    writeHook = null;
    assert.equal(await adapter.read(directory + '/theme.css'), 'external edit');

    const freshVault = { configDir:'.fresh', adapter };
    failed = false;
    writeHook = async (name) => {
      if (name === '.fresh/themes/Cockpit Glass/manifest.json' && !failed) { failed = true; throw new Error('permission denied'); }
    };
    await assert.rejects(cockpitInstallTheme(freshVault, bundle), /theme-install-failed/);
    writeHook = null;
    assert.equal((await cockpitReadTheme(freshVault, bundle)).state, 'missing', 'Failed first installs remove new files.');
    await cockpitInstallTheme(freshVault, bundle);
    assert.equal((await cockpitReadTheme(freshVault, bundle)).state, 'current', 'A failed install can be retried.');
  } finally { await fsp.rm(root, { recursive:true, force:true }); }
  console.log('Theme paths, bundled payload, backups, concurrent installs and failure recovery passed');
})().catch((error) => { console.error(error); process.exit(1); });
