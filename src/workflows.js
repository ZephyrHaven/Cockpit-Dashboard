// workflows.js — 自动化流程引擎：面向运维场景的多步骤流水线。
// 与定时任务的区别：任务 = 单个动作 + 计划；流程 = 有序步骤链 +
// 步骤条件（跳过/继续）+ 失败重试 + 输出传递（{{last_output}}）+ 结果路由（失败推送 / 运行日志落盘）。
// 触发方式：模块内手动运行；或作为定时任务的一种动作类型，从而复用时间计划与事件触发。
// 安全模型：Shell 步骤仅在桌面端可用，含 Shell 的流程必须确认信任后才能启用；
// 配置走共享 data.json 变更队列；运行历史保存在 data.json（每流程最多 20 条），不新建 Markdown。

const { execFile } = require('child_process');

const WORKFLOW_LIMITS = Object.freeze({
  maxWorkflows:30,
  maxSteps:12,
  runsKept:20,
  nameChars:80,
  idChars:64,
  textChars:6000,
  conditionChars:300,
  notePathChars:300,
  stepTimeoutMin:5,
  stepTimeoutMax:1800,
  retryMax:3,
  waitMax:600,
  outputTailChars:4000
});

const WORKFLOW_STEP_TYPES = ['shell', 'obsidian-command', 'toolbar-action', 'append-daily', 'create-todo', 'push', 'wait'];
const WORKFLOW_CONDITION_WHEN = ['always', 'last-ok', 'last-failed', 'last-output-contains', 'last-output-not-contains'];

function workflowId() {
  try { return 'wf-' + globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16); } catch (e) {}
  return 'wf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function workflowStepLabel(type, en = false) {
  const labels = {
    shell: en ? 'Shell' : 'Shell 命令',
    'obsidian-command': en ? 'App command' : '应用命令',
    'toolbar-action': en ? 'Toolbar' : 'Toolbar 动作',
    'append-daily': en ? 'Daily note' : '追加日记',
    'create-todo': en ? 'Todo' : '创建待办',
    'push': en ? 'Push' : '推送通知',
    'wait': en ? 'Wait' : '等待'
  };
  return labels[type] || type;
}

