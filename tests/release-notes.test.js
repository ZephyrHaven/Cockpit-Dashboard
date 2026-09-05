#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeGitHubRelease,
  getOnlineReleaseNotesModel,
  selectOnlineReleaseNotes,
  getCachedReleaseNotesModel,
  loadGitHubReleaseNotes,
  compareReleaseVersions,
  findAvailableUpdate,
  GITHUB_RELEASES_API_URL,
  RELEASE_NOTES_CACHE_TTL_MS
} = require('../src/release-notes-core.js');

assert.equal(compareReleaseVersions('v1.10.0', '1.9.9'), 1);
assert.equal(compareReleaseVersions('1.8.7', '1.8.7'), 0);
assert.equal(compareReleaseVersions('1.8.6', '1.8.7'), -1);
assert.equal(findAvailableUpdate({ releases:[
  { version:'2.0.0', prerelease:true },
  { version:'1.9.0', prerelease:false },
  { version:'1.10.0', prerelease:false }
] }, '1.8.7').version, '1.10.0', 'Update checks choose the newest stable release.');

const releases = Array.from({ length:12 }, (_, index) => ({
  tag_name:'1.' + (11 - index) + '.0',
  name:index === 0 ? 'Online release notes' : '',
  body:'## Changes\n- Change ' + index,
  published_at:'2026-08-' + String(13 - index).padStart(2, '0') + 'T08:00:00Z',
  html_url:'https://github.com/ZephyrHaven/Cockpit-Dashboard/releases/tag/1.' + (11 - index) + '.0',
  draft:false,
  prerelease:false
}));

const normalized = normalizeGitHubRelease(releases[0]);
assert.equal(normalized.version, '1.11.0');
assert.equal(normalized.title, 'Online release notes');
assert.match(normalized.body, /Change 0/);
assert.equal(normalized.date, '2026-08-13');

let model = getOnlineReleaseNotesModel(releases);
assert.equal(model.releases.length, 12, 'The online picker keeps the complete published release history returned by GitHub.');
assert.equal(model.selected.version, '1.11.0', 'The newest GitHub release is selected by default.');

model = getOnlineReleaseNotesModel(releases, '1.7.0');
assert.equal(model.selected.version, '1.7.0', 'Selecting a recent GitHub release changes the displayed version.');

model = selectOnlineReleaseNotes(model.releases, '1.10.0');
assert.equal(model.releases.length, 12, 'Switching versions keeps the already-normalized release cache intact.');
assert.equal(model.selected.version, '1.10.0', 'Switching versions selects from cache without reparsing GitHub fields.');

model = getOnlineReleaseNotesModel([
  { ...releases[0], draft:true },
  { tag_name:'', published_at:'2026-08-13T08:00:00Z' },
  releases[1]
]);
assert.deepEqual(model.releases.map((release) => release.version), ['1.10.0'], 'Draft and malformed releases never enter the picker.');
assert.deepEqual(getOnlineReleaseNotesModel(null), { releases:[], selected:null }, 'An invalid API payload produces a stable empty model.');

(async () => {
  let requestOptions = null;
  const loaded = await loadGitHubReleaseNotes(async (options) => {
    requestOptions = options;
    return { status:200, json:releases };
  });
  assert.equal(requestOptions.url, GITHUB_RELEASES_API_URL + '?per_page=100');
  assert.equal(requestOptions.headers.Accept, 'application/vnd.github+json');
  assert.equal(loaded.selected.version, '1.11.0', 'A successful GitHub API response becomes the online release model.');

  const freshCache = { releases:loaded.releases, fetchedAt:1000 };
  assert.equal(
    getCachedReleaseNotesModel(freshCache, '1.10.0', 1000 + RELEASE_NOTES_CACHE_TTL_MS - 1).selected.version,
    '1.10.0',
    'A fresh plugin-level cache serves version changes without another request.'
  );
  assert.equal(
    getCachedReleaseNotesModel(freshCache, null, 1000 + RELEASE_NOTES_CACHE_TTL_MS + 1),
    null,
    'An expired cache is refreshed on the next modal open.'
  );

  await assert.rejects(
    () => loadGitHubReleaseNotes(async () => ({ status:403, json:{ message:'rate limited' } })),
    /github-release-status-403/,
    'GitHub API errors are surfaced so the modal can offer retry and browser fallback.'
  );

  const releaseUi = fs.readFileSync(path.join(__dirname, '../src/release-notes.js'), 'utf8');
  const constants = fs.readFileSync(path.join(__dirname, '../src/constants.js'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  assert.match(releaseUi, /obs\.requestUrl/, 'The modal uses requestUrl for cross-platform, CORS-free GitHub requests.');;
  assert.match(releaseUi, /_plugin\._releaseNotesCache/, 'Fetched releases are cached on the plugin instance across modal openings.');
  assert.match(releaseUi, /versionSelect\.onchange[\s\S]*selectOnlineReleaseNotes/, 'Version changes only select from the in-memory cache.');
  assert.doesNotMatch(releaseUi, /versionSelect\.onchange\s*=\s*\(\)\s*=>\s*\{[^}]*_loadReleases/, 'Changing a version never performs another network request.');
  assert.match(releaseUi, /release-loading[\s\S]*release-error[\s\S]*release-retry/, 'Loading, failure, and retry states are visible in the modal.');
  assert.match(releaseUi, /MarkdownRenderer\.render/, 'GitHub release Markdown is rendered as formatted release content.');
  assert.match(releaseUi, /createEl\('select'[\s\S]*release-version-select/, 'Online releases remain available through a real select control.');
  assert.doesNotMatch(constants, /const RELEASE_HISTORY\s*=/, 'Release history is no longer bundled into the plugin.');
  assert.doesNotMatch(releaseUi, /RELEASE_HISTORY/, 'The modal has no local release-data fallback.');
  // 版本随每次发布推进，测试不硬编码具体值：只要求是合法 semver，
  // 且不低于 AI 助手升级（1.6.0）时的基线，防止清单被意外回退或写坏。
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, 'The release manifest declares a valid semver version.');
  const [major, minor, patch] = manifest.version.split('.').map(Number);
  assert.equal(major * 10000 + minor * 100 + patch >= 1 * 10000 + 6 * 100 + 0, true, 'The manifest version never regresses below the AI assistant upgrade release.');
  assert.match(readme, /本地关键词|lexical|倒排索引/i, 'README documents the technical principles behind the assistant.');

  console.log('Release notes checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
