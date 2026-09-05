// updater-core.js — 更新包白名单、校验与可回滚的本地安装。

const COCKPIT_UPDATE_ASSETS = Object.freeze(['main.js', 'styles.css', 'manifest.json']);
const COCKPIT_UPDATE_PLUGIN_ID = 'cockpit-dashboard';
const COCKPIT_UPDATE_REPOSITORY = 'ZephyrHaven/Cockpit-Dashboard';
const COCKPIT_UPDATE_LIMITS = Object.freeze({ 'main.js':12 * 1024 * 1024, 'styles.css':5 * 1024 * 1024, 'manifest.json':64 * 1024 });
const COCKPIT_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
function normalizeUpdaterVersion(value) { return String(value || '').trim().replace(/^v/i, ''); }
function isTrustedUpdateAssetUrl(value) {
  const base = 'https://github.com/' + COCKPIT_UPDATE_REPOSITORY + '/releases/';
  return String(value || '').startsWith(base + 'download/') || String(value || '').startsWith(base + 'latest/download/');
}

function normalizeUpdaterConfig(raw) {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    autoCheck:value.autoCheck !== false,
    autoInstall:value.autoInstall === true,
    lastCheckedAt:Number.isFinite(Number(value.lastCheckedAt)) ? Number(value.lastCheckedAt) : 0,
    lastNotifiedVersion:normalizeUpdaterVersion(value.lastNotifiedVersion),
    installedVersion:normalizeUpdaterVersion(value.installedVersion)
  };
}

function getReleaseUpdateAssets(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const selected = {};
  for (const name of COCKPIT_UPDATE_ASSETS) {
    const matches = assets.filter((asset) => asset?.name === name);
    if (matches.length !== 1) throw new Error('update-assets-missing');
    const asset = matches[0];
    if (asset.size != null && (!Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > COCKPIT_UPDATE_LIMITS[name])) throw new Error('update-asset-size');
    if (!isTrustedUpdateAssetUrl(asset.url)) throw new Error('update-asset-url');
    selected[name] = asset;
  }
  return selected;
}

async function loadLatestReleaseForUpdate(requestUrl) {
  if (typeof requestUrl !== 'function') throw new Error('update-request-unavailable');
  const base = 'https://github.com/' + COCKPIT_UPDATE_REPOSITORY + '/releases/latest/download/';
  const response = await requestUrl({ url:base + 'manifest.json', method:'GET', headers:{ Accept:'application/json' } });
  if (Number(response?.status || 0) < 200 || Number(response?.status || 0) >= 300 || typeof response.text !== 'string') throw new Error('update-download-failed');
  let manifest;
  try { manifest = JSON.parse(response.text); } catch (error) { throw new Error('update-manifest-invalid'); }
  const version = normalizeUpdaterVersion(manifest.version);
  if (manifest.id !== COCKPIT_UPDATE_PLUGIN_ID || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('update-manifest-invalid');
  return {
    version, title:'v' + version, body:'', date:'', prerelease:false,
    url:'https://github.com/' + COCKPIT_UPDATE_REPOSITORY + '/releases/latest',
    assets:COCKPIT_UPDATE_ASSETS.map((name) => ({ name, size:null, url:base + name }))
  };
}

function validateUpdatePackage(files, expectedVersion) {
  if (!files || typeof files !== 'object') throw new Error('update-package-invalid');
  for (const name of COCKPIT_UPDATE_ASSETS) {
    if (typeof files[name] !== 'string') throw new Error('update-package-missing');
    const size = Buffer.byteLength(files[name], 'utf8');
    if (size < 1 || size > COCKPIT_UPDATE_LIMITS[name]) throw new Error('update-package-size');
  }
  let manifest;
  try { manifest = JSON.parse(files['manifest.json']); } catch (error) { throw new Error('update-manifest-invalid'); }
  const version = normalizeUpdaterVersion(manifest.version);
  if (manifest.id !== COCKPIT_UPDATE_PLUGIN_ID || version !== normalizeUpdaterVersion(expectedVersion) || manifest.isDesktopOnly !== true) throw new Error('update-manifest-mismatch');
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('update-version-invalid');
  if (typeof manifest.minAppVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.minAppVersion)) throw new Error('update-manifest-invalid');
  if (!files['main.js'].includes('module.exports') || !files['main.js'].includes(COCKPIT_UPDATE_PLUGIN_ID)) throw new Error('update-main-invalid');
  if (!files['styles.css'].includes('.' + COCKPIT_UPDATE_PLUGIN_ID)) throw new Error('update-styles-invalid');
  return { manifest, version };
}

function resolvePluginInstallDirectory(plugin) {
  const path = require('path');
  const adapter = plugin?.app?.vault?.adapter;
  if (!adapter || typeof adapter.getBasePath !== 'function') throw new Error('update-path-unavailable');
  const base = path.resolve(adapter.getBasePath());
  const configDir = String(plugin.app.vault.configDir || '').replace(/\\/g, '/');
  if (!configDir || configDir.includes('..') || configDir.startsWith('/')) throw new Error('update-path-invalid');
  const pluginsRoot = path.resolve(base, configDir, 'plugins');
  const directory = path.resolve(pluginsRoot, COCKPIT_UPDATE_PLUGIN_ID);
  if (path.dirname(directory) !== pluginsRoot) throw new Error('update-path-invalid');
  return directory;
}

async function installValidatedUpdate(plugin, files, expectedVersion) {
  validateUpdatePackage(files, expectedVersion);
  const fs = require('fs').promises; const path = require('path');
  const directory = resolvePluginInstallDirectory(plugin);
  const staging = path.join(directory, '.cockpit-update-staging');
  const backup = path.join(directory, '.cockpit-update-backup');
  await fs.mkdir(staging, { recursive:true }); await fs.mkdir(backup, { recursive:true });
  const originals = {};
  try {
    for (const name of COCKPIT_UPDATE_ASSETS) {
      const target = path.join(directory, name); const staged = path.join(staging, name);
      originals[name] = await fs.readFile(target);
      await fs.writeFile(path.join(backup, name), originals[name]);
      await fs.writeFile(staged, files[name], 'utf8');
    }
    for (const name of COCKPIT_UPDATE_ASSETS) await fs.copyFile(path.join(staging, name), path.join(directory, name));
  } catch (error) {
    await Promise.all(Object.entries(originals).map(([name, content]) => fs.writeFile(path.join(directory, name), content).catch(() => {})));
    throw error;
  } finally {
    await fs.rm(staging, { recursive:true, force:true }).catch(() => {});
  }
  return { version:normalizeUpdaterVersion(expectedVersion), backup };
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { COCKPIT_UPDATE_ASSETS, COCKPIT_UPDATE_LIMITS, COCKPIT_UPDATE_CHECK_INTERVAL_MS, normalizeUpdaterConfig, getReleaseUpdateAssets, loadLatestReleaseForUpdate, validateUpdatePackage, resolvePluginInstallDirectory, installValidatedUpdate };
}