function normalizeWorkflows(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, WORKFLOW_LIMITS.maxWorkflows).map((item) => {
    const id = String(item?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, WORKFLOW_LIMITS.idChars);
    const name = String(item?.name || '').trim().slice(0, WORKFLOW_LIMITS.nameChars);
    if (!id || seen.has(id) || !name) return null;
    seen.add(id);
    const steps = (Array.isArray(item?.steps) ? item.steps : []).slice(0, WORKFLOW_LIMITS.maxSteps).map((step, index) => {
      const type = WORKFLOW_STEP_TYPES.includes(step?.type) ? step.type : null;
      if (!type) return null;
      const text = String(step?.text || '').slice(0, WORKFLOW_LIMITS.textChars);
      if (type !== 'wait' && !text.trim()) return null;
      const when = WORKFLOW_CONDITION_WHEN.includes(step?.condition?.when) ? step.condition.when : 'always';
      return {
        id:String(step?.id || 's' + (index + 1)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 's' + (index + 1),
        type, text,
        timeoutSeconds:type === 'shell' ? Math.max(WORKFLOW_LIMITS.stepTimeoutMin, Math.min(WORKFLOW_LIMITS.stepTimeoutMax, Math.round(Number(step?.timeoutSeconds) || 300))) : 300,
        continueOnError:step?.continueOnError === true,
        retryCount:type === 'shell' ? Math.max(0, Math.min(WORKFLOW_LIMITS.retryMax, Math.round(Number(step?.retryCount) || 0))) : 0,
        condition:{ when, text:String(step?.condition?.text || '').slice(0, WORKFLOW_LIMITS.conditionChars) },
        waitSeconds:type === 'wait' ? Math.max(1, Math.min(WORKFLOW_LIMITS.waitMax, Math.round(Number(step?.waitSeconds) || 5))) : 0
      };
    }).filter(Boolean);
    const hasShell = steps.some((step) => step.type === 'shell');
    const trusted = item?.trusted === true;
    const logNote = String(item?.logNote || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').slice(0, WORKFLOW_LIMITS.notePathChars);
    const createdAt = Number.isFinite(Date.parse(item?.createdAt || '')) ? new Date(item.createdAt).toISOString() : new Date().toISOString();
    const runs = (Array.isArray(item?.runs) ? item.runs : []).slice(0, WORKFLOW_LIMITS.runsKept).map((run) => ({
      at:Number.isFinite(Date.parse(run?.at || '')) ? new Date(run.at).toISOString() : new Date().toISOString(),
      trigger:['manual','schedule','event'].includes(run?.trigger) ? run.trigger : 'manual',
      status:['success','failed','aborted'].includes(run?.status) ? run.status : 'failed',
      durationMs:Math.max(0, Math.round(Number(run?.durationMs) || 0)),
      steps:Array.isArray(run?.steps) ? run.steps.slice(0, WORKFLOW_LIMITS.maxSteps) : []
    }));
    return {
      id, name, steps,
      enabled:item?.enabled === true && (!hasShell || trusted) && steps.length > 0,
      trusted,
      notifyOnFailure:item?.notifyOnFailure === true,
      logNote,
      runs,
      createdAt,
      updatedAt:Number.isFinite(Date.parse(item?.updatedAt || '')) ? new Date(item.updatedAt).toISOString() : createdAt,
      lastRunAt:Number.isFinite(Date.parse(item?.lastRunAt || '')) ? new Date(item.lastRunAt).toISOString() : '',
      lastStatus:['success','failed','aborted'].includes(item?.lastStatus) ? item.lastStatus : ''
    };
  }).filter(Boolean);
}

// 步骤内容插值：日期占位符 + 上一步输出尾部（自动截断，防止超长输出撑爆后续命令）。
function workflowInterpolate(text, context = {}) {
  const now = window.moment();
  const tail = String(context.lastOutput || '').trim().slice(-2000);
  return String(text || '')
    .replace(/\{date\}/g, now.format('YYYY-MM-DD'))
    .replace(/\{time\}/g, now.format('HH:mm'))
    .replace(/\{datetime\}/g, now.format('YYYY-MM-DD HH:mm'))
    .replace(/\{\{date\}\}/g, now.format('YYYY-MM-DD'))
    .replace(/\{\{time\}\}/g, now.format('HH:mm'))
    .replace(/\{\{datetime\}\}/g, now.format('YYYY-MM-DD HH:mm'))
    .replace(/\{\{last_output\}\}/g, tail);
}

function stepConditionAllows(step, lastResult) {
  const when = step?.condition?.when || 'always';
  if (when === 'always') return true;
  if (!lastResult) return false;
  const output = String(lastResult.output || '');
  const needle = String(step?.condition?.text || '');
  if (when === 'last-ok') return lastResult.ok === true;
  if (when === 'last-failed') return lastResult.ok !== true;
  if (when === 'last-output-contains') return !!needle && output.toLowerCase().includes(needle.toLowerCase());
  if (when === 'last-output-not-contains') return !needle || !output.toLowerCase().includes(needle.toLowerCase());
  return true;
}

class CockpitWorkflowEngine {
  constructor(plugin, dependencies = {}) {
    this.plugin = plugin;
    this.dependencies = { sleep:dependencies.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))) };
    this.running = new Set();
    this.listeners = new Set();
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() { this.listeners.forEach((listener) => { try { listener(); } catch (e) {} }); }
  async load() { return normalizeWorkflows((await this.plugin.loadData())?.workflows); }
  async save(workflows) {
    const normalized = normalizeWorkflows(workflows);
    await this.plugin.mutateData((data) => { data.workflows = normalized; });
    this.notify();
    return normalized;
  }
  async upsert(workflow) {
    const normalized = normalizeWorkflows([workflow])[0];
    if (!normalized) throw new Error('invalid-workflow');
    await this.plugin.mutateData((data) => {
      const list = normalizeWorkflows(data.workflows);
      const index = list.findIndex((item) => item.id === normalized.id);
      if (index >= 0) list[index] = normalized;
      else list.push(normalized);
      data.workflows = list.slice(0, WORKFLOW_LIMITS.maxWorkflows);
    });
    this.notify();
    return normalized;
  }
  async remove(id) {
    await this.plugin.mutateData((data) => { data.workflows = normalizeWorkflows(data.workflows).filter((item) => item.id !== id); });
    this.notify();
  }
  _actions() {
    const service = this.plugin.scheduledTasks;
    const unavailable = () => { throw new Error('action-layer-unavailable'); };
    return {
      appendDaily:(text) => service?.appendDailyNote?.(text) ?? unavailable(),
      createTodo:(text) => service?.createTodoFromTemplate?.(text) ?? unavailable(),
      push:(text) => service?.pushNotification?.(text) ?? unavailable(),
      toolbar:(id) => service?.runToolbarAction?.(id) ?? unavailable()
    };
  }
  _runShell(command, timeoutSeconds) {
    const timeout = Math.max(WORKFLOW_LIMITS.stepTimeoutMin, Math.min(WORKFLOW_LIMITS.stepTimeoutMax, Math.round(Number(timeoutSeconds) || 300)));
    return new Promise((resolve, reject) => {
      execFile('/bin/zsh', ['-lc', command], { timeout, maxBuffer:1024 * 1024, encoding:'utf8' }, (error, stdout, stderr) => {
        if (error) { error.message = (error.message || 'shell-failed') + (stderr ? ('\n' + String(stderr).slice(0, 500)) : ''); reject(error); return; }
        resolve(String(stdout || '') + (stderr ? '\n' + String(stderr) : ''));
      });
    });
  }
  async _executeStep(step, lastResult) {
    const text = workflowInterpolate(step.text, { lastOutput:lastResult?.output || '' });
    try {
      if (step.type === 'wait') {
        await this.dependencies.sleep(Math.max(1, Math.min(WORKFLOW_LIMITS.waitMax, step.waitSeconds || 1)) * 1000);
        return { ok:true, output:'' };
      }
      if (step.type === 'shell') {
        if (this.plugin.app.isMobile) throw new Error('shell-mobile-unsupported');
        const output = await this._runShell(text, step.timeoutSeconds);
        return { ok:true, output:String(output || '').slice(0, WORKFLOW_LIMITS.outputTailChars) };
      }
      if (step.type === 'obsidian-command') {
        const ok = this.plugin.app.commands.executeCommandById(text);
        if (ok === false) throw new Error('command-unavailable');
        return { ok:true, output:'' };
      }
      const actions = this._actions();
      if (step.type === 'toolbar-action') { const result = await actions.toolbar(text); return { ok:true, output:String(result?.stdout || '') }; }
      if (step.type === 'append-daily') { const result = await actions.appendDaily(text); return { ok:true, output:String(result || '') }; }
      if (step.type === 'create-todo') { const result = await actions.createTodo(text); return { ok:true, output:String(result || '') }; }
      if (step.type === 'push') { const result = await actions.push(text); return { ok:true, output:String(result || '') }; }
      throw new Error('unknown-step-type');
    } catch (error) {
      return { ok:false, output:'', error:String(error?.message || error).slice(0, WORKFLOW_LIMITS.outputTailChars) };
    }
  }
  async run(id, options = {}) {
    if (this.running.has(id)) return { ok:false, busy:true, status:'busy' };
    const workflow = (await this.load()).find((item) => item.id === id);
    if (!workflow) throw new Error('workflow-not-found');
    this.running.add(id);
    const startedAt = Date.now();
    const stepResults = [];
    let lastResult = null;
    let anyFailed = false;
    let aborted = false;
    try {
      for (const step of workflow.steps) {
        if (!stepConditionAllows(step, lastResult)) {
          stepResults.push({ id:step.id, type:step.type, status:'skipped' });
          continue;
        }
        const maxAttempts = 1 + Math.max(0, Math.min(WORKFLOW_LIMITS.retryMax, step.retryCount || 0));
        let attempt = 0;
        let result = null;
        while (attempt < maxAttempts) {
          attempt += 1;
          result = await this._executeStep(step, lastResult);
          if (result.ok) break;
          if (attempt < maxAttempts) await this.dependencies.sleep(1000);
        }
        lastResult = result;
        stepResults.push({ id:step.id, type:step.type, status:result.ok ? 'success' : 'failed', attempts:attempt, error:result.ok ? '' : String(result.error || '').slice(0, 300) });
        if (!result.ok) {
          anyFailed = true;
          if (!step.continueOnError) { aborted = true; break; }
        }
      }
    } finally {
      this.running.delete(id);
    }
    const status = aborted ? 'aborted' : (anyFailed ? 'failed' : 'success');
    const record = { at:new Date().toISOString(), trigger:['manual','schedule','event'].includes(options.trigger) ? options.trigger : 'manual', status, durationMs:Date.now() - startedAt, steps:stepResults };
    await this.plugin.mutateData((data) => {
      const list = normalizeWorkflows(data.workflows);
      const target = list.find((item) => item.id === id);
      if (!target) return;
      target.runs = [record, ...(target.runs || [])].slice(0, WORKFLOW_LIMITS.runsKept);
      target.lastRunAt = record.at;
      target.lastStatus = status;
      data.workflows = list;
    });
    // 结果路由：失败推送 + 运行摘要落盘。路由失败绝不改变运行结果本身。
    try {
      const latest = (await this.load()).find((item) => item.id === id);
      if ((status !== 'success') && latest?.notifyOnFailure) {
        await this.plugin.scheduledTasks?.pushNotification?.(`工作流「${latest.name}」${status === 'aborted' ? '中止' : '失败'}`);
      }
      if (latest?.logNote) await this._appendRunLog(latest, record);
    } catch (error) { console.warn('[Cockpit workflow] result routing failed', error); }
    this.notify();
    return { ok:status === 'success', status, record };
  }
  async _appendRunLog(workflow, record) {
    const vault = this.plugin.app.vault;
    const path = workflow.logNote;
    if (!path || !path.toLowerCase().endsWith('.md')) return;
    const summarySteps = record.steps.map((step) => `- ${workflowStepLabel(step.type)}: ${step.status}${step.error ? '（' + step.error.slice(0, 120) + '）' : ''}`).join('\n');
    const entry = `\n## ${window.moment().format('YYYY-MM-DD HH:mm')} · ${record.trigger} · ${record.status} (${Math.round(record.durationMs / 100) / 10}s)\n${summarySteps}\n`;
    const file = vault.getAbstractFileByPath?.(path);
    if (!file) {
      const folder = path.split('/').slice(0, -1).join('/');
      if (folder && !vault.getAbstractFileByPath?.(folder)) { try { await vault.createFolder(folder); } catch (e) {} }
      await vault.create(path, `# ${workflow.name} 运行日志\n` + entry);
      return;
    }
    const content = typeof vault.read === 'function' ? await vault.read(file) : '';
    await vault.modify(file, content + (content && !content.endsWith('\n') ? '\n' : '') + entry);
  }
}

