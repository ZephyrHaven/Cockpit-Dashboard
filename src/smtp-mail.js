// smtp-mail.js — QQ 个人邮箱与网易企业邮箱 SMTP 账户、传输和设置界面。

const SMTP_MAIL_MAX_ACCOUNTS = 8;
const SMTP_MAIL_PROVIDERS = Object.freeze({
  qq:{ id:'qq', host:'smtp.qq.com', port:465, security:'ssl' },
  'netease-enterprise':{ id:'netease-enterprise', host:'smtp.qiye.163.com', port:994, security:'ssl' }
});

function smtpMailSafeText(value, max) { return String(value || '').trim().slice(0, max); }
function smtpMailSafeId(value) { return smtpMailSafeText(value, 64).replace(/[^a-zA-Z0-9_-]/g, ''); }
function smtpMailValidAddress(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }

function normalizeSmtpAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const preset = SMTP_MAIL_PROVIDERS[raw.provider];
  const id = smtpMailSafeId(raw.id);
  const email = smtpMailSafeText(raw.email, 200).toLowerCase();
  const username = smtpMailSafeText(raw.username || email, 200);
  if (!preset || !id || !smtpMailValidAddress(email) || !username) return null;
  return {
    id, provider:preset.id,
    name:smtpMailSafeText(raw.name, 80) || email,
    enabled:raw.enabled !== false,
    host:preset.host, port:preset.port, security:preset.security,
    email, username,
    authCode:smtpMailSafeText(raw.authCode, 240)
  };
}

function normalizeSmtpMailConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const seen = new Set();
  const accounts = (Array.isArray(source.accounts) ? source.accounts : [])
    .slice(0, SMTP_MAIL_MAX_ACCOUNTS)
    .map(normalizeSmtpAccount)
    .filter((account) => account && !seen.has(account.id) && (seen.add(account.id), true));
  return { accounts };
}

function normalizeSmtpRecipients(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/[,;\n]/);
  return Array.from(new Set(items.map((item) => smtpMailSafeText(item, 200).toLowerCase()).filter(smtpMailValidAddress))).slice(0, 30);
}

function smtpMimeEncoded(value) {
  return '=?UTF-8?B?' + Buffer.from(String(value || ''), 'utf8').toString('base64') + '?=';
}

function smtpFoldBase64(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
}

function buildSmtpMessage(account, mail) {
  const to = normalizeSmtpRecipients(mail?.to);
  const cc = normalizeSmtpRecipients(mail?.cc);
  const safeMessageId = smtpMailSafeText(mail?.messageId || Date.now().toString(36), 120).replace(/[^a-zA-Z0-9._-]/g, '_');
  const domain = account.email.split('@')[1] || 'localhost';
  const headers = [
    'Date: ' + new Date().toUTCString(),
    'Message-ID: <' + safeMessageId + '@' + domain + '>',
    'From: ' + smtpMimeEncoded(account.name) + ' <' + account.email + '>',
    'To: ' + to.join(', ')
  ];
  if (cc.length) headers.push('Cc: ' + cc.join(', '));
  headers.push(
    'Subject: ' + smtpMimeEncoded(smtpMailSafeText(mail?.subject, 180)),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '', smtpFoldBase64(smtpMailSafeText(mail?.body, 20000))
  );
  return headers.join('\r\n');
}

function smtpAssertResponse(response, allowed, stage) {
  if (!response || !allowed.includes(Number(response.code))) {
    const error = new Error('SMTP ' + stage + ' failed: ' + (response?.code || '') + ' ' + smtpMailSafeText(response?.text, 240));
    error.smtpCode = Number(response?.code) || 0;
    throw error;
  }
}

async function runSmtpSession(rawAccount, mail, transport) {
  const account = normalizeSmtpAccount(rawAccount);
  if (!account || !account.authCode) throw new Error('SMTP account is incomplete.');
  const to = normalizeSmtpRecipients(mail?.to);
  const cc = normalizeSmtpRecipients(mail?.cc);
  const bcc = normalizeSmtpRecipients(mail?.bcc);
  const recipients = Array.from(new Set([...to, ...cc, ...bcc]));
  if (!recipients.length) throw new Error('At least one recipient is required.');
  const command = async (value, allowed, stage) => {
    await transport.write(value + '\r\n');
    const response = await transport.read();
    smtpAssertResponse(response, allowed, stage);
    return response;
  };
  try {
    smtpAssertResponse(await transport.read(), [220], 'connect');
    await command('EHLO cockpit.local', [250], 'greeting');
    await command('AUTH LOGIN', [334], 'authentication');
    await command(Buffer.from(account.username, 'utf8').toString('base64'), [334], 'username');
    await command(Buffer.from(account.authCode, 'utf8').toString('base64'), [235], 'password');
    await command('MAIL FROM:<' + account.email + '>', [250], 'sender');
    for (const recipient of recipients) await command('RCPT TO:<' + recipient + '>', [250,251], 'recipient');
    await command('DATA', [354], 'data');
    const message = buildSmtpMessage(account, { ...mail, to, cc });
    const dotStuffed = message.replace(/(^|\r\n)\./g, '$1..');
    await transport.write(dotStuffed + '\r\n.\r\n');
    smtpAssertResponse(await transport.read(), [250], 'message');
    await command('QUIT', [221], 'quit');
    return { accepted:recipients.length };
  } finally {
    transport.end?.();
  }
}

