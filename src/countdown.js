// countdown.js — 可配置倒计时、阈值提醒与多渠道通知模块。

function countdownDateTimeLocalValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function countdownThresholdLabel(threshold, language = 'zh-CN') {
  const en = language === 'en';
  if (threshold.mode === 'percent') return en ? `${threshold.value}% of total remaining` : `剩余总时长的 ${threshold.value}%`;
  const units = en ? { minutes:'min', hours:'hr', days:'day' } : { minutes:'分钟', hours:'小时', days:'天' };
  return en ? `${threshold.value} ${units[threshold.unit]} remaining` : `剩余 ${threshold.value} ${units[threshold.unit]}`;
}

function countdownMessage(event, language = 'zh-CN') {
  const en = language === 'en';
  const target = new Date(event.countdown.targetAt).toLocaleString(en ? 'en-US' : 'zh-CN', { hour12:false });
  if (event.kind === 'finished') return {
    title:en ? `Countdown finished: ${event.countdown.name}` : `倒计时结束：${event.countdown.name}`,
    body:en ? `The target time was ${target}.` : `目标时间：${target}`
  };
  const remaining = formatCountdownRemaining(event.state.remainingMs, language);
  return {
    title:en ? `Countdown reminder: ${event.countdown.name}` : `倒计时提醒：${event.countdown.name}`,
    body:en
      ? `${remaining} remaining · ${event.state.progress}% elapsed · target ${target}`
      : `剩余 ${remaining} · 已经过 ${event.state.progress}% · 目标时间 ${target}`
  };
}

function countdownEmailRuleMessage(rule, event, language = 'zh-CN') {
  const fallback = countdownMessage(event, language);
  const target = new Date(event.countdown.targetAt).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', { hour12:false });
  const values = {
    countdown:event.countdown.name, target,
    remaining:formatCountdownRemaining(event.state.remainingMs, language),
    progress:String(event.state.progress)
  };
  const render = (template, fallbackValue) => {
    const source = String(template || fallbackValue || '');
    return source.replace(/\{(countdown|target|remaining|progress)\}/g, (_match, key) => values[key]);
  };
  return { subject:render(rule.subject, fallback.title), body:render(rule.body, fallback.body) };
}

function countdownAutomationDraft(countdown, language = 'zh-CN') {
  const en = language === 'en';
  return {
    id:typeof scheduledTaskId === 'function' ? scheduledTaskId() : 'task-' + Date.now().toString(36),
    name:countdown.name + (en ? ' finished' : '结束后'),
    kind:'workflow', command:'', enabled:true, trusted:false,
    schedule:{type:'event',event:'countdown-finished',sourceId:countdown.id,sourceLabel:countdown.name},
    missedPolicy:'run-once', timeoutSeconds:300, createdAt:new Date().toISOString()
  };
}

