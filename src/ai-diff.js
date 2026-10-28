// ai-diff.js — Agent 文件写入前的有界行差异；大改动退化为完整替换展示。

function buildAgentUnifiedDiff(beforeValue, afterValue, pathValue, maxCells = 250000) {
  const before = String(beforeValue ?? '');
  const after = String(afterValue ?? '');
  const path = String(pathValue || 'file').replace(/[\r\n\0]/g, ' ');
  if (before === after) return { text:'', changed:false, coarse:false };
  const oldLines = before ? before.split('\n') : [];
  const newLines = after ? after.split('\n') : [];
  if (before.endsWith('\n')) oldLines.pop();
  if (after.endsWith('\n')) newLines.pop();
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix
    && oldLines[oldLines.length - suffix - 1] === newLines[newLines.length - suffix - 1]) suffix++;
  const removed = oldLines.slice(prefix, oldLines.length - suffix);
  const added = newLines.slice(prefix, newLines.length - suffix);
  const coarse = removed.length * added.length > maxCells;
  const changes = [];
  if (coarse) {
    removed.forEach((line) => changes.push('-' + line));
    added.forEach((line) => changes.push('+' + line));
  } else {
    const rows = Array.from({ length:removed.length + 1 }, () => new Uint16Array(added.length + 1));
    for (let i = removed.length - 1; i >= 0; i--) {
      for (let j = added.length - 1; j >= 0; j--) rows[i][j] = removed[i] === added[j]
        ? 1 + rows[i + 1][j + 1] : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
    let i = 0; let j = 0;
    while (i < removed.length || j < added.length) {
      if (i < removed.length && j < added.length && removed[i] === added[j]) { changes.push(' ' + removed[i]); i++; j++; }
      else if (i < removed.length && (j === added.length || rows[i + 1][j] >= rows[i][j + 1])) changes.push('-' + removed[i++]);
      else changes.push('+' + added[j++]);
    }
  }
  const contextBefore = oldLines.slice(Math.max(0, prefix - 3), prefix).map((line) => ' ' + line);
  const contextAfter = suffix ? oldLines.slice(oldLines.length - suffix, oldLines.length - suffix + 3).map((line) => ' ' + line) : [];
  const oldStart = oldLines.length ? Math.max(1, prefix - contextBefore.length + 1) : 0;
  const newStart = newLines.length ? Math.max(1, prefix - contextBefore.length + 1) : 0;
  const oldCount = contextBefore.length + removed.length + contextAfter.length;
  const newCount = contextBefore.length + added.length + contextAfter.length;
  const newlineNote = before.endsWith('\n') === after.endsWith('\n') ? [] : [
    `\\ Final newline: before ${before.endsWith('\n') ? 'yes' : 'no'}, after ${after.endsWith('\n') ? 'yes' : 'no'}`
  ];
  return {
    text:[`--- a/${path}`, `+++ b/${path}`, `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`, ...contextBefore, ...changes, ...contextAfter, ...newlineNote].join('\n'),
    changed:true,
    coarse
  };
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { buildAgentUnifiedDiff };
