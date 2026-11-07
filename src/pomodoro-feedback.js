// 拖动刻度反馈：每次手势最多复用一个本机触觉进程，不传入任何用户内容。
function createPomodoroFeedback(element) {
  let child = null, ready = false, failed = false, pending = false;
  let lastTick = -Infinity, visualTimer = null, safetyTimer = null;
  let stopped = false;
  const nativeScript = 'ObjC.import("AppKit"); ObjC.import("Foundation"); var input=$.NSFileHandle.fileHandleWithStandardInput; $.NSFileHandle.fileHandleWithStandardOutput.writeData($("ready\\n").dataUsingEncoding($.NSUTF8StringEncoding)); while (true) {var data=input.availableData; if(!data.length) break; $.NSHapticFeedbackManager.defaultPerformer.performFeedbackPatternPerformanceTime(1, 1);}';
  function writeTick() {
    if (!ready || !child || child.stdin.destroyed || child.stdin.writableNeedDrain) return;
    try { child.stdin.write('t'); } catch (_) { stopNative(); }
  }
  function stopNative() {
    const previous = child;
    child = null; ready = false; pending = false;
    clearTimeout(safetyTimer); safetyTimer = null;
    if (previous) { try { previous.stdin.destroy(); previous.kill(); } catch (_) {} }
  }
  function nativeTick() {
    if (failed || stopped) return;
    if (child) { if (ready) writeTick(); else pending = true; return; }
    try {
      if (typeof process === 'undefined' || process.platform !== 'darwin' || typeof require !== 'function') return;
      // 固定程序与参数，无 Shell、无外部脚本、无用户字符串插值。
      const worker = require('child_process').spawn('/usr/bin/osascript', ['-l', 'JavaScript', '-e', nativeScript], { stdio:['pipe','pipe','ignore'] });
      child = worker; pending = true;
      worker.stdin.on('error', () => { if (child === worker) { failed = true; stopNative(); } });
      worker.on('error', () => { if (child === worker) { failed = true; stopNative(); } });
      worker.on('exit', () => { if (child === worker) { failed = true; stopNative(); } });
      worker.stdout.once('data', () => {
        if (child !== worker || stopped) return;
        ready = true;
        if (pending) { pending = false; writeTick(); }
      });
      safetyTimer = setTimeout(() => { failed = true; stopNative(); }, 30000);
    } catch (_) { failed = true; stopNative(); }
  }
  function tick() {
    if (stopped || Date.now() - lastTick < 80) return;
    lastTick = Date.now();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      element.classList.toggle('is-detent-a', !element.classList.contains('is-detent-a'));
      element.classList.add('is-detent');
      clearTimeout(visualTimer);
      visualTimer = setTimeout(() => element.classList.remove('is-detent'), 70);
    }
    if (typeof process !== 'undefined' && process.platform === 'darwin') nativeTick();
    else { try { if (typeof navigator !== 'undefined') navigator.vibrate?.(5); } catch (_) {} }
  }
  function end() {
    stopNative();
    clearTimeout(visualTimer); visualTimer = null;
    element.classList.remove('is-detent');
  }
  return { tick, end, destroy() { stopped = true; end(); } };
}
