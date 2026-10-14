// shell-runner.js — 用户 Shell 命令的跨平台调用方式（纯函数，不依赖宿主 API）。
// macOS 保持原有 zsh 登录 Shell 语义（读取 ~/.zprofile 中的 PATH）；
// Linux 优先使用用户的 $SHELL，回退 /bin/sh；Windows 使用 cmd.exe。

function cockpitShellInvocation(command, platform, env) {
  const os = platform || (typeof process !== 'undefined' ? process.platform : '');
  const vars = env || (typeof process !== 'undefined' ? process.env : {}) || {};
  const text = String(command == null ? '' : command);
  if (os === 'win32') {
    return { file: vars.ComSpec || vars.COMSPEC || 'cmd.exe', args: ['/d', '/s', '/c', text], label: 'cmd' };
  }
  if (os === 'darwin') return { file: '/bin/zsh', args: ['-lc', text], label: 'zsh' };
  const shell = typeof vars.SHELL === 'string' && /^\/[\w./-]+$/.test(vars.SHELL) ? vars.SHELL : '/bin/sh';
  const login = /\/(bash|zsh)$/.test(shell);
  return { file: shell, args: [login ? '-lc' : '-c', text], label: shell.split('/').pop() };
}

function cockpitShellLabel(platform) {
  return cockpitShellInvocation('', platform).label;
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { cockpitShellInvocation, cockpitShellLabel };
