// release-notes-core.js — GitHub Releases 在线更新记录的纯数据与请求逻辑。

const GITHUB_REPOSITORY = 'ZephyrHaven/Cockpit-Dashboard';
const GITHUB_RELEASES_LIMIT = 100;
const RELEASE_NOTES_CACHE_TTL_MS = 30 * 60 * 1000;
const GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/' + GITHUB_REPOSITORY + '/releases';
const GITHUB_RELEASES_URL = 'https://github.com/' + GITHUB_REPOSITORY + '/releases';

function normalizeReleaseVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function compareReleaseVersions(left, right) {
  const parse = (value) => normalizeReleaseVersion(value).split(/[+-]/)[0].split('.').map((part) => {
    const number = Number.parseInt(part, 10);
    return Number.isFinite(number) ? number : 0;
  });
  const a = parse(left); const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  return 0;
}

function findAvailableUpdate(model, currentVersion) {
  const releases = Array.isArray(model?.releases) ? model.releases.filter((release) => !release.prerelease) : [];
  return releases.sort((a, b) => compareReleaseVersions(b.version, a.version))[0] || null;
}

function normalizeGitHubRelease(rawRelease) {
  if (!rawRelease || typeof rawRelease !== 'object' || rawRelease.draft === true) return null;
  const version = normalizeReleaseVersion(rawRelease.tag_name);
  if (!version) return null;
  const publishedAt = String(rawRelease.published_at || rawRelease.created_at || '');
  const date = Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString().slice(0, 10) : '';
  const remoteUrl = String(rawRelease.html_url || '');
  const assets = Array.isArray(rawRelease.assets) ? rawRelease.assets.map((asset) => ({
    name:String(asset?.name || '').trim(),
    size:Number(asset?.size || 0),
    url:String(asset?.browser_download_url || '')
  })).filter((asset) => asset.name && asset.size > 0 && asset.url.startsWith('https://github.com/' + GITHUB_REPOSITORY + '/releases/download/')).slice(0, 20) : [];
  return {
    version,
    title:String(rawRelease.name || rawRelease.tag_name || version).trim().slice(0, 160),
    body:String(rawRelease.body || '').slice(0, 100000),
    date,
    url:remoteUrl.startsWith('https://github.com/' + GITHUB_REPOSITORY + '/releases/') ? remoteUrl : GITHUB_RELEASES_URL,
    prerelease:rawRelease.prerelease === true,
    assets
  };
}

function selectOnlineReleaseNotes(releases, requestedVersion) {
  const available = Array.isArray(releases)
    ? releases.filter((release) => release && normalizeReleaseVersion(release.version))
    : [];
  if (!available.length) return { releases:[], selected:null };
  const requested = normalizeReleaseVersion(requestedVersion);
  return {
    releases:available,
    selected:(requested && available.find((release) => release.version === requested)) || available[0]
  };
}

function getOnlineReleaseNotesModel(rawReleases, requestedVersion, limit = GITHUB_RELEASES_LIMIT) {
  if (!Array.isArray(rawReleases)) return { releases:[], selected:null };
  const count = Number.isFinite(limit) ? Math.max(1, Math.min(GITHUB_RELEASES_LIMIT, Math.floor(limit))) : GITHUB_RELEASES_LIMIT;
  const releases = rawReleases.map(normalizeGitHubRelease).filter(Boolean).slice(0, count);
  return selectOnlineReleaseNotes(releases, requestedVersion);
}

function getCachedReleaseNotesModel(cache, requestedVersion, nowValue = Date.now()) {
  if (!cache || !Number.isFinite(cache.fetchedAt)) return null;
  const age = Math.max(0, Number(nowValue) - cache.fetchedAt);
  if (age >= RELEASE_NOTES_CACHE_TTL_MS) return null;
  const model = selectOnlineReleaseNotes(cache.releases, requestedVersion);
  return model.selected ? model : null;
}

function createReleaseNotesCache(model, fetchedAt = Date.now()) {
  if (!model?.selected || !Array.isArray(model.releases)) return null;
  return { releases:model.releases, fetchedAt:Number(fetchedAt) };
}

async function loadGitHubReleaseNotes(requestUrl, requestedVersion) {
  if (typeof requestUrl !== 'function') throw new Error('github-release-request-unavailable');
  const response = await requestUrl({
    url:GITHUB_RELEASES_API_URL + '?per_page=' + GITHUB_RELEASES_LIMIT,
    method:'GET',
    headers:{
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'
    }
  });
  const status = Number(response?.status || 0);
  if (status < 200 || status >= 300) throw new Error('github-release-status-' + status);
  if (!Array.isArray(response?.json)) throw new Error('github-release-invalid-response');
  return getOnlineReleaseNotesModel(response.json, requestedVersion, GITHUB_RELEASES_LIMIT);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    GITHUB_REPOSITORY,
    GITHUB_RELEASES_LIMIT,
    RELEASE_NOTES_CACHE_TTL_MS,
    GITHUB_RELEASES_API_URL,
    GITHUB_RELEASES_URL,
    normalizeReleaseVersion,
    normalizeGitHubRelease,
    getOnlineReleaseNotesModel,
    selectOnlineReleaseNotes,
    getCachedReleaseNotesModel,
    createReleaseNotesCache,
    compareReleaseVersions,
    findAvailableUpdate,
    loadGitHubReleaseNotes
  };
}