class CountdownService {
  constructor(plugin) { this.plugin = plugin; this.listeners = new Set(); this.started = false; this.ticking = false; this.timer = null; }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() { this.listeners.forEach((listener) => { try { listener(); } catch (e) {} }); }
  async load() { return normalizeCountdowns((await this.plugin.loadData() || {}).countdowns); }
  async upsert(raw) {
    const countdown = normalizeCountdown(raw);
    if (!countdown) throw new Error('invalid-countdown');
    await this.plugin.mutateData((data) => {
      const list = normalizeCountdowns(data.countdowns);
      const index = list.findIndex((item) => item.id === countdown.id);
      if (index >= 0) {
        const previous = list[index];
        const before = JSON.stringify({ startAt:previous.startAt, targetAt:previous.targetAt, thresholds:previous.thresholds, channelIds:previous.channelIds, emailRules:previous.emailRules, localNotification:previous.localNotification, notifyAtEnd:previous.notifyAtEnd });
        const after = JSON.stringify({ startAt:countdown.startAt, targetAt:countdown.targetAt, thresholds:countdown.thresholds, channelIds:countdown.channelIds, emailRules:countdown.emailRules, localNotification:countdown.localNotification, notifyAtEnd:countdown.notifyAtEnd });
        if (before !== after) countdown.deliveries = {};
        else countdown.deliveries = previous.deliveries;
        list[index] = countdown;
      } else list.push(countdown);
      data.countdowns = normalizeCountdowns(list);
    });
    this.notify(); return countdown;
  }
  async remove(id) {
    let removed = false;
    await this.plugin.mutateData((data) => {
      const list = normalizeCountdowns(data.countdowns); const next = list.filter((item) => item.id !== id);
      removed = next.length !== list.length; data.countdowns = next;
    });
    if (removed) this.notify(); return removed;
  }
  async toggle(id, enabled) {
    let updated = null;
    await this.plugin.mutateData((data) => {
      const list = normalizeCountdowns(data.countdowns); const item = list.find((entry) => entry.id === id);
      if (item) { item.enabled = !!enabled; updated = { ...item }; }
      data.countdowns = list;
    });
    if (updated) this.notify(); return updated;
  }
  async _claim(event) {
    const requested = [
      ...(event.eventPending ? ['event'] : []),
      ...(event.localPending ? ['local'] : []),
      ...event.pendingChannelIds,
      ...event.pendingEmailRules.map((rule) => 'smtp:' + rule.id)
    ];
    const claimed = new Set();
    if (!requested.length) return claimed;
    await this.plugin.mutateData((data) => {
      const list = normalizeCountdowns(data.countdowns); const item = list.find((entry) => entry.id === event.countdown.id);
      if (!item) return;
      const records = item.deliveries[event.eventKey] || (item.deliveries[event.eventKey] = {});
      const at = new Date().toISOString();
      requested.forEach((channelId) => {
        if (records[channelId]) return;
        records[channelId] = { ok:false, attempts:1, at, error:'sending' };
        claimed.add(channelId);
      });
      data.countdowns = list;
    });
    return claimed;
  }
  async _record(event, outcomes) {
    await this.plugin.mutateData((data) => {
      const list = normalizeCountdowns(data.countdowns); const item = list.find((entry) => entry.id === event.countdown.id);
      if (!item) return;
      item.deliveries[event.eventKey] = item.deliveries[event.eventKey] || {};
      outcomes.forEach(({ channelId, ok, error }) => {
        const previous = item.deliveries[event.eventKey][channelId];
        item.deliveries[event.eventKey][channelId] = { ok, attempts:Math.max(1, Number(previous?.attempts) || 1), at:new Date().toISOString(), error:String(error || '').slice(0, 240) };
      });
      data.countdowns = list;
    });
  }
  async _sendLocal(message) {
    new obs.Notice(message.title + '\n' + message.body, 10000);
    try {
      if (typeof Notification !== 'undefined') {
        let permission = Notification.permission;
        if (permission === 'default') permission = await Notification.requestPermission();
        if (permission === 'granted') new Notification(message.title, { body:message.body });
      }
    } catch (e) {}
  }
  async tick(nowValue = Date.now()) {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const [items, config, smtpAccounts] = await Promise.all([this.load(), this.plugin.serverChan?.getConfig?.(), this.plugin.smtpMail?.listAccounts?.() || []]);
      const enabledChannels = Object.keys(config?.channels || {}).filter((id) => config.channels[id]?.enabled && COUNTDOWN_CHANNEL_IDS.includes(id));
      const enabledAccountIds = smtpAccounts.filter((account) => account.enabled).map((account) => account.id);
      let changed = false;
      for (const item of items) {
        let event = dueCountdownEvent(item, nowValue, enabledChannels, enabledAccountIds);
        if (!event) continue;
        const claimed = await this._claim(event);
        if (!claimed.size) continue;
        event = {
          ...event,
          eventPending:claimed.has('event'),
          localPending:claimed.has('local'),
          pendingChannelIds:event.pendingChannelIds.filter((channelId) => claimed.has(channelId)),
          pendingEmailRules:event.pendingEmailRules.filter((rule) => claimed.has('smtp:' + rule.id))
        };
        changed = true;
        const language = (await this.plugin.loadData() || {}).language || DEFAULT_LANG;
        const message = countdownMessage(event, language);
        const outcomes = [];
        if (event.eventPending) {
          cockpitEmit('countdown-' + event.kind, {
            countdownId:event.countdown.id, countdownName:event.countdown.name,
            startAt:event.countdown.startAt, targetAt:event.countdown.targetAt,
            eventKey:event.eventKey, threshold:event.threshold ? { ...event.threshold } : null,
            remainingMs:event.state.remainingMs, progress:event.state.progress, occurredAt:new Date(nowValue).toISOString()
          });
          outcomes.push({ channelId:'event', ok:true });
        }
        if (event.localPending) {
          try { await this._sendLocal(message); outcomes.push({ channelId:'local', ok:true }); }
          catch (error) { outcomes.push({ channelId:'local', ok:false, error:error?.message || error }); }
        }
        const sent = await Promise.allSettled(event.pendingChannelIds.map((channelId) => this.plugin.serverChan.sendChannel(channelId, message.title, message.body)));
        sent.forEach((result, index) => outcomes.push({ channelId:event.pendingChannelIds[index], ok:result.status === 'fulfilled', error:result.status === 'rejected' ? (result.reason?.message || result.reason) : '' }));
        const smtpSent = await Promise.allSettled(event.pendingEmailRules.map((rule) => {
          const mail = countdownEmailRuleMessage(rule, event, language);
          return this.plugin.smtpMail.send(rule.accountId, {
            to:rule.to, cc:rule.cc, bcc:rule.bcc,
            subject:mail.subject, body:mail.body,
            messageId:[event.countdown.id, event.eventKey, rule.id].join('-')
          });
        }));
        smtpSent.forEach((result, index) => outcomes.push({ channelId:'smtp:' + event.pendingEmailRules[index].id, ok:result.status === 'fulfilled', error:result.status === 'rejected' ? (result.reason?.message || result.reason) : '' }));
        if (outcomes.length) { await this._record(event, outcomes); changed = true; }
      }
      if (changed) this.notify();
    } finally { this.ticking = false; }
  }
  async start() {
    if (this.started) return;
    this.started = true;
    await this.tick().catch((e) => console.warn('Cockpit countdown initial check failed', e));
    this.timer = window.setInterval(() => this.tick().catch((e) => console.warn('Cockpit countdown tick failed', e)), 15000);
    this.plugin.registerInterval(this.timer);
  }
  stop() { this.started = false; clearInterval(this.timer); this.timer = null; this.listeners.clear(); }
}

