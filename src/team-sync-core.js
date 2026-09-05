// team-sync-core.js — 主设备裁决的团队待办协议；个人待办不进入此数据域。
const TEAM_SYNC_LIMIT = 400;
const TEAM_SYNC_BYTES = 320 * 1024;
// Tags stay in the existing text representation, compatible with paired older devices.
function teamTodoTextParts(text) {
  const tags = [...new Set((String(text || '').match(/#[^\s#]+/g) || []).map(tag => tag.slice(1)))];
  return { text:String(text || '').replace(/#[^\s#]+/g, '').trim(), tags };
}
function teamTodoComposeText(text, tags) {
  const parts = teamTodoTextParts(text);
  return [parts.text.replace(/[\r\n]+/g, ' '), ...new Set([...parts.tags, ...tags].map(tag => String(tag).trim().replace(/^#+/, '').replace(/\s+/g, '-')).filter(Boolean))].map((part,index) => index ? '#' + part : part).join(' ').trim();
}
function teamSyncAssert(condition, message = '团队数据格式不受支持。') { if (!condition) throw new Error(message); }
function teamSyncText(value, max = 80) { return typeof value === 'string' && value.length <= max && !/[\r\n\0]/.test(value); }
function teamSyncInteger(value) { return Number.isSafeInteger(value) && value >= 0 && value < 1e12; }
function teamSyncPolicy(raw) {
  teamSyncAssert(lanSyncObject(raw) && ['editor', 'viewer', 'admin'].includes(raw.role)
    && ['all', 'assigned'].includes(raw.visibility) && typeof raw.canCreate === 'boolean'
    && typeof raw.canDelete === 'boolean' && typeof raw.syncTodos === 'boolean');
  return { role:raw.role, visibility:raw.visibility, canCreate:raw.canCreate, canDelete:raw.canDelete, syncTodos:raw.syncTodos };
}
function teamSyncDefaultPolicy() { return { role:'editor', visibility:'all', canCreate:true, canDelete:false, syncTodos:true }; }
function teamSyncInfo(team) {
  teamSyncAssert(lanSyncObject(team) && lanSyncDevice(team.id) && lanSyncDevice(team.host) && teamSyncText(team.name) && team.name.trim());
  return { id:team.id, host:team.host, name:team.name };
}
function teamSyncValue(raw) {
  if (raw === null) return null;
  teamSyncAssert(lanSyncObject(raw) && Object.keys(raw).every(key => ['text','done','priority','due','assignee'].includes(key))
    && teamSyncText(raw.text, 2000) && raw.text.trim() && typeof raw.done === 'boolean'
    && ['low','mid','high'].includes(raw.priority) && (raw.assignee === '' || lanSyncDevice(raw.assignee))
    && typeof raw.due === 'string' && (raw.due === '' || /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(raw.due)));
  if (raw.due) {
    const iso = raw.due.length === 10 ? raw.due + 'T12:00:00Z' : raw.due + (raw.due.length === 16 ? ':00' : '') + 'Z';
    teamSyncAssert(!Number.isNaN(Date.parse(iso)), '截止时间无效。');
  }
  return { text:raw.text.trim(), done:raw.done, priority:raw.priority, due:raw.due, assignee:raw.assignee };
}
function teamSyncActor(raw) {
  teamSyncAssert(lanSyncObject(raw) && lanSyncDevice(raw.device) && teamSyncText(raw.name));
  return { device:raw.device, name:raw.name };
}
function teamSyncRecord(raw) {
  teamSyncAssert(lanSyncObject(raw) && lanSyncDevice(raw.id) && teamSyncInteger(raw.revision) && raw.revision > 0
    && Number.isSafeInteger(raw.createdAt) && raw.createdAt > 0 && Number.isSafeInteger(raw.updatedAt) && raw.updatedAt > 0);
  return { id:raw.id, revision:raw.revision, value:teamSyncValue(raw.value), origin:teamSyncActor(raw.origin),
    updatedBy:teamSyncActor(raw.updatedBy), createdAt:raw.createdAt, updatedAt:raw.updatedAt };
}
function teamSyncOperation(raw) {
  teamSyncAssert(lanSyncObject(raw) && lanSyncDevice(raw.id) && teamSyncInteger(raw.seq) && raw.seq > 0 && teamSyncInteger(raw.base));
  return { id:raw.id, seq:raw.seq, base:raw.base, value:teamSyncValue(raw.value) };
}
function teamSyncCanSee(record, policy, device) {
  return !!record?.value && policy.syncTodos && (policy.visibility === 'all' || record.value.assignee === device);
}
function teamSyncCanEdit(record, policy, device) {
  return teamSyncCanSee(record, policy, device) && (policy.role === 'admin' || (policy.role === 'editor' && record.value.assignee === device));
}
function teamSyncAuthorize(state, actor, policy, op) {
  teamSyncAssert(policy.syncTodos, '管理员已关闭待办同步。');
  const old = state.tasks[op.id];
  if (policy.role === 'admin') return;
  teamSyncAssert(policy.role === 'editor', '当前设备只有查看权限。');
  if (!old && op.base === 0 && op.value) {
    teamSyncAssert(policy.canCreate, '当前设备没有创建权限。');
    teamSyncAssert(op.value.assignee === actor.device, '新建待办只能分配给自己。');
  } else {
    teamSyncAssert(teamSyncCanEdit(old, policy, actor.device), '当前待办已不在你的可编辑范围。');
    teamSyncAssert(op.value !== null || policy.canDelete, '当前设备没有删除权限。');
    teamSyncAssert(op.value === null || op.value.assignee === old.value.assignee, '只有管理员可以调整负责人。');
  }
}
function teamSyncApply(state, actor, op, now = Date.now(), origin = null) {
  const old = state.tasks[op.id];
  teamSyncAssert(old || Object.keys(state.tasks).length < TEAM_SYNC_LIMIT, '团队待办记录已达 400 条（含删除记录）。');
  state.revision++;
  state.tasks[op.id] = { id:op.id, revision:state.revision, value:op.value,
    origin:old?.origin || origin || actor, updatedBy:actor, createdAt:old?.createdAt || now, updatedAt:now };
}
function teamSyncProcess(state, peer, raw) {
  const op = teamSyncOperation(raw);
  const previous = peer.receipt;
  if (previous && op.seq === previous.seq) return previous;
  teamSyncAssert(op.seq === (previous?.seq || 0) + 1, '团队修改序号不连续，请重新同步。');
  const actor = { device:peer.device, name:peer.name };
  let result;
  try {
    const policy = teamSyncPolicy(peer.policy);
    teamSyncAuthorize(state, actor, policy, op);
    const old = state.tasks[op.id];
    if ((old?.revision || 0) !== op.base) {
      teamSyncAssert(state.conflicts.length < 100, '冲突记录已满，请先由管理员处理。');
      state.conflicts.push({ ...op, token:peer.id + ':' + op.seq, device:peer.device, name:peer.name, time:Date.now(), origin:old?.origin || actor });
      result = { seq:op.seq, status:'conflict', reason:'另一台设备已更新此待办，已保留草稿并交管理员处理。' };
    } else {
      teamSyncApply(state, actor, op);
      result = { seq:op.seq, status:'accepted', reason:'' };
    }
  } catch (error) { result = { seq:op.seq, status:'rejected', reason:error.message }; }
  peer.receipt = result;
  return result;
}
function teamSyncSnapshot(state, peer) {
  const policy = teamSyncPolicy(peer.policy);
  const tasks = Object.values(state.tasks).filter(task => teamSyncCanSee(task, policy, peer.device));
  const members = [{ device:state.team.host, name:state.name }, ...state.peers.map(member => ({ device:member.device, name:member.name }))];
  const result = { team:state.team, revision:state.revision, tasks, policy, members };
  teamSyncAssert(JSON.stringify(result).length < TEAM_SYNC_BYTES, '团队数据超过传输上限，请精简待办。');
  return result;
}
function teamSyncReadSnapshot(raw, team, device) {
  teamSyncAssert(lanSyncObject(raw) && JSON.stringify(raw).length < TEAM_SYNC_BYTES && raw.team?.id === team.id && raw.team?.host === team.host
    && teamSyncInteger(raw.revision) && Array.isArray(raw.tasks) && raw.tasks.length <= TEAM_SYNC_LIMIT
    && Array.isArray(raw.members) && raw.members.length <= 9);
  const policy = teamSyncPolicy(raw.policy);
  teamSyncAssert(policy.role !== 'admin', '成员不能从网络获得管理员身份。');
  const tasks = {};
  for (const rawTask of raw.tasks) {
    const task = teamSyncRecord(rawTask);
    teamSyncAssert(!tasks[task.id] && task.revision <= raw.revision && teamSyncCanSee(task, policy, device));
    tasks[task.id] = task;
  }
  const members = raw.members.map(teamSyncActor);
  teamSyncAssert(new Set(members.map(member => member.device)).size === members.length);
  return { team:teamSyncInfo(raw.team), revision:raw.revision, tasks, policy, members };
}