// 运维巡检模板：Shell 产出标记 → 条件步骤断言标记 → 告警/记录。全部中性占位，无个人路径。
const WORKFLOW_TEMPLATES = [
  {
    name:'磁盘空间巡检',
    steps:[
      { type:'shell', text:"df -h / | awk 'NR==2{gsub(\"%\",\"\",$5); if ($5+0>=90) print \"DISK_FULL\"}'", timeoutSeconds:60 },
      { type:'push', condition:{ when:'last-output-contains', text:'DISK_FULL' }, text:'磁盘空间已超过 90%，请清理（{datetime}）' }
    ]
  },
  {
    name:'网站可达性检查',
    steps:[
      { type:'shell', text:"curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://example.com", timeoutSeconds:30 },
      { type:'push', condition:{ when:'last-output-not-contains', text:'200' }, text:'网站状态异常，请检查（{datetime}）' }
    ]
  },
  {
    name:'备份新鲜度检查',
    steps:[
      { type:'shell', text:"find /path/to/backup -name '*.bak' -mtime -1 | head -1", timeoutSeconds:60 },
      { type:'push', condition:{ when:'last-output-not-contains', text:'.bak' }, text:'备份超过 1 天未更新，请检查备份任务（{datetime}）' }
    ]
  },
  {
    name:'工作日开场准备',
    steps:[
      { type:'append-daily', text:'## {datetime} 开始工作' },
      { type:'create-todo', text:'查看今日日程与晨报' }
    ]
  }
];

