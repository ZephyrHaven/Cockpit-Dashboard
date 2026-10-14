// build-fallbacks.js — 原生压缩引擎（esbuild / lightningcss）不可用时的纯 JS 兜底。
// 典型场景：node_modules 是在另一种平台/架构上安装的（例如 macOS 装好后在 Linux 虚拟机里构建）。
// 只服务 build.js：二维码依赖的 CommonJS 打包、以及保守的 CSS 压缩。
const fs = require('fs');
const path = require('path');

// 极简 CommonJS 打包器：只解析字面量 require()，足够打包 qrcode/lib/browser 与 jsqr。
function bundleCommonJs(entrySource, resolveDir, globalName) {
  const modules = [];
  const ids = new Map();
  const tryFile = (p) => {
    for (const c of [p, p + '.js', p + '.json', path.join(p, 'index.js')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
  };
  const resolveFrom = (dir, request) => {
    if (request.startsWith('.') || request.startsWith('/')) return tryFile(path.resolve(dir, request));
    const parts = request.split('/');
    const pkgName = request.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    const subPath = request.slice(pkgName.length);
    for (let d = dir; ; d = path.dirname(d)) {
      const pkgDir = path.join(d, 'node_modules', pkgName);
      if (fs.existsSync(pkgDir)) {
        if (subPath) return tryFile(path.join(pkgDir, subPath));
        const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
        return tryFile(path.join(pkgDir, (typeof pkg.browser === 'string' && pkg.browser) || pkg.main || 'index.js'));
      }
      if (path.dirname(d) === d) throw new Error('无法解析依赖 ' + request + '（来自 ' + dir + '）');
    }
  };
  const add = (file, source) => {
    const key = file || '<entry>';
    if (ids.has(key)) return ids.get(key);
    const id = modules.length;
    ids.set(key, id);
    modules.push(null);
    const code = source != null ? source : fs.readFileSync(file, 'utf8');
    const dir = file ? path.dirname(file) : resolveDir;
    const deps = {};
    code.replace(/require\(\s*['"]([^'"]+)['"]\s*\)/g, (match, request) => {
      const resolved = resolveFrom(dir, request);
      if (resolved) deps[request] = add(resolved);
      return match;
    });
    const body = file && file.endsWith('.json') ? 'module.exports=' + code : code;
    modules[id] = '[function(module,exports,require){' + body + '\n},' + JSON.stringify(deps) + ']';
    return id;
  };
  const entry = add(null, entrySource);
  return 'var ' + globalName + '=(function(){var M=[' + modules.join(',\n') + '];var C={};'
    + 'function R(i){if(C[i])return C[i].exports;var m=C[i]={exports:{}};'
    + 'M[i][0].call(m.exports,m,m.exports,function(n){if(!(n in M[i][1]))throw new Error("missing module "+n);return R(M[i][1][n]);});'
    + 'return m.exports;}return R(' + entry + ');})();';
}

// 保守 CSS 压缩：去注释、合并空白、去掉 { } ; , 两侧空格。不改写任何值或选择器语义。
function minifyCssConservative(css) {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && css[j] !== ch) { if (css[j] === '\\') j++; j++; }
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (/\s/.test(ch)) {
      while (i < n && /\s/.test(css[i])) i++;
      const prev = out[out.length - 1];
      const next = css[i];
      if (prev && next && !'{};,'.includes(prev) && !'{};,'.includes(next)) out += ' ';
      continue;
    }
    if (ch === '}' && out[out.length - 1] === ';') out = out.slice(0, -1);
    out += ch;
    i++;
  }
  return out.trim();
}

module.exports = { bundleCommonJs, minifyCssConservative };
