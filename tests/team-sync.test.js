const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ctx = vm.createContext({ require, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval });
for (const name of ['lan-sync-core','lan-sync-transport','team-sync-core','team-sync']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/'+name+'.js'),'utf8'),ctx);
vm.runInContext(`
  const RealTeamTransport = CockpitLanTransport;
  CockpitLanTransport = class extends RealTeamTransport {
    constructor(options) { super({ ...options, allowLoopback:true }); }
    addresses() { return ['192.168.1.20']; }
    start(port) { return super.start(port,'127.0.0.1'); }
    request(peer, kind, extra) { return super.request({ ...peer, hosts:['127.0.0.1'] },kind,extra); }
  };
  class CockpitTeamApprovalModal { constructor(app,service,name,resolve) { this.resolve=resolve; } close() {} }
  this.Service = CockpitTeamSync; this.Transport = CockpitLanTransport;
  this.policy = teamSyncDefaultPolicy; this.record = teamSyncRecord;
`,ctx);
const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32);
const clone = value => JSON.parse(JSON.stringify(value));
const task = (text,assignee=B) => ({ text,assignee,done:false,priority:'mid',due:'' });
const id = () => crypto.randomBytes(16).toString('hex');
function make(device, files = new Map()) {
  const adapter = { exists:async path => files.has(path), read:async path => files.get(path), write:async (path,text) => files.set(path,text) };
  const plugin = { lanSync:{ store:{ path:'plugin/lan-sync-machine.json',state:{ device },load:async () => {} } }, app:{ vault:{ adapter } }, registerInterval() {} };
  const service = new ctx.Service(plugin);
  let approval = ctx.policy();
  service.openModal = modal => modal.resolve(approval);
  return { service,files,adapter,plugin,approve:policy => { approval=policy; } };
}
async function untilIdle(service) { if (service.running) await new Promise(resolve => { const t=setInterval(()=>{if(!service.running){clearInterval(t);resolve();}},5); }); }
(async () => {
  const host = make(A), bob = make(B), carol = make(C);
  const services = [host.service,bob.service,carol.service];
  try {
    for (const [entry,name] of [[host,'Host'],[bob,'Bob laptop'],[carol,'Carol PC']]) { await entry.service.load(); await entry.service.transaction(state=>{state.name=name;}); }
    await host.service.create('Studio');
    await bob.service.pair(await host.service.offer());
    host.approve({ ...ctx.policy(),role:'viewer' });
    await carol.service.pair(await host.service.offer());
    assert.equal(host.service.state.peers.length,2);
    assert.equal(carol.service.policy().role,'viewer');
    // New member creates offline, then real encrypted HTTP host -> third member preserves provenance.
    await bob.service.pause();
    await bob.service.submit(null,0,task('Team task'));
    const firstId = bob.service.state.pending[0].id;
    assert.equal(Object.keys(host.service.state.tasks).length,0);
    await bob.service.start(); await bob.service.sync(); await carol.service.sync();
    assert.equal(carol.service.state.tasks[firstId].origin.device,B);
    assert.equal(carol.service.state.tasks[firstId].origin.name,'Bob laptop');
    assert.equal(bob.service.state.pending.length,0);
    // Read-only and role spoofing cannot mutate the host, even with a valid device key.
    const forged = { seq:1,id:firstId,base:host.service.state.tasks[firstId].revision,value:task('forged'),role:'admin',origin:{device:A} };
    const answer=await carol.service.transport.request(carol.service.state.peers[0],'team-sync',{team:{teamId:host.service.state.team.id,operation:forged}});
    assert.equal(answer.team.receipt.status,'rejected');
    assert.equal(host.service.state.tasks[firstId].value.text,'Team task');
    await assert.rejects(()=>carol.service.submit(firstId,carol.service.state.tasks[firstId].revision,task('No')));
    // A member cannot reassign a task, delete without permission, or change someone else's task.
    const bobPeer = host.service.state.peers.find(peer=>peer.device===B);
    let sequence=bobPeer.receipt.seq+1;
    for (const value of [task('reassign',C),null]) {
      const result=await host.service.receive(bobPeer.id,{teamId:host.service.state.team.id,operation:{seq:sequence++,id:firstId,base:host.service.state.tasks[firstId].revision,value}});
      assert.equal(result.receipt.status,'rejected');
    }
    // Resuming pairing aligns persistent sequence receipts after interrupted requests.
    host.approve(ctx.policy());
    await bob.service.pair(await host.service.offer());
    assert.equal(bob.service.state.nextSeq,sequence);
    const privateId=id(); await host.service.submit(privateId,0,task('Carol only',C));
    await host.service.updateMember(B,{...ctx.policy(),visibility:'assigned'});
    await bob.service.sync();
    assert.equal(bob.service.state.tasks[privateId],undefined);
    const unauthorized=await host.service.receive(host.service.state.peers.find(peer=>peer.device===B).id,{teamId:host.service.state.team.id,operation:{seq:sequence++,id:privateId,base:host.service.state.tasks[privateId].revision,value:task('steal',B)}});
    assert.equal(unauthorized.receipt.status,'rejected');
    assert.ok(!JSON.stringify(unauthorized).includes('Carol only'));
    await bob.service.pair(await host.service.offer());
    // Scope reduction removes cache without deleting authoritative records.
    await host.service.updateMember(C,{...ctx.policy(),role:'viewer',visibility:'assigned'});
    await carol.service.sync();
    assert.equal(carol.service.state.tasks[firstId],undefined);
    assert.ok(host.service.state.tasks[firstId]);
    await host.service.updateMember(C,{...ctx.policy(),role:'viewer',syncTodos:false});
    await carol.service.sync(); assert.equal(Object.keys(carol.service.state.tasks).length,0);
    // Concurrent edits retain both versions, admin resolves with a revision guard.
    await bob.service.pause();
    const old=bob.service.state.tasks[firstId];
    await bob.service.submit(firstId,old.revision,task('Bob offline'));
    await host.service.submit(firstId,old.revision,task('Host edit'));
    await bob.service.start(); await bob.service.sync();
    assert.equal(bob.service.state.drafts.at(-1).value.text,'Bob offline');
    const conflict=host.service.state.conflicts.at(-1);
    assert.equal(conflict.value.text,'Bob offline');
    assert.equal(host.service.state.tasks[firstId].value.text,'Host edit');
    await assert.rejects(()=>host.service.resolve(conflict,true,old.revision));
    await host.service.resolve(conflict,true,host.service.state.tasks[firstId].revision);
    await bob.service.sync();
    assert.equal(bob.service.state.tasks[firstId].value.text,'Bob offline');
    assert.equal(bob.service.state.tasks[firstId].origin.device,B);
    // A lost response is retried once, never applied twice or duplicated into a conflict.
    await bob.service.pause();
    await bob.service.submit(null,0,task('Lost reply'));
    const op=clone(bob.service.state.pending[0]); const peer=host.service.state.peers.find(peer=>peer.device===B);
    await host.service.receive(peer.id,{teamId:host.service.state.team.id,operation:{...op,origin:{device:A,name:'Spoofed'},role:'admin'}});
    assert.equal(host.service.state.tasks[op.id].origin.device,B);
    const revision=host.service.state.revision;
    await bob.service.start(); await bob.service.sync();
    assert.equal(host.service.state.revision,revision);
    assert.equal(bob.service.state.pending.length,0);
    // Permission changed while offline: retain the attempted edit as a draft, do not apply.
    await bob.service.pause();
    await bob.service.submit(firstId,bob.service.state.tasks[firstId].revision,task('revoked edit'));
    await host.service.updateMember(B,{...ctx.policy(),role:'viewer'});
    await bob.service.start(); await bob.service.sync();
    assert.equal(bob.service.state.drafts.at(-1).value.text,'revoked edit');
    assert.notEqual(host.service.state.tasks[firstId].value.text,'revoked edit');
    // Team endpoint rejects personal synchronization and wrong team IDs.
    await assert.rejects(()=>bob.service.transport.request(bob.service.state.peers[0],'sync',{doc:{}}));
    await assert.rejects(()=>host.service.receive(peer.id,{teamId:id(),operation:null}));
    const personal = new ctx.Transport({device:()=>B,name:()=> 'Personal',peers:()=>[]}); services.push(personal);
    await assert.rejects(()=>personal.request(bob.service.state.peers[0],'team-sync',{team:{teamId:host.service.state.team.id}}));
    // A revoked credential cannot read even an empty snapshot.
    await host.service.removeMember(C);
    await assert.rejects(()=>carol.service.sync());
    // Persisted operations, sources, roles and receipts survive restart; personal store is untouched.
    const restarted=make(A,host.files); services.push(restarted.service);
    await restarted.service.load();
    assert.equal(restarted.service.state.tasks[firstId].origin.device,B);
    assert.equal(restarted.service.state.peers[0].policy.role,'viewer');
    assert.ok([...host.files.keys()].every(path=>path.startsWith('plugin/team-sync-')));
    assert.equal(host.plugin.lanSync.store.state.device,A);
    // Backup failure stops mutation before commit; journal recovers a failed primary-file write.
    const before=clone(restarted.service.state);
    const write=restarted.adapter.write;
    restarted.adapter.write=async(path,text)=>{if(path.includes('.backup-'))throw Error('Disk full');return write(path,text);};
    await assert.rejects(()=>restarted.service.submit(null,0,task('not committed')),/Disk full/);
    assert.deepEqual(clone(restarted.service.state),before);
    restarted.adapter.write=async(path,text)=>{if(path===restarted.service.path)throw Error('Primary failed');return write(path,text);};
    const journalId=id();
    await assert.rejects(()=>restarted.service.submit(journalId,0,task('journal survives')),/Primary failed/);
    const recovery=make(A,host.files); services.push(recovery.service); await recovery.service.load();
    assert.equal(recovery.service.state.tasks[journalId].value.text,'journal survives');
    // Delete/reconnect never resurrects an old record; new scope snapshots remain independent.
    await host.service.submit(firstId,host.service.state.tasks[firstId].revision,null);
    await bob.service.sync(); assert.equal(bob.service.state.tasks[firstId],undefined);
    assert.equal(host.service.state.tasks[firstId].value,null);
    console.log('Team: three-device HTTP, authorization, scope, origin, offline conflicts, replay, revocation and recovery passed');
  } finally { for(const service of services)service.stop(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