// ===== 仪表盘模块与编辑器 =====

function workflowRunStatusText(status, en) {
  const labels = { success:[en ? 'Success' : '成功'], failed:[en ? 'Failed' : '失败'], aborted:[en ? 'Aborted' : '中止'], busy:[en ? 'Running' : '运行中'], skipped:[en ? 'Skipped' : '已跳过'] };
  return (labels[status] || labels.failed)[0];
}

function buildWorkflowsModule(view, root) {
  const plugin = view._plugin;
  const engine = plugin.workflows;
  if (!engine) return null;
  const en = view._lang() === 'en';
  const title = root.createDiv({ cls:PLUGIN_ID+'-section-title', text:view._t('sections.workflows') });
  title.dataset.section = 'workflows-title';
  const body = root.createDiv({ cls:PLUGIN_ID+'-workflows' });
  body.dataset.section = 'workflows-body';

  const render = async () => {
    body.empty();
    const workflows = await engine.load();
    const header = body.createDiv({ cls:PLUGIN_ID+'-workflows-header' });
    header.createDiv({ cls:PLUGIN_ID+'-workflows-caption', text:en ? 'Multi-step pipelines with conditions, retries and result routing. Trigger manually or via scheduled tasks (time/event).' : '多步骤流程：条件跳过、失败重试、结果路由。可手动运行，也可挂到定时任务按时间/事件触发。' });
    const add = header.createEl('button', { cls:PLUGIN_ID+'-workflow-add', text:en ? 'New workflow' : '新建流程', attr:{type:'button'} });
    add.onclick = () => new CockpitWorkflowEditorModal(view).open();
    if (!workflows.length) {
      body.createDiv({ cls:PLUGIN_ID+'-workflows-empty', text:en ? 'No workflows yet. Start from an inspection template (disk / website / backup freshness).' : '还没有流程。可以从巡检模板开始（磁盘 / 网站可达性 / 备份新鲜度）。' });
    }
    workflows.forEach((workflow) => {
      const row = body.createDiv({ cls:PLUGIN_ID+'-workflow-card' + (workflow.enabled ? '' : ' disabled') });
      const main = row.createDiv({ cls:PLUGIN_ID+'-workflow-main' });
      main.createDiv({ cls:PLUGIN_ID+'-workflow-name', text:workflow.name + ' · ' + workflow.steps.length + (en ? ' steps' : ' 步') });
      const lastText = workflow.lastRunAt
        ? workflowRunStatusText(workflow.lastStatus, en) + ' · ' + window.moment(workflow.lastRunAt).format('MM-DD HH:mm')
        : (en ? 'Never run' : '未运行');
      main.createDiv({ cls:PLUGIN_ID+'-workflow-meta', text:lastText + (workflow.enabled ? '' : ' · ' + (en ? 'Paused' : '已停用')) });
      const actions = row.createDiv({ cls:PLUGIN_ID+'-workflow-actions' });
      const history = actions.createEl('button', { text:en ? 'Logs' : '日志', attr:{type:'button'} });
      history.onclick = () => new CockpitWorkflowRunsModal(view, workflow.id).open();
      const edit = actions.createEl('button', { text:en ? 'Edit' : '编辑', attr:{type:'button'} });
      edit.onclick = () => new CockpitWorkflowEditorModal(view, workflow.id).open();
      const toggle = actions.createEl('button', { text:workflow.enabled ? (en ? 'Pause' : '停用') : (en ? 'Enable' : '启用'), attr:{type:'button'} });
      toggle.onclick = async () => { await engine.upsert({ ...workflow, enabled:!workflow.enabled, updatedAt:new Date().toISOString() }); };
      const run = actions.createEl('button', { text:engine.running.has(workflow.id) ? (en ? 'Running…' : '运行中…') : (en ? 'Run' : '立即运行'), attr:{type:'button'} });
      run.disabled = engine.running.has(workflow.id) || (view.app.isMobile && workflow.steps.some((step) => step.type === 'shell'));
      run.onclick = async () => {
        run.disabled = true; run.setText(en ? 'Running…' : '运行中…');
        try {
          const outcome = await engine.run(workflow.id, { trigger:'manual' });
          new obs.Notice(outcome.ok ? (en ? 'Workflow succeeded.' : '流程运行成功。') : (en ? 'Workflow finished with status: ' : '流程结束：') + workflowRunStatusText(outcome.status, en));
        } catch (error) {
          new obs.Notice((en ? 'Could not run workflow: ' : '无法运行流程：') + (error?.message || error));
        }
        render().catch(() => {});
      };
    });
  };
  view._workflowsUnsubscribe?.();
  view._workflowsUnsubscribe = engine.subscribe(() => render().catch((e) => console.warn('[Cockpit workflows UI]', e)));
  render().catch((e) => console.warn('[Cockpit workflows UI]', e));
  view._makeModuleCollapsible('workflows', title, body);
  return render;
}