function createSmtpTlsTransport(rawAccount, timeoutMs = 20000) {
  const account = normalizeSmtpAccount(rawAccount);
  if (!account) throw new Error('SMTP account is invalid.');
  const tls = require('tls');
  const socket = tls.connect({
    host:account.host, port:account.port, servername:account.host,
    rejectUnauthorized:true, minVersion:'TLSv1.2'
  });
  socket.setTimeout(timeoutMs);
  let buffer = ''; let current = []; let currentCode = 0; let fatal = null;
  const ready = []; const waiters = [];
  const settle = (response) => {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(response); else ready.push(response);
  };
  const fail = (error) => {
    fatal = error instanceof Error ? error : new Error(String(error || 'SMTP connection failed.'));
    while (waiters.length) waiters.shift().reject(fatal);
  };
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let boundary;
    while ((boundary = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!current.length) currentCode = match ? Number(match[1]) : 0;
      current.push(line);
      if (match && Number(match[1]) === currentCode && match[2] === ' ') {
        settle({ code:currentCode, text:current.join('\n') }); current = []; currentCode = 0;
      }
    }
  });
  socket.on('error', fail);
  socket.on('timeout', () => { const error = new Error('SMTP connection timed out.'); fail(error); socket.destroy(error); });
  socket.on('close', () => { if (waiters.length && !fatal) fail(new Error('SMTP connection closed unexpectedly.')); });
  return {
    read:() => {
      if (ready.length) return Promise.resolve(ready.shift());
      if (fatal) return Promise.reject(fatal);
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    },
    write:(value) => new Promise((resolve, reject) => {
      if (fatal) { reject(fatal); return; }
      socket.write(value, 'utf8', (error) => error ? reject(error) : resolve());
    }),
    end:() => { if (!socket.destroyed) socket.end(); }
  };
}

class SmtpMailService {
  constructor(plugin, transportFactory = createSmtpTlsTransport) { this.plugin = plugin; this.transportFactory = transportFactory; }
  async getConfig() { return normalizeSmtpMailConfig((await this.plugin.loadData() || {}).smtpMail); }
  async listAccounts() { return (await this.getConfig()).accounts; }
  async upsert(raw) {
    const account = normalizeSmtpAccount(raw);
    if (!account) throw new Error('invalid-smtp-account');
    await this.plugin.mutateData((data) => {
      const config = normalizeSmtpMailConfig(data.smtpMail);
      const index = config.accounts.findIndex((item) => item.id === account.id);
      if (index >= 0) config.accounts[index] = account; else config.accounts.push(account);
      data.smtpMail = normalizeSmtpMailConfig(config);
    });
    return account;
  }
  async remove(id) {
    const safeId = smtpMailSafeId(id); let removed = false;
    await this.plugin.mutateData((data) => {
      const config = normalizeSmtpMailConfig(data.smtpMail);
      const next = config.accounts.filter((item) => item.id !== safeId);
      removed = next.length !== config.accounts.length; config.accounts = next; data.smtpMail = config;
    });
    return removed;
  }
  async send(accountId, mail) {
    const account = (await this.listAccounts()).find((item) => item.id === smtpMailSafeId(accountId));
    if (!account || !account.enabled) throw new Error('SMTP account is unavailable.');
    return runSmtpSession(account, mail, this.transportFactory(account));
  }
  async sendTest(accountId) {
    const account = (await this.listAccounts()).find((item) => item.id === smtpMailSafeId(accountId));
    if (!account) throw new Error('SMTP account is unavailable.');
    return this.send(account.id, { to:[account.email], subject:'Cockpit SMTP 测试', body:'这是一封 SMTP 连接测试邮件。\n\n发送时间：' + new Date().toLocaleString(), messageId:'smtp-test-' + Date.now().toString(36) });
  }
}

