#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const {
  COCKPIT_UPDATE_ASSETS,
  normalizeUpdaterConfig,
  getReleaseUpdateAssets,
  loadLatestReleaseForUpdate,
  validateUpdatePackage,
  installValidatedUpdate
} = require('../src/updater-core.js');

const base = 'https://github.com/ZephyrHaven/Cockpit-Dashboard/releases/download/1.9.0/';
const assets = COCKPIT_UPDATE_ASSETS.map((name) => ({ name, size:100, url:base + name }));
assert.deepEqual(Object.keys(getReleaseUpdateAssets({ assets })), COCKPIT_UPDATE_ASSETS);
assert.throws(() => getReleaseUpdateAssets({ assets:assets.slice(1) }), /update-assets-missing/);
assert.throws(() => getReleaseUpdateAssets({ assets:assets.map((asset) => asset.name === 'main.js' ? { ...asset, url:'https://example.com/main.js' } : asset) }), /update-asset-url/);
assert.equal(normalizeUpdaterConfig({}).autoCheck, true);
assert.equal(normalizeUpdaterConfig({ autoInstall:true }).autoInstall, true);

const files = {
  'main.js':"const id='cockpit-dashboard'; module.exports = class Plugin {};",
  'styles.css':'.cockpit-dashboard-root { display:block; }',
  'manifest.json':JSON.stringify({ id:'cockpit-dashboard', version:'1.9.0', minAppVersion:'0.15.0', isDesktopOnly:true })
};
assert.equal(validateUpdatePackage(files, '1.9.0').version, '1.9.0');
assert.throws(() => validateUpdatePackage({ ...files, 'manifest.json':JSON.stringify({ id:'other', version:'1.9.0', minAppVersion:'0.15.0', isDesktopOnly:true }) }, '1.9.0'), /update-manifest-mismatch/);
assert.throws(() => validateUpdatePackage({ ...files, 'main.js':'broken' }, '1.9.0'), /update-main-invalid/);

const toolbar = fs.readFileSync(path.join(__dirname, '../src/toolbar-defs.js'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '../src/serverchan.js'), 'utf8');
assert.doesNotMatch(toolbar, /check-update/, 'Check for updates is not a toolbar button.');
assert.match(settings, /id:'updates'/, 'Software update has a dedicated settings section.');

(async () => {
  const fallback = await loadLatestReleaseForUpdate(async () => ({ status:200, text:files['manifest.json'] }));
  assert.equal(fallback.version, '1.9.0');
  assert.equal(fallback.assets.length, 3);
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cockpit-update-test-'));
  const directory = path.join(root, '.config', 'plugins', 'cockpit-dashboard');
  try {
    await fsp.mkdir(directory, { recursive:true });
    await Promise.all(COCKPIT_UPDATE_ASSETS.map((name) => fsp.writeFile(path.join(directory, name), 'old-' + name)));
    await fsp.writeFile(path.join(directory, 'data.json'), '{"keep":true}');
    await installValidatedUpdate({ app:{ vault:{ configDir:'.config', adapter:{ getBasePath:() => root } } } }, files, '1.9.0');
    assert.equal(await fsp.readFile(path.join(directory, 'main.js'), 'utf8'), files['main.js']);
    assert.equal(await fsp.readFile(path.join(directory, 'data.json'), 'utf8'), '{"keep":true}', 'Installing an update never replaces user data.');
    assert.equal(await fsp.readFile(path.join(directory, '.cockpit-update-backup', 'main.js'), 'utf8'), 'old-main.js');
  } finally { await fsp.rm(root, { recursive:true, force:true }); }
  console.log('Updater validation, installation, settings and toolbar checks passed');
})().catch((error) => { console.error(error); process.exit(1); });