class CockpitWorkflowRunsModal extends obs.Modal {
  constructor(view, workflowIdValue) { super(view.app); this._view = view; this._workflowId = workflowIdValue; }
  async onOpen() {
    const en = this._view._lang() === 'en';
    this.titleEl.setText(en ? 'Workflow run history' : '流程运行历史');
    makeCockpitModalDraggable(this, undefined, this.titleEl.textContent);
    const workflows = await this._view._plugin.workflows.load();
    const workflow = workflows.find((item) => item.id === this._workflowId);
    const list = this.contentEl.createDiv({ cls:PLUGIN_ID+'-workflow-runs' });
    if (!workflow?.runs?.length) { list.createDiv({ text:en ? 'No runs yet.' : '还没有运行记录。' }); return; }
    workflow.runs.forEach((run) => {
      const block = list.createDiv({ cls:PLUGIN_ID+'-workflow-run' + (run.status === 'success' ? ' ok' : ' bad') });
      block.createDiv({ cls:PLUGIN_ID+'-workflow-run-head', text:run.at.replace('T', ' ').slice(0, 16) + ' · ' + run.trigger + ' · ' + workflowRunStatusText(run.status, en) + ' · ' + (Math.round(run.durationMs / 100) / 10) + 's' });
      run.steps.forEach((step) => {
        block.createDiv({ cls:PLUGIN_ID+'-workflow-run-step', text:workflowStepLabel(step.type, en) + ' → ' + workflowRunStatusText(step.status, en) + (step.error ? ' · ' + step.error.slice(0, 120) : '') });
      });
    });
  }
}

