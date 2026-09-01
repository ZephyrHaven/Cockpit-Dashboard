#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeSmtpAccount,
  normalizeSmtpMailConfig,
  runSmtpSession,
  SmtpMailService
} = require('../src/smtp-mail.js');

const qq = normalizeSmtpAccount({
  id:'personal-qq', provider:'qq', name:'个人 QQ',
  email:'Example@QQ.com', authCode:'  secret-code  ', enabled:true
});
assert.deepEqual(qq, {
  id:'personal-qq', provider:'qq', name:'个人 QQ', enabled:true,
  host:'smtp.qq.com', port:465, security:'ssl',
  email:'example@qq.com', username:'example@qq.com', authCode:'secret-code'
}, 'QQ profiles use the secure personal-mail preset and normalize the login address.');

const netease = normalizeSmtpAccount({
  id:'work-163', provider:'netease-enterprise', name:'工作邮箱',
  email:'alerts@example.com', username:'alerts@example.com', authCode:'work-secret'
});
assert.equal(netease.host, 'smtp.qiye.163.com');
assert.equal(netease.port, 994);
assert.equal(netease.security, 'ssl');

const config = normalizeSmtpMailConfig({ accounts:[qq, netease, qq, { provider:'unknown' }] });
assert.deepEqual(config.accounts.map((account) => account.id), ['personal-qq','work-163'], 'Invalid and duplicate SMTP accounts are discarded.');

const responses = [
  { code:220, text:'ready' }, { code:250, text:'hello' },
  { code:334, text:'username' }, { code:334, text:'password' }, { code:235, text:'authenticated' },
  { code:250, text:'sender ok' }, { code:250, text:'recipient one ok' }, { code:250, text:'recipient two ok' },
  { code:354, text:'send data' }, { code:250, text:'queued' }, { code:221, text:'bye' }
];
const writes = [];
const transport = {
  read:async () => responses.shift(),
  write:async (value) => { writes.push(value); },
  end:() => {}
};

(async () => {
  const result = await runSmtpSession(qq, {
    to:['one@example.com'], bcc:['hidden@example.com'],
    subject:'倒计时提醒', body:'第一行\n.敏感点开头', messageId:'countdown_rule_1'
  }, transport);
  const transcript = writes.join('');
  assert.equal(result.accepted, 2, 'The SMTP session reports every accepted envelope recipient.');
  assert.match(transcript, /AUTH LOGIN\r\n/);
  assert.match(transcript, new RegExp(Buffer.from('example@qq.com').toString('base64')));
  assert.match(transcript, new RegExp(Buffer.from('secret-code').toString('base64')));
  assert.match(transcript, /RCPT TO:<one@example\.com>\r\n/);
  assert.match(transcript, /RCPT TO:<hidden@example\.com>\r\n/);
  assert.doesNotMatch(transcript, /^Bcc:/mi, 'Blind recipients never appear in message headers.');
  assert.match(transcript, /Subject: =\?UTF-8\?B\?/, 'Unicode subjects are MIME encoded.');
  assert.match(transcript, /Content-Transfer-Encoding: base64/, 'Unicode bodies use a transport-safe encoding.');
  assert.match(transcript, new RegExp(Buffer.from('第一行\n.敏感点开头').toString('base64').slice(0, 24)));

  let stored = { smtpMail:{ accounts:[] } };
  const plugin = {
    loadData:async () => JSON.parse(JSON.stringify(stored)),
    mutateData:async (mutator) => { await mutator(stored); }
  };
  const service = new SmtpMailService(plugin, () => ({
    read:async () => ({ code:220, text:'unused' }), write:async () => {}, end:() => {}
  }));
  await service.upsert({ id:'qq-main', provider:'qq', name:'QQ', email:'me@qq.com', authCode:'auth' });
  assert.equal((await service.listAccounts())[0].host, 'smtp.qq.com', 'Saved profiles are normalized through the service boundary.');
  await service.remove('qq-main');
  assert.equal((await service.listAccounts()).length, 0, 'Users can remove an SMTP profile without touching other plugin data.');
  const smtpSource = fs.readFileSync(path.join(__dirname, '../src/smtp-mail.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
  assert.match(smtpSource, /smtp-account-backdrop/, 'SMTP account editor uses a dedicated top-layer dialog instead of the generic settings overlay.');
  assert.match(styles, /smtp-account-backdrop[^}]*z-index:\s*2147483/, 'SMTP account editor stays above the host settings modal.');
  console.log('SMTP mail checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
