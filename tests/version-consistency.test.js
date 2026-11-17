#!/usr/bin/env node
// version-consistency.test.js — 文档与清单的版本号必须与 manifest.json 一致，防止档案/README 漂移。
// manifest.json 是唯一版本来源；package.json / package-lock.json / README 头部的版本必须跟它对齐。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const version = manifest.version;

assert.match(version, /^\d+\.\d+\.\d+$/, 'manifest.json declares a valid semver version.');

// package.json / package-lock.json 顶层版本对齐（release-notes.test.js 已覆盖核心三项，
// 这里再锁一次，避免版本来源改到别处时出现盲区）。
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, version, 'package.json version matches manifest.json.');

// README 头部若声明版本（形如 "版本: vX.Y.Z" 或 "Version: X.Y.Z"），必须与 manifest 一致。
const versionLine = /\*\*(?:版本|Version)\*\*[:：]\s*v?(\d+\.\d+\.\d+)/i;
for (const file of ['README.md', 'README.zh-CN.md']) {
  const text = read(file);
  const match = text.match(versionLine);
  if (match) {
    assert.equal(match[1], version, file + ' 头部版本号必须与 manifest.json (' + version + ') 一致。');
  }
}

// AGENTS.md / CLAUDE.md 为本地档案（gitignored），存在时也做一致性校验，缺失则跳过。
for (const file of ['AGENTS.md', 'CLAUDE.md']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  const match = text.match(versionLine);
  if (match) {
    assert.equal(match[1], version, file + ' 头部版本号必须与 manifest.json (' + version + ') 一致。');
  }
}

console.log('Version consistency checks passed');
