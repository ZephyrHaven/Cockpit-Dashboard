// release-notes-core.js — GitHub Releases 在线更新记录的纯数据与请求逻辑。

const GITHUB_REPOSITORY = 'ZephyrHaven/Cockpit-Dashboard';
const GITHUB_RELEASES_LIMIT = 10;
const GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/' + GITHUB_REPOSITORY + '/releases';
const GITHUB_RELEASES_URL = 'https://github.com/' + GITHUB_REPOSITORY + '/releases';

function normalizeReleaseVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function normalizeGitHubRelease(rawRelease) {
  if (!rawRelease || typeof rawRelease !== 'object' || rawRelease.draft === true) return null;
  const version = normalizeReleaseVersion(rawRelease.tag_name);
  if (!version) return null;
  const publishedAt = String(rawRelease.published_at || rawRelease.created_at || '');
  const date = Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString().slice(0, 10) : '';
  const remoteUrl = String(rawRelease.html_url || '');
  return {
    version,
    title:String(rawRelease.name || rawRelease.tag_name || version).trim().slice(0, 160),
    body:String(rawRelease.body || '').slice(0, 100000),
    date,
    url:remoteUrl.startsWith('https://github.com/' + GITHUB_REPOSITORY + '/releases/') ? remoteUrl : GITHUB_RELEASES_URL,
    prerelease:rawRelease.prerelease === true
  };
}

function getOnlineReleaseNotesModel(rawReleases, requestedVersion, limit = GITHUB_RELEASES_LIMIT) {
  if (!Array.isArray(rawReleases)) return { releases:[], selected:null };
  const count = Number.isFinite(limit) ? Math.max(1, Math.min(GITHUB_RELEASES_LIMIT, Math.floor(limit))) : GITHUB_RELEASES_LIMIT;
  const releases = rawReleases.map(normalizeGitHubRelease).filter(Boolean).slice(0, count);
  if (!releases.length) return { releases:[], selected:null };
  const requested = normalizeReleaseVersion(requestedVersion);
  return {
    releases,
    selected:(requested && releases.find((release) => release.version === requested)) || releases[0]
  };
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
    GITHUB_RELEASES_API_URL,
    GITHUB_RELEASES_URL,
    normalizeReleaseVersion,
    normalizeGitHubRelease,
    getOnlineReleaseNotesModel,
    loadGitHubReleaseNotes
  };
}