class CockpitWorkflowEditorModal extends obs.Modal {
  constructor(view, workflowIdValue = null) { super(view.app); this._view = view; this._workflowId = workflowIdValue; }
  async onOpen() {
    const view = this._view;
    const plugin = view._plugin;
    const engine = plugin.workflows;
    const en = view._lang() === 'en';
    makeCockpitModalDraggable(this, undefined, en ? 'Workflow editor' : '流程编辑器');
    const all = await engine.load();
    const existing = this._workflowId ? all.find((item) => item.id === this._workflowId) : null;
    const draft = existing ? JSON.parse(JSON.stringify(existing)) : { id:workflowId(), name:'', enabled:false, trusted:false, notifyOnFailure:true, logNote:'', steps:[] };
    this.titleEl.setText(existing ? (en ? 'Edit workflow' : '编辑流程') : (en ? 'New workflow' : '新建流程'));
    const content = this.contentEl;
    const field = (label) => { const wrap = content.createDiv({ cls:PLUGIN_ID+'-scheduler-field' }); wrap.createDiv({ cls:PLUGIN_ID+'-scheduler-label', text:label }); return wrap; };

    const nameInput = field(en ? 'Name' : '名称').createEl('input', { attr:{ type:'text', maxlength:String(WORKFLOW_LIMITS.nameChars), placeholder:en ? 'e.g. Disk inspection' : '例如：磁盘空间巡检' } });
    nameInput.value = draft.name;

    // 模板快速开始：仅新建且尚无步骤时显示。
    const templateWrap = field(en ? 'Start from template' : '从模板开始');
    const templateSel = templateWrap.createEl('select');
    templateSel.createEl('option', { text:en ? '— choose —' : '— 选择 —', attr:{ value:'' } });
    WORKFLOW_TEMPLATES.forEach((template, index) => templateSel.createEl('option', { text:template.name, attr:{ value:String(index) } }));

    const stepsWrap = field(en ? 'Steps (top to bottom)' : '步骤（自上而下执行）');
    const stepsList = stepsWrap.createDiv({ cls:PLUGIN_ID+'-workflow-steps' });
    const addStep = stepsWrap.createEl('button', { text:en ? 'Add step' : '添加步骤', attr:{ type:'button' } });

    const rebuildSteps = () => {
      stepsList.empty();
      draft.steps.forEach((step, index) => {
        const row = stepsList.createDiv({ cls:PLUGIN_ID+'-workflow-step' });
        const head = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-head' });
        const typeSel = head.createEl('select');
        WORKFLOW_STEP_TYPES.forEach((type) => typeSel.createEl('option', { text:workflowStepLabel(type, en), attr:{ value:type } }));
        typeSel.value = step.type;
        typeSel.onchange = () => { step.type = typeSel.value; rebuildSteps(); };
        const move = (offset) => {
          const target = index + offset;
          if (target < 0 || target >= draft.steps.length) return;
          const swap = draft.steps[target]; draft.steps[target] = draft.steps[index]; draft.steps[index] = swap;
          rebuildSteps();
        };
        const up = head.createEl('button', { text:'↑', attr:{ type:'button', title:en ? 'Move up' : '上移' } });
        up.onclick = () => move(-1);
        const down = head.createEl('button', { text:'↓', attr:{ type:'button', title:en ? 'Move down' : '下移' } });
        down.onclick = () => move(1);
        const remove = head.createEl('button', { text:'✕', attr:{ type:'button', title:en ? 'Remove' : '删除' } });
        remove.onclick = () => { draft.steps.splice(index, 1); rebuildSteps(); };

        if (step.type === 'wait') {
          const waitRow = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-opts' });
          waitRow.createSpan({ text:en ? 'Seconds' : '秒数' });
          const waitInput = waitRow.createEl('input', { attr:{ type:'number', min:'1', max:String(WORKFLOW_LIMITS.waitMax) } });
          waitInput.value = String(step.waitSeconds || 5);
          waitInput.onchange = () => { step.waitSeconds = Math.max(1, Math.min(WORKFLOW_LIMITS.waitMax, Math.round(Number(waitInput.value) || 5))); };
        } else {
          const textArea = row.createEl('textarea', { attr:{ rows:step.type === 'shell' ? '3' : '2', maxlength:String(WORKFLOW_LIMITS.textChars), placeholder:step.type === 'shell' ? (en ? 'Shell command; use {{last_output}} to pass the previous step output' : 'Shell 命令；可用 {{last_output}} 引用上一步输出') : (en ? 'Content / target. Supports {date} {time} {datetime} and {{last_output}}' : '内容 / 目标，支持 {date} {time} {datetime} 与 {{last_output}}') } });
          textArea.value = step.text;
          textArea.onchange = () => { step.text = textArea.value; };
        }
        if (step.type === 'shell') {
          const shellRow = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-opts' });
          shellRow.createSpan({ text:en ? 'Timeout(s)' : '超时(秒)' });
          const timeoutInput = shellRow.createEl('input', { attr:{ type:'number', min:String(WORKFLOW_LIMITS.stepTimeoutMin), max:String(WORKFLOW_LIMITS.stepTimeoutMax) } });
          timeoutInput.value = String(step.timeoutSeconds || 300);
          timeoutInput.onchange = () => { step.timeoutSeconds = Math.max(WORKFLOW_LIMITS.stepTimeoutMin, Math.min(WORKFLOW_LIMITS.stepTimeoutMax, Math.round(Number(timeoutInput.value) || 300))); };
          shellRow.createSpan({ text:en ? 'Retries' : '重试' });
          const retryInput = shellRow.createEl('input', { attr:{ type:'number', min:'0', max:String(WORKFLOW_LIMITS.retryMax) } });
          retryInput.value = String(step.retryCount || 0);
          retryInput.onchange = () => { step.retryCount = Math.max(0, Math.min(WORKFLOW_LIMITS.retryMax, Math.round(Number(retryInput.value) || 0))); };
          const continueLabel = shellRow.createLabel({ text:en ? 'Continue on error' : '失败后继续' });
          const continueCheck = continueLabel.createEl('input', { attr:{ type:'checkbox' } });
          continueCheck.checked = step.continueOnError === true;
          continueCheck.onchange = () => { step.continueOnError = continueCheck.checked; };
        }
        const condRow = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-opts' });
        condRow.createSpan({ text:en ? 'Run when' : '执行条件' });
        const whenSel = condRow.createEl('select');
        [['always', en ? 'Always' : '总是'], ['last-ok', en ? 'Previous succeeded' : '上一步成功'], ['last-failed', en ? 'Previous failed' : '上一步失败'], ['last-output-contains', en ? 'Output contains' : '输出包含'], ['last-output-not-contains', en ? 'Output NOT contains' : '输出不包含']].forEach(([value, label]) => whenSel.createEl('option', { text:label, attr:{ value } }));
        whenSel.value = step.condition?.when || 'always';
        whenSel.onchange = () => { step.condition = { ...(step.condition || {}), when:whenSel.value }; rebuildSteps(); };
        if (['last-output-contains', 'last-output-not-contains'].includes(whenSel.value)) {
          const condInput = condRow.createEl('input', { attr:{ type:'text', maxlength:String(WORKFLOW_LIMITS.conditionChars), placeholder:en ? 'e.g. DISK_FULL' : '例如 DISK_FULL' } });
          condInput.value = step.condition?.text || '';
          condInput.onchange = () => { step.condition = { when:whenSel.value, text:condInput.value }; };
        }
      });
      if (!draft.steps.length) stepsList.createDiv({ cls:PLUGIN_ID+'-workflow-steps-empty', text:en ? 'No steps yet.' : '还没有步骤。' });
    };
    addStep.onclick = () => {
      if (draft.steps.length >= WORKFLOW_LIMITS.maxSteps) { new obs.Notice(en ? 'Step limit reached.' : '步骤数量已达上限。'); return; }
      draft.steps.push({ id:'s' + (draft.steps.length + 1), type:'shell', text:'', timeoutSeconds:300, continueOnError:false, retryCount:0, condition:{ when:'always', text:'' }, waitSeconds:5 });
      rebuildSteps();
    };
    templateSel.onchange = () => {
      const template = WORKFLOW_TEMPLATES[Number(templateSel.value)];
      if (!template || draft.steps.length) return;
      draft.steps = template.steps.map((step, index) => ({ id:'s' + (index + 1), timeoutSeconds:300, continueOnError:false, retryCount:0, condition:{ when:'always', text:'' }, waitSeconds:5, ...step }));
      if (existing ? false : !nameInput.value.trim()) nameInput.value = template.name;
      rebuildSteps();
    };
    rebuildSteps();

    const notifyLabel = field(en ? 'Push when failed' : '失败时推送').createDiv({ cls:PLUGIN_ID+'-workflow-check' });
    const notifyCheck = notifyLabel.createEl('input', { attr:{ type:'checkbox' } });
    notifyCheck.checked = draft.notifyOnFailure === true;
    notifyCheck.onchange = () => { draft.notifyOnFailure = notifyCheck.checked; };
    notifyLabel.createSpan({ text:en ? 'Send a push via enabled channels when the run fails' : '运行失败时通过已启用渠道推送提醒' });

    const logWrap = field(en ? 'Append run log to note (optional)' : '运行日志追加到笔记（可选）');
    const logInput = logWrap.createEl('input', { attr:{ type:'text', maxlength:String(WORKFLOW_LIMITS.notePathChars), placeholder:en ? 'e.g. Logs/Workflows.md' : '例如 Logs/Workflows.md' } });
    logInput.value = draft.logNote || '';

    const hasShell = () => draft.steps.some((step) => step.type === 'shell');
    const trustLabel = field(en ? 'Shell trust' : 'Shell 信任确认').createDiv({ cls:PLUGIN_ID+'-workflow-check' });
    const trustCheck = trustLabel.createEl('input', { attr:{ type:'checkbox' } });
    trustCheck.checked = draft.trusted === true;
    trustCheck.onchange = () => { draft.trusted = trustCheck.checked; };
    trustLabel.createSpan({ text:en ? 'I confirm these shell commands are safe to run on this machine (required to enable shell steps)' : '我确认这些 Shell 命令在本机运行是安全的（含 Shell 的流程必须确认后才能启用）' });

    const enableLabel = field(en ? 'Enabled' : '启用').createDiv({ cls:PLUGIN_ID+'-workflow-check' });
    const enableCheck = enableLabel.createEl('input', { attr:{ type:'checkbox' } });
    enableCheck.checked = draft.enabled === true;
    const refreshEnable = () => { enableCheck.disabled = hasShell() && !trustCheck.checked; };
    enableCheck.onchange = () => { draft.enabled = enableCheck.checked; };
    trustCheck.onchange = () => { draft.trusted = trustCheck.checked; refreshEnable(); };

    const save = content.createEl('button', { cls:PLUGIN_ID+'-scheduler-save', text:en ? 'Save workflow' : '保存流程', attr:{ type:'button' } });
    save.onclick = async () => {
      const name = nameInput.value.trim();
      if (!name) { new obs.Notice(en ? 'Please enter a name.' : '请输入流程名称。'); return; }
      if (!draft.steps.length) { new obs.Notice(en ? 'Add at least one step.' : '请至少添加一个步骤。'); return; }
      if (hasShell() && !trustCheck.checked) { new obs.Notice(en ? 'Confirm shell trust before saving shell steps.' : '包含 Shell 步骤时请先勾选信任确认。'); return; }
      draft.name = name;
      draft.enabled = enableCheck.checked && (!hasShell() || trustCheck.checked);
      draft.logNote = logInput.value.trim();
      draft.updatedAt = new Date().toISOString();
      await engine.upsert(draft);
      new obs.Notice(en ? 'Workflow saved.' : '流程已保存。');
      this.close();
    };
    refreshEnable();
  }
}

function createWorkflowEngine(plugin, dependencies = {}) {
  return new CockpitWorkflowEngine(plugin, dependencies);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    WORKFLOW_LIMITS, WORKFLOW_STEP_TYPES, WORKFLOW_CONDITION_WHEN, WORKFLOW_TEMPLATES,
    workflowId, workflowStepLabel, normalizeWorkflows, workflowInterpolate,
    stepConditionAllows, CockpitWorkflowEngine, createWorkflowEngine
  };
}