function countdownEditorField(parent, label, control) {
  const field = parent.createDiv({ cls:PLUGIN_ID + '-countdown-field' });
  field.createDiv({ cls:PLUGIN_ID + '-countdown-label', text:label }); field.appendChild(control); return field;
}

async function openCountdownEditor(view, raw, onSaved, options = {}) {
  const en = view._lang() === 'en'; const existing = normalizeCountdown(raw);
  const [config, smtpAccounts] = await Promise.all([view._plugin.serverChan.getConfig(), view._plugin.smtpMail?.listAccounts?.() || []]);
  const overlay = document.createElement('div'); overlay.className = PLUGIN_ID + '-countdown-backdrop';
  const sheet = overlay.createDiv({ cls:PLUGIN_ID + '-countdown-editor', attr:{role:'dialog','aria-modal':'true'} });
  const head = sheet.createDiv({ cls:PLUGIN_ID + '-countdown-editor-head' });
  head.createEl('h2', { text:existing ? (en ? 'Edit countdown' : '编辑倒计时') : (en ? 'New countdown' : '新建倒计时') });
  const close = head.createEl('button', { text:'×', attr:{type:'button','aria-label':en ? 'Close' : '关闭'} });
  const body = sheet.createDiv({ cls:PLUGIN_ID + '-countdown-editor-body' });
  const name = document.createElement('input'); name.type = 'text'; name.maxLength = 100; name.value = existing?.name || '';
  countdownEditorField(body, en ? 'Name' : '名称', name);
  const now = new Date(); const defaultTarget = new Date(now.getTime() + 7 * 86400000);
  const start = document.createElement('input'); start.type = 'datetime-local'; start.value = countdownDateTimeLocalValue(existing?.startAt || now);
  const target = document.createElement('input'); target.type = 'datetime-local'; target.value = countdownDateTimeLocalValue(existing?.targetAt || defaultTarget);
  countdownEditorField(body, en ? 'Start time' : '开始时间', start); countdownEditorField(body, en ? 'Target time' : '目标时间', target);

  body.createDiv({ cls:PLUGIN_ID + '-countdown-subtitle', text:en ? 'Reminder thresholds' : '提醒阈值' });
  const thresholdList = body.createDiv({ cls:PLUGIN_ID + '-countdown-threshold-list' });
  const thresholdDrafts = existing?.thresholds?.map((item) => ({ ...item })) || [{ id:'threshold-1', mode:'percent', value:20, unit:'hours' }];
  let renderEmailRules = () => {};
  const renderThresholds = () => {
    thresholdList.empty();
    thresholdDrafts.forEach((item, index) => {
      const row = thresholdList.createDiv({ cls:PLUGIN_ID + '-countdown-threshold-row' });
      const mode = row.createEl('select');
      mode.createEl('option', { text:en ? 'Percentage remaining' : '剩余总量百分比', attr:{value:'percent'} });
      mode.createEl('option', { text:en ? 'Fixed time remaining' : '固定剩余时间', attr:{value:'duration'} }); mode.value = item.mode;
      const value = row.createEl('input', { attr:{type:'number', min:'0.01', step:'0.01'} }); value.value = String(item.value);
      const unit = row.createEl('select');
      [['minutes',en?'Minutes':'分钟'],['hours',en?'Hours':'小时'],['days',en?'Days':'天']].forEach(([key,label]) => unit.createEl('option',{text:label,attr:{value:key}})); unit.value = item.unit || 'hours';
      unit.style.display = item.mode === 'duration' ? '' : 'none';
      mode.onchange = () => { item.mode = mode.value; unit.style.display = item.mode === 'duration' ? '' : 'none'; };
      value.oninput = () => { item.value = Number(value.value); }; unit.onchange = () => { item.unit = unit.value; };
      const remove = row.createEl('button', { attr:{type:'button','aria-label':en?'Remove threshold':'删除阈值'} }); obs.setIcon(remove,'trash-2');
      remove.onclick = () => { thresholdDrafts.splice(index, 1); renderThresholds(); renderEmailRules(); };
    });
  };
  renderThresholds();
  const addThreshold = body.createEl('button', { cls:PLUGIN_ID + '-countdown-add-threshold', text:en ? '+ Add threshold' : '+ 添加提醒阈值', attr:{type:'button'} });
  addThreshold.onclick = () => { if (thresholdDrafts.length < COUNTDOWN_MAX_THRESHOLDS) { thresholdDrafts.push({ id:'threshold-' + Date.now().toString(36), mode:'duration', value:1, unit:'days' }); renderThresholds(); } };

  body.createDiv({ cls:PLUGIN_ID + '-countdown-subtitle', text:en ? 'Delivery' : '通知方式' });
  const channelWrap = body.createDiv({ cls:PLUGIN_ID + '-countdown-channels' });
  const selected = new Set(existing?.channelIds || Object.keys(config.channels).filter((id) => config.channels[id]?.enabled));
  Object.values(NOTIFICATION_CHANNELS).forEach((channel) => {
    const label = channelWrap.createEl('label'); const input = label.createEl('input', { attr:{type:'checkbox'} }); input.checked = selected.has(channel.id);
    input.onchange = () => input.checked ? selected.add(channel.id) : selected.delete(channel.id);
    label.createSpan({ text:channel.label + (config.channels[channel.id]?.enabled ? '' : (en ? ' (not configured)' : '（未启用）')) });
  });
  const localLabel = channelWrap.createEl('label'); const local = localLabel.createEl('input',{attr:{type:'checkbox'}}); local.checked = existing?.localNotification !== false; localLabel.createSpan({text:en?'Local system notification':'本机系统通知'});
  const endLabel = channelWrap.createEl('label'); const notifyEnd = endLabel.createEl('input',{attr:{type:'checkbox'}}); notifyEnd.checked = existing?.notifyAtEnd !== false; endLabel.createSpan({text:en?'Notify again at the deadline':'到达目标时间时再次通知'});
  body.createDiv({ cls:PLUGIN_ID + '-countdown-note', text:en ? 'Checks run while the app is open. Resend uses the shared channel above; SMTP rules below can use QQ or NetEase accounts.' : '仅在应用运行时检查；上方邮件渠道使用 Resend，下方 SMTP 规则可选择 QQ 或网易发件账户。' });

  body.createDiv({ cls:PLUGIN_ID + '-countdown-subtitle ' + PLUGIN_ID + '-countdown-email-title', text:en ? 'SMTP email rules' : 'SMTP 邮件规则' });
  const emailRuleList = body.createDiv({ cls:PLUGIN_ID + '-countdown-email-rules' });
  const emailRuleDrafts = existing?.emailRules?.map((item) => ({ ...item, to:[...item.to], cc:[...item.cc], bcc:[...item.bcc] })) || [];
  renderEmailRules = () => {
    emailRuleList.empty();
    if (!smtpAccounts.length) emailRuleList.createDiv({ cls:PLUGIN_ID + '-countdown-note', text:en ? 'Configure a QQ or NetEase SMTP account in Settings → Channels first.' : '请先到“设置 → 推送渠道”配置 QQ 或网易 SMTP 发件账户。' });
    emailRuleDrafts.forEach((rule, index) => {
      const card = emailRuleList.createDiv({ cls:PLUGIN_ID + '-countdown-email-rule' });
      const trigger = card.createEl('select');
      thresholdDrafts.forEach((threshold) => trigger.createEl('option',{text:countdownThresholdLabel(threshold,view._lang()),attr:{value:'threshold:'+threshold.id}}));
      trigger.createEl('option',{text:en?'At the deadline':'倒计时结束',attr:{value:'finished'}}); trigger.value=rule.eventKey;
      trigger.onchange=()=>{rule.eventKey=trigger.value;};
      const account = card.createEl('select'); smtpAccounts.forEach((item)=>account.createEl('option',{text:item.name+' · '+item.email,attr:{value:item.id}}));account.value=rule.accountId;account.onchange=()=>{rule.accountId=account.value;};
      const recipients=card.createEl('textarea',{attr:{rows:'2',placeholder:en?'Recipients, separated by commas':'收件邮箱，多个用逗号分隔'}});recipients.value=(rule.to||[]).join(', ');recipients.oninput=()=>{rule.to=normalizeCountdownRuleRecipients(recipients.value);};
      const subject=card.createEl('input',{attr:{type:'text',maxlength:'180',placeholder:en?'Subject; supports {countdown} {target}':'主题；支持 {countdown} {target}'}});subject.value=rule.subject||'';subject.oninput=()=>{rule.subject=subject.value;};
      const message=card.createEl('textarea',{attr:{rows:'3',maxlength:'10000',placeholder:en?'Body; supports {countdown} {target} {remaining} {progress}':'正文；支持 {countdown} {target} {remaining} {progress}'}});message.value=rule.body||'';message.oninput=()=>{rule.body=message.value;};
      const remove=card.createEl('button',{attr:{type:'button','aria-label':en?'Remove email rule':'删除邮件规则'}});obs.setIcon(remove,'trash-2');remove.createSpan({text:en?'Remove':'删除'});remove.onclick=()=>{emailRuleDrafts.splice(index,1);renderEmailRules();};
    });
  };
  renderEmailRules();
  const addEmailRule=body.createEl('button',{cls:PLUGIN_ID+'-countdown-add-threshold',text:en?'+ Add SMTP email rule':'+ 添加 SMTP 邮件规则',attr:{type:'button'}});addEmailRule.disabled=!smtpAccounts.length;
  addEmailRule.onclick=()=>{if(emailRuleDrafts.length>=COUNTDOWN_MAX_EMAIL_RULES||!smtpAccounts.length)return;const eventKey=thresholdDrafts.length?'threshold:'+thresholdDrafts[0].id:'finished';emailRuleDrafts.push({id:'email-rule-'+Date.now().toString(36),eventKey,accountId:smtpAccounts[0].id,to:[],cc:[],bcc:[],subject:'',body:'',enabled:true});renderEmailRules();};
  const error = body.createDiv({ cls:PLUGIN_ID + '-countdown-error' });
  const footer = sheet.createDiv({ cls:PLUGIN_ID + '-countdown-editor-footer' });
  const cancel = footer.createEl('button',{text:en?'Cancel':'取消',attr:{type:'button'}}); const save = footer.createEl('button',{cls:'mod-cta',text:en?'Save':'保存',attr:{type:'button'}});
  const closeEditor = () => overlay.remove(); close.onclick = cancel.onclick = closeEditor; overlay.onclick = (event) => { if (event.target === overlay) closeEditor(); };
  save.onclick = async () => {
    error.textContent = '';
    const startDate = new Date(start.value); const targetDate = new Date(target.value);
    const thresholds = thresholdDrafts.map(normalizeCountdownThreshold).filter(Boolean);
    if (!name.value.trim() || !Number.isFinite(startDate.getTime()) || !Number.isFinite(targetDate.getTime()) || targetDate <= startDate) { error.textContent = en ? 'Enter a name and choose a target later than the start.' : '请输入名称，并确保目标时间晚于开始时间。'; return; }
    if (!thresholds.length && !notifyEnd.checked) { error.textContent = en ? 'Add a threshold or enable the deadline notification.' : '请至少添加一个阈值，或开启到期通知。'; return; }
    const validEventKeys=['finished',...thresholds.map((item)=>'threshold:'+item.id)];
    const emailRules=emailRuleDrafts.map((item,index)=>normalizeCountdownEmailRule(item,index,validEventKeys)).filter(Boolean);
    if (emailRules.length !== emailRuleDrafts.length) { error.textContent = en ? 'Complete the trigger, sending account, and recipients for every SMTP rule.' : '请为每条 SMTP 规则填写触发点、发件账户和收件邮箱。'; return; }
    if (!local.checked && !selected.size && !emailRules.length) { error.textContent = en ? 'Choose at least one delivery method.' : '请至少选择一种通知方式。'; return; }
    const value = normalizeCountdown({ ...existing, id:existing?.id || countdownId(), name:name.value, enabled:existing?.enabled !== false, startAt:startDate.toISOString(), targetAt:targetDate.toISOString(), thresholds, channelIds:Array.from(selected), emailRules, localNotification:local.checked, notifyAtEnd:notifyEnd.checked, deliveries:existing?.deliveries || {} });
    await view._plugin.countdowns.upsert(value); closeEditor(); onSaved?.();
  };
  makeCockpitDialogDraggable(sheet, head, { label:en?'Drag countdown editor':'拖动倒计时编辑窗口' });
  document.body.appendChild(overlay);
  setTimeout(() => {
    if (options.focusEmail) {
      emailRuleList.scrollIntoView({ block:'center', behavior:'smooth' });
      emailRuleList.classList.add('is-focused');
      setTimeout(() => emailRuleList.classList.remove('is-focused'), 1400);
    } else name.focus();
  }, 20);
}