function smtpMailAccountDraft(provider) {
  return { id:'smtp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), provider, name:provider === 'qq' ? 'QQ 个人邮箱' : '网易企业邮箱', enabled:true, email:'', username:'', authCode:'' };
}

function openSmtpAccountEditor(plugin, raw, provider, language, onSaved) {
  const en = language === 'en';
  const draft = raw ? { ...raw } : smtpMailAccountDraft(provider);
  const overlay = document.createElement('div');
  overlay.className = PLUGIN_ID + '-smtp-account-backdrop';
  const panel = overlay.createDiv({ cls:PLUGIN_ID + '-smtp-account-dialog', attr:{ role:'dialog', 'aria-modal':'true' } });
  const head = panel.createDiv({ cls:PLUGIN_ID + '-smtp-account-dialog-head' });
  const heading = head.createDiv({ cls:PLUGIN_ID + '-smtp-account-heading' });
  const icon = heading.createSpan({ cls:PLUGIN_ID + '-smtp-account-heading-icon' }); obs.setIcon(icon,'mail');
  const headingCopy = heading.createDiv();
  headingCopy.createDiv({ cls:PLUGIN_ID + '-smtp-account-kicker', text:en ? 'Encrypted SMTP' : '加密 SMTP' });
  headingCopy.createEl('h2', { text:raw ? (en ? 'Edit sending account' : '编辑发件账户') : (en ? 'Add sending account' : '添加发件账户') });
  headingCopy.createEl('p', { text:en ? 'Connect one mailbox, then reuse it in countdowns and scheduled tasks.' : '连接一个邮箱后，可在倒计时和定时任务中重复使用。' });
  const close = head.createEl('button', { cls:PLUGIN_ID + '-smtp-account-close', attr:{type:'button','aria-label':en?'Close':'关闭'} }); obs.setIcon(close,'x');
  const body = panel.createDiv({ cls:PLUGIN_ID + '-smtp-account-dialog-body' });
  const form = body.createDiv({ cls:PLUGIN_ID + '-smtp-account-form' });
  const field = (label, hint, wide = false) => {
    const row = form.createEl('label', { cls:PLUGIN_ID + '-smtp-account-field' + (wide ? ' is-wide' : '') });
    row.createSpan({ cls:PLUGIN_ID + '-smtp-account-label', text:label });
    if (hint) row.createSpan({ cls:PLUGIN_ID + '-smtp-account-hint', text:hint });
    return row;
  };
  const providerField = field(en?'Mailbox type':'邮箱类型', en?'Server settings are filled automatically.':'服务器参数会自动匹配。');
  const providerSelect = providerField.createEl('select');
  providerSelect.createEl('option',{text:en?'QQ personal mail':'QQ 个人邮箱',attr:{value:'qq'}});
  providerSelect.createEl('option',{text:en?'NetEase enterprise mail':'网易企业邮箱',attr:{value:'netease-enterprise'}});
  providerSelect.value = draft.provider;
  const server = providerField.createDiv({ cls:PLUGIN_ID + '-smtp-account-server' });
  const updateServer = () => { const preset=SMTP_MAIL_PROVIDERS[providerSelect.value];server.textContent=preset ? `${preset.host}:${preset.port} · SSL/TLS` : ''; };
  providerSelect.onchange=updateServer; updateServer();
  const nameField = field(en?'Account label':'账户名称', en?'Only shown inside Cockpit.':'仅用于插件内识别。');
  const name = nameField.createEl('input',{attr:{type:'text',maxlength:'80'}});name.value=draft.name||'';
  const emailField = field(en?'Sending address':'发件邮箱', en?'Use the complete email address.':'请输入完整邮箱地址。');
  const email = emailField.createEl('input',{attr:{type:'email',maxlength:'200',autocomplete:'email'}});email.value=draft.email||'';
  const usernameField = field(en?'SMTP username':'SMTP 用户名', en?'Leave blank to use the sending address.':'留空则使用完整发件邮箱。');
  const username = usernameField.createEl('input',{attr:{type:'text',maxlength:'200',autocomplete:'username'}});username.value=draft.username||'';
  const authField = field(en?'Client authorization code':'客户端授权码', en?'Do not enter the webmail login password.':'不要填写网页登录密码。', true);
  const authCode = authField.createEl('input',{attr:{type:'password',maxlength:'240',autocomplete:'new-password'}});authCode.value=draft.authCode||'';
  const security = body.createDiv({ cls:PLUGIN_ID + '-smtp-account-security' });obs.setIcon(security.createSpan(),'shield-check');security.createSpan({text:en?'The connection uses TLS. The authorization code is currently stored in this plugin’s private configuration.':'连接全程使用 TLS；授权码目前保存在插件的私有配置中。'});
  const enabledLabel = body.createEl('label',{cls:PLUGIN_ID+'-smtp-account-enabled'});const enabled=enabledLabel.createEl('input',{attr:{type:'checkbox'}});enabled.checked=draft.enabled!==false;const enabledCopy=enabledLabel.createSpan();enabledCopy.createEl('strong',{text:en?'Enable this account':'启用此账户'});enabledCopy.createSpan({text:en?'Available to countdown and scheduled-task selectors.':'允许倒计时和定时任务选择此账户。'});
  const error = body.createDiv({ cls:PLUGIN_ID + '-smtp-account-error' });
  const footer=panel.createDiv({cls:PLUGIN_ID+'-smtp-account-dialog-footer'});const cancel=footer.createEl('button',{text:en?'Cancel':'取消',attr:{type:'button'}});const save=footer.createEl('button',{cls:'mod-cta',text:en?'Save account':'保存账户',attr:{type:'button'}});
  const dismiss=()=>overlay.remove();close.onclick=cancel.onclick=dismiss;overlay.onclick=(event)=>{if(event.target===overlay)dismiss();};panel.onclick=(event)=>event.stopPropagation();
  overlay.addEventListener('keydown',(event)=>{if(event.key==='Escape'){event.preventDefault();dismiss();}});
  save.onclick=async()=>{error.textContent='';const value=normalizeSmtpAccount({...draft,provider:providerSelect.value,name:name.value,email:email.value,username:username.value,authCode:authCode.value,enabled:enabled.checked});if(!value||!value.authCode){error.textContent=en?'Enter a valid email address and client authorization code.':'请输入有效的邮箱地址和客户端授权码。';return;}save.disabled=true;try{await plugin.smtpMail.upsert(value);dismiss();await onSaved?.();new obs.Notice(en?'SMTP account saved.':'SMTP 邮箱已保存。');}catch(e){error.textContent=(en?'Could not save: ':'保存失败：')+(e?.message||e);save.disabled=false;}};
  makeCockpitDialogDraggable(panel, head, { label:en?'Drag SMTP account editor':'拖动 SMTP 账户编辑窗口' });
  document.body.appendChild(overlay); setTimeout(()=>email.focus(),20);
}

async function renderSmtpMailSettings(parent, plugin, language) {
  const en = language === 'en'; const section=parent.createDiv({cls:PLUGIN_ID+'-smtp-settings'});
  const render=async()=>{section.empty();const accounts=await plugin.smtpMail.listAccounts();const header=section.createDiv({cls:PLUGIN_ID+'-smtp-settings-head'});const copy=header.createDiv();copy.createEl('h3',{text:en?'SMTP sending accounts':'SMTP 发件账户'});copy.createEl('p',{text:en?'For countdown email rules. QQ personal and NetEase enterprise mail use encrypted SMTP connections.':'供倒计时邮件规则使用；QQ 个人邮箱和网易企业邮箱均通过加密 SMTP 连接。'});const actions=header.createDiv({cls:PLUGIN_ID+'-smtp-settings-actions'});const add=(provider,label)=>{const button=actions.createEl('button',{text:label,attr:{type:'button'}});button.onclick=()=>openSmtpAccountEditor(plugin,null,provider,language,render);};add('qq',en?'Add QQ':'添加 QQ 邮箱');add('netease-enterprise',en?'Add NetEase':'添加网易企业邮箱');
    const grid=section.createDiv({cls:PLUGIN_ID+'-settings-channel-grid'});if(!accounts.length){grid.createDiv({cls:PLUGIN_ID+'-countdown-note',text:en?'No SMTP account configured.':'还没有配置 SMTP 发件账户。'});return;}
    accounts.forEach((account)=>{const card=grid.createDiv({cls:PLUGIN_ID+'-settings-channel-card'});card.createEl('h3',{text:account.name});card.createDiv({text:account.email});card.createDiv({cls:PLUGIN_ID+'-countdown-note',text:`${account.host}:${account.port} · ${account.enabled?(en?'Enabled':'已启用'):(en?'Disabled':'已停用')}`});const tools=card.createDiv({cls:PLUGIN_ID+'-smtp-account-actions'});const test=tools.createEl('button',{text:en?'Send test':'发送测试',attr:{type:'button'}});test.onclick=async()=>{test.disabled=true;try{await plugin.smtpMail.sendTest(account.id);new obs.Notice(en?'Test email accepted by the SMTP server.':'测试邮件已由 SMTP 服务器接收。');}catch(e){new obs.Notice((en?'SMTP test failed: ':'SMTP 测试失败：')+(e?.message||e));}finally{test.disabled=false;}};const edit=tools.createEl('button',{text:en?'Edit':'编辑',attr:{type:'button'}});edit.onclick=()=>openSmtpAccountEditor(plugin,account,account.provider,language,render);const remove=tools.createEl('button',{text:en?'Delete':'删除',attr:{type:'button'}});remove.onclick=async()=>{if(!window.confirm(en?'Delete this SMTP account?':'删除这个 SMTP 发件账户？'))return;await plugin.smtpMail.remove(account.id);await render();};});};
  await render();
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { SMTP_MAIL_PROVIDERS, normalizeSmtpAccount, normalizeSmtpMailConfig, normalizeSmtpRecipients, buildSmtpMessage, runSmtpSession, createSmtpTlsTransport, SmtpMailService };
}
