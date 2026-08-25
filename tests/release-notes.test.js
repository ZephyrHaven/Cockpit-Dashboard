#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeGitHubRelease,
  getOnlineReleaseNotesModel,
  loadGitHubReleaseNotes,
  GITHUB_RELEASES_API_URL
} = require('../src/release-notes-core.js');

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
assert.equal(model.releases.length, 10, 'The online picker is capped to the ten latest published releases.');
assert.equal(model.selected.version, '1.11.0', 'The newest GitHub release is selected by default.');

model = getOnlineReleaseNotesModel(releases, '1.7.0');
assert.equal(model.selected.version, '1.7.0', 'Selecting a recent GitHub release changes the displayed version.');

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
  assert.equal(requestOptions.url, GITHUB_RELEASES_API_URL + '?per_page=10');
  assert.equal(requestOptions.headers.Accept, 'application/vnd.github+json');
  assert.equal(loaded.selected.version, '1.11.0', 'A successful GitHub API response becomes the online release model.');

  await assert.rejects(
    () => loadGitHubReleaseNotes(async () => ({ status:403, json:{ message:'rate limited' } })),
    /github-release-status-403/,
    'GitHub API errors are surfaced so the modal can offer retry and browser fallback.'
  );

  const releaseUi = fs.readFileSync(path.join(__dirname, '../src/release-notes.js'), 'utf8');
  const constants = fs.readFileSync(path.join(__dirname, '../src/constants.js'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  assert.match(releaseUi, /obsidian\.requestUrl/, 'The modal uses Obsidian requestUrl for cross-platform, CORS-free GitHub requests.');
  assert.match(releaseUi, /release-loading[\s\S]*release-error[\s\S]*release-retry/, 'Loading, failure, and retry states are visible in the modal.');
  assert.match(releaseUi, /MarkdownRenderer\.render/, 'GitHub release Markdown is rendered as formatted release content.');
  assert.match(releaseUi, /createEl\('select'[\s\S]*release-version-select/, 'Online releases remain available through a real select control.');
  assert.doesNotMatch(constants, /const RELEASE_HISTORY\s*=/, 'Release history is no longer bundled into the plugin.');
  assert.doesNotMatch(releaseUi, /RELEASE_HISTORY/, 'The modal has no local release-data fallback.');
  assert.equal(manifest.version, '1.3.0', 'The release manifest is bumped for the online release notes update.');
  assert.match(readme, /GitHub Releases[^\n]*在线|online[^\n]*GitHub Releases/i, 'README documents that update history is loaded online from GitHub Releases.');

  console.log('Release notes checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