async function buildCountdownModule(view, root) {
  const en = view._lang() === 'en'; const service = view._plugin.countdowns;
  const title = root.createDiv({ cls:PLUGIN_ID + '-section-title ' + PLUGIN_ID + '-countdown-title' }); title.dataset.section = 'countdowns-title';
  title.createSpan({ text:view._t('sections.countdowns') });
  const add = title.createEl('button',{cls:PLUGIN_ID+'-countdown-add',attr:{type:'button','aria-label':en?'New countdown':'新建倒计时'}}); obs.setIcon(add,'plus');
  const content = root.createDiv({ cls:PLUGIN_ID + '-countdowns' }); content.dataset.section = 'countdowns-body';
  const updateClocks = () => content.querySelectorAll('[data-countdown-id]').forEach((card) => {
    const item = card._countdown; const state = countdownState(item); if (!state) return;
    const remaining = card.querySelector('[data-role="remaining"]'); const progress = card.querySelector('[data-role="progress"]');
    if (remaining) remaining.textContent = state.finished ? (en?'Finished':'已结束') : formatCountdownRemaining(state.remainingMs, view._lang());
    if (progress) progress.style.width = state.progress + '%';
    card.classList.toggle('finished', state.finished);
    card.classList.toggle('is-urgent', !state.finished && state.remainingMs <= 86400000);
  });
  const render = async () => {
    const items = await service.load(); content.empty();
    if (!items.length) {
      const empty = content.createDiv({cls:PLUGIN_ID+'-countdown-empty'}); obs.setIcon(empty.createSpan(),'timer-reset');
      empty.createDiv({text:en?'No countdowns yet':'还没有倒计时'});
      empty.createEl('button',{text:en?'Create countdown':'创建倒计时',attr:{type:'button'}}).onclick=()=>openCountdownEditor(view,null,render); return;
    }
    items.slice().sort((a,b)=>{
      const aState=countdownState(a), bState=countdownState(b); const aRank=(a.enabled?0:2)+(aState?.finished?1:0), bRank=(b.enabled?0:2)+(bState?.finished?1:0);
      return aRank-bRank || new Date(a.targetAt)-new Date(b.targetAt);
    }).forEach((item) => {
      const state = countdownState(item); const card = content.createDiv({cls:PLUGIN_ID+'-countdown-card'+(item.enabled?'':' disabled')+(state?.finished?' finished':'')+(!state?.finished&&state?.remainingMs<=86400000?' is-urgent':''),attr:{'data-countdown-id':item.id}}); card._countdown = item;
      const top = card.createDiv({cls:PLUGIN_ID+'-countdown-card-top'}); const meta = top.createDiv({cls:PLUGIN_ID+'-countdown-meta'});
      meta.createDiv({cls:PLUGIN_ID+'-countdown-name',text:item.name});
      meta.createDiv({cls:PLUGIN_ID+'-countdown-target',text:(en?'Target: ':'目标：')+new Date(item.targetAt).toLocaleString(en?'en-US':'zh-CN',{hour12:false})});
      const remaining = top.createDiv({cls:PLUGIN_ID+'-countdown-remaining'}); remaining.createSpan({cls:PLUGIN_ID+'-countdown-remaining-label',text:en?'LEFT':'剩余'}); remaining.createSpan({text:state.finished?(en?'Finished':'已结束'):formatCountdownRemaining(state.remainingMs,view._lang()),attr:{'data-role':'remaining'}});
      const progress = card.createDiv({cls:PLUGIN_ID+'-countdown-progress'}); progress.createDiv({attr:{'data-role':'progress',style:'width:'+state.progress+'%'}});
      const footer = card.createDiv({cls:PLUGIN_ID+'-countdown-card-footer'});
      const chips = footer.createDiv({cls:PLUGIN_ID+'-countdown-chips'});
      if(item.thresholds.length)chips.createSpan({text:(en?'Reminders ':'提醒 ')+item.thresholds.length});
      if(item.emailRules.length)chips.createSpan({text:(en?'Emails ':'邮件 ')+item.emailRules.length});
      if(!item.thresholds.length&&!item.emailRules.length)chips.createSpan({cls:'is-quiet',text:en?'Deadline only':'仅到期提醒'});
      const actions = footer.createDiv({cls:PLUGIN_ID+'-countdown-actions'});
      const toggleLabel=actions.createEl('label',{cls:PLUGIN_ID+'-countdown-toggle',attr:{title:en?'Enable countdown':'启用倒计时'}});const toggle=toggleLabel.createEl('input',{attr:{type:'checkbox','aria-label':en?'Enable countdown':'启用倒计时'}});toggleLabel.createSpan(); toggle.checked=item.enabled; toggle.onchange=(event)=>{event.stopPropagation();service.toggle(item.id,toggle.checked);};
      const mail=actions.createEl('button',{cls:PLUGIN_ID+'-countdown-mail-rules',attr:{type:'button',title:en?'Email rules':'邮件规则','aria-label':en?'Configure SMTP email notifications':'配置 SMTP 邮件通知'}});obs.setIcon(mail,'mail');mail.onclick=(event)=>{event.preventDefault();event.stopPropagation();openCountdownEditor(view,item,render,{focusEmail:true});};
      const link=actions.createEl('button',{cls:PLUGIN_ID+'-countdown-link-automation',attr:{type:'button',title:en?'Link automation':'联动自动化','aria-label':en?'Link automation workflow':'联动自动化流程'}});obs.setIcon(link,'workflow');link.onclick=async(event)=>{event.preventDefault();event.stopPropagation();link.disabled=true;try{await openScheduledTaskEditor(view,countdownAutomationDraft(item,view._lang()),{asNew:true});}catch(error){new obs.Notice((en?'Could not open automation: ':'无法打开自动化配置：')+(error?.message||error));}finally{link.disabled=false;}};
      const edit=actions.createEl('button',{attr:{type:'button','aria-label':en?'Edit':'编辑'}});obs.setIcon(edit,'pencil');edit.onclick=(event)=>{event.preventDefault();event.stopPropagation();openCountdownEditor(view,item,render);};
      const remove=actions.createEl('button',{attr:{type:'button','aria-label':en?'Delete':'删除'}});obs.setIcon(remove,'trash-2');remove.onclick=async(event)=>{event.preventDefault();event.stopPropagation();if(window.confirm(en?'Delete this countdown?':'删除这个倒计时？'))await service.remove(item.id);};
    }); updateClocks();
  };
  add.onclick=(event)=>{event.preventDefault();event.stopPropagation();openCountdownEditor(view,null,render);};
  view._countdownUnsubscribe?.(); view._countdownUnsubscribe=service.subscribe(()=>render().catch((e)=>console.warn('Cockpit countdown render failed',e)));
  if (view._countdownDisplayTimer) clearInterval(view._countdownDisplayTimer); view._countdownDisplayTimer=window.setInterval(updateClocks,1000);
  await render(); view._makeModuleCollapsible('countdowns',title,content); return content;
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={countdownAutomationDraft};
