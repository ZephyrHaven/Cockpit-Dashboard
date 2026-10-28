// ai-tool-review.js — 将 Agent 写操作参数整理为可审阅的变更预览。

function clipAgentReviewText(value, limit = 12000) {
  const text = String(value ?? '');
  return { text:text.slice(0, limit), truncated:text.length > limit, length:text.length, fullText:text.length > limit ? text : '' };
}

function buildAgentToolReview(tool, language = 'zh-CN') {
  const en = language === 'en';
  const name = String(tool?.name || '');
  const args = tool?.args && typeof tool.args === 'object' && !Array.isArray(tool.args) ? tool.args : {};
  const sections = [];
  const add = (title, value, tone = '') => sections.push({ title, ...clipAgentReviewText(value), tone });
  const reviewedText = tool?.review && Object.prototype.hasOwnProperty.call(tool.review, 'before')
    && Object.prototype.hasOwnProperty.call(tool.review, 'after');
  const diff = reviewedText && typeof buildAgentUnifiedDiff === 'function'
    ? buildAgentUnifiedDiff(tool.review.before, tool.review.after, tool.review.path || args.path) : null;
  const addDiff = () => {
    if (diff?.changed) add(en ? 'File diff' : '文件差异', diff.text, 'diff');
    if (diff?.coarse) add(en ? 'Diff note' : '差异说明', en
      ? 'This large change is shown as a full replacement; unchanged lines inside the changed range may appear again.'
      : '变更范围较大，按整体替换显示；范围内未变化的行也可能重复出现。');
  };
  let target = '';
  let description = en ? 'Review the action before allowing it.' : '请确认本次操作的范围和内容。';

  if (name === 'ws_edit_file') {
    target = String(tool?.review?.path || args.path || '');
    description = en ? 'Replace exact text in a file that the Agent previously read.' : '替换 Agent 已读取文件中的精确文本。';
    addDiff();
    add(en ? 'Before' : '替换前', args.old_string, 'before');
    add(en ? 'After' : '替换后', args.new_string, 'after');
    if (args.replace_all === true) add(en ? 'Scope' : '范围', en ? 'Replace all matches' : '替换全部匹配项');
  } else if (name === 'ws_write_file') {
    target = String(tool?.review?.path || args.path || '');
    description = tool?.review?.created
      ? (en ? 'Create a new file.' : '新建文件。')
      : (en ? 'Overwrite the entire existing file.' : '完整覆盖现有文件。');
    addDiff();
    add(en ? 'New file content' : '拟写入内容', args.content);
  } else if (name === 'ws_run_command' || name === 'sys_run_command') {
    target = name === 'ws_run_command' ? String(tool?.workspaceRoot || '') : String(tool?.review?.cwd || '');
    description = en ? 'Run one command. Its effects may extend beyond this preview.' : '执行一条命令；实际影响可能超出此预览。';
    const command = name === 'ws_run_command' ? args.command
      : tool?.review?.command ? JSON.stringify([tool.review.command, ...(tool.review.args || [])], null, 2) : args.id;
    add(en ? 'Command' : '命令', command);
  } else {
    target = String(args.path || args.id || args.target || '');
    add(en ? 'Arguments' : '操作参数', JSON.stringify(args, null, 2));
  }
  return { description, target, sections };
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { clipAgentReviewText, buildAgentToolReview };
