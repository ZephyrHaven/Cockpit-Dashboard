const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const core = require('../src/lan-sync-core');
// Verify the bundled generation/decoding libraries agree on a full pairing payload.
const qr = require('qrcode'), decode = require('jsqr');
const qrText = JSON.stringify({kind:'cockpit-lan-v1',id:'1'.repeat(32),key:'2'.repeat(64),hosts:['192.168.1.2'],port:23456,expires:Date.now()+300000});
const matrix = qr.create(qrText, {errorCorrectionLevel:'M'}).modules;
const scale=5, margin=4, size=(matrix.size+margin*2)*scale;
const pixels = new Uint8ClampedArray(size*size*4).fill(255);
for(let y=0;y<matrix.size;y++) for(let x=0;x<matrix.size;x++) if(matrix.get(y,x)) {
  for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++) {
    const i=(((y+margin)*scale+dy)*size+(x+margin)*scale+dx)*4;
    pixels[i]=pixels[i+1]=pixels[i+2]=0;
  }
}
assert.equal(decode(pixels,size,size)?.data, qrText);

const A = 'a'.repeat(32), B = 'b'.repeat(32);
const initial = core.lanSyncCapture({}, {}, { 'todo:one':'- [ ] Task | id:one' }, A);
const aEdit = core.lanSyncCapture(initial, core.lanSyncProjection(initial), { 'todo:one':'- [x] Task | id:one' }, A);
const bEdit = core.lanSyncCapture(initial, core.lanSyncProjection(initial), { 'todo:one':'- [ ] Revised | id:one' }, B);
const merged = core.lanSyncMerge(aEdit, bEdit);
assert.deepEqual(merged, core.lanSyncMerge(bEdit, aEdit));
assert.deepEqual(merged, core.lanSyncMerge(merged, merged));
assert.equal(core.lanSyncConflicts(merged).length, 1);
const resolved = core.lanSyncResolve(merged, 'todo:one', '- [x] Task | id:one', A);
assert.equal(core.lanSyncConflicts(core.lanSyncMerge(resolved, bEdit)).length, 0);
const deleted = core.lanSyncCapture(initial, core.lanSyncProjection(initial), {}, A);
assert.deepEqual(core.lanSyncProjection(core.lanSyncMerge(deleted, initial)), {});
assert.equal(core.lanSyncConflicts(core.lanSyncMerge(deleted, bEdit)).length, 1);
assert.equal(core.lanSyncProjection(core.lanSyncMerge(deleted, bEdit))['todo:one'], '- [ ] Revised | id:one');
assert.throws(() => core.lanSyncValidate({ 'pref:apiKey':[{ clock:{ [A]:1 }, value:'secret' }] }));
assert.throws(() => core.lanSyncValidate({ 'bookmark:../private':[{ clock:{ [A]:1 }, value:'1' }] }));
assert.throws(() => core.lanSyncValidate({ 'todo:one':[{ clock:{ [A]:1 }, value:'- [ ] Inject\nextra | id:one' }] }));
for (const ip of ['8.8.8.8', '127.0.0.1', '192.168.1.999', '192.168.01.1', 'localhost', '10.0.0.1.evil']) assert.equal(core.lanSyncPrivateIp(ip), false);
for (const ip of ['10.0.0.1', '192.168.2.2', '172.31.1.2']) assert.equal(core.lanSyncPrivateIp(ip), true);
const invite = { kind:'cockpit-lan-v1', id:A, key:'c'.repeat(64), hosts:['192.168.1.2'], port:3456, expires:Date.now()+60000 };
assert.equal(core.lanSyncParseInvite(JSON.stringify(invite)).id, A);
assert.throws(() => core.lanSyncParseInvite(JSON.stringify({ ...invite, expires:0 })));
const context = vm.createContext({ require, Buffer, setTimeout, clearTimeout, setInterval, clearInterval, console,
  TODO_FILE:'_data/todos.md', BOOKMARK_FILE:'_data/bookmarks.md', VIEW_TYPE:'dashboard', queueTodoFileMutation:fn=>fn(), cockpitRunVaultRefresh() {} });
for (const file of ['lan-sync-core', 'lan-sync-transport', 'lan-sync-store']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/'+file+'.js'), 'utf8'), context);
vm.runInContext('this.Transport = CockpitLanTransport; this.Store = CockpitLanStore; this.seal = lanSyncSeal; this.unseal = lanSyncUnseal;', context);
const key = crypto.randomBytes(32).toString('hex');
const frame = context.seal(crypto, key, A, { secret:'private task' }, 'request');
assert.ok(!JSON.stringify(frame).includes('private task'));
assert.equal(context.unseal(crypto, key, frame, 'request').secret, 'private task');
assert.throws(() => context.unseal(crypto, key, { ...frame, tag:'0'.repeat(32) }, 'request'));
assert.throws(() => context.unseal(crypto, key, frame, 'response'));
async function makeStore(root) {
  await fsp.mkdir(path.join(root, 'plugin'), { recursive:true });
  await fsp.mkdir(path.join(root, '_data'), { recursive:true });
  let data = { storageMigrationCompleted:true, bookmarks:[], username:'Name', language:'en', ai:{ apiKey:'DO-NOT-SYNC' }, localCommands:['DO-NOT-SYNC'] };
  const vault = {
    adapter:{ exists:async p=>fs.existsSync(path.join(root,p)), read:p=>fsp.readFile(path.join(root,p),'utf8'), write:(p,v)=>fsp.writeFile(path.join(root,p),v) },
    getAbstractFileByPath:p=>fs.existsSync(path.join(root,p)) ? { path:p } : null,
    read:file=>fsp.readFile(path.join(root,file.path),'utf8'), modify:(file,v)=>fsp.writeFile(path.join(root,file.path),v),
    create:async (p,v)=>{ await fsp.writeFile(path.join(root,p),v); return { path:p }; }, createFolder:p=>fsp.mkdir(path.join(root,p),{recursive:true})
  };
  const plugin = { manifest:{dir:'plugin'}, app:{vault,workspace:{getLeavesOfType:()=>[]}}, mutateData:async fn=>{ const copy = structuredClone(data); await fn(copy); data=copy; return data; } };
  const store = new context.Store(plugin); await store.load();
  return { store, vault, getData:()=>data, setData:fn=>fn(data), root };
}
(async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(),'cockpit-lan-test-'));
  const transports = [];
  try {
    const left = await makeStore(path.join(tmp,'a')); const right = await makeStore(path.join(tmp,'b'));
    const taskPath = '_data/todos.md';
    await fsp.writeFile(path.join(left.root,taskPath),'# Tasks\n\n- [ ] First | id:one\n\nKeep my notes here.\n');
    left.setData(data=>{data.bookmarks=['Notes/One.md'];});
    let doc = await left.store.exchange();
    assert.ok(!JSON.stringify(doc).includes('DO-NOT-SYNC'));
    doc = await right.store.exchange(doc); await left.store.exchange(doc);
    assert.ok((await fsp.readFile(path.join(right.root,taskPath),'utf8')).includes('First'));
    assert.deepEqual(right.getData().bookmarks, ['Notes/One.md']);
    assert.equal(right.getData().ai.apiKey,'DO-NOT-SYNC');
    assert.ok(fs.existsSync(path.join(right.root,right.store.state.lastBackup)));
    // Offline edits preserve both alternatives and arbitrary prose; choosing a version converges.
    await fsp.writeFile(path.join(left.root,taskPath),'# Tasks\n\n- [x] First | id:one\n\nKeep my notes here.\n');
    await fsp.writeFile(path.join(right.root,taskPath),'- [ ] Edited | id:one');
    const ldoc = await left.store.exchange(); const rdoc = await right.store.exchange();
    doc = await left.store.exchange(rdoc); await right.store.exchange(doc);
    assert.equal(core.lanSyncConflicts(left.store.state.doc).length,1);
    assert.ok((await fsp.readFile(path.join(left.root,taskPath),'utf8')).includes('Keep my notes here.'));
    doc = await left.store.exchange({}, {key:'todo:one', value:'- [x] First | id:one'}); await right.store.exchange(doc);
    assert.equal(core.lanSyncConflicts(right.store.state.doc).length,0);
    // Delete and reconnect to an old replica: no resurrection.
    await fsp.writeFile(path.join(left.root,taskPath),'# Tasks\nKeep my notes here.\n');
    doc = await left.store.exchange(); await right.store.exchange(doc);
    assert.ok(!(await fsp.readFile(path.join(right.root,taskPath),'utf8')).includes('id:one'));
    assert.ok(!core.lanSyncProjection(core.lanSyncMerge(doc,ldoc))['todo:one']);
    // No-op rounds do not rewrite metadata. A backup failure stops before touching user data.
    const originalWrite = left.vault.adapter.write;
    let writes=0;
    left.vault.adapter.write=async (...args)=>{ writes++; return originalWrite(...args); };
    await left.store.exchange(); await left.store.exchange();
    assert.equal(writes,0);
    const incoming=core.lanSyncCapture({}, {}, {'bookmark:Notes/New.md':'1'}, B);
    left.vault.adapter.write=async (p,value)=>{ if(p.includes('.backup-')) throw Error('Disk full'); return originalWrite(p,value); };
    await assert.rejects(()=>left.store.exchange(incoming), /Disk full/);
    assert.ok(!left.getData().bookmarks.includes('Notes/New.md'));
    left.vault.adapter.write=originalWrite;
    await left.store.exchange(incoming);
    assert.ok(left.getData().bookmarks.includes('Notes/New.md'));
    // Real HTTP endpoints with separate stores: accept only after confirmation, rotate the QR key.
    const serverPeers = []; let confirmations=0;
    const host = new context.Transport({ allowLoopback:true, device:()=>A,name:()=> 'Host',peers:()=>serverPeers, confirm:async()=>{confirmations++;return true;},addPeer:async peer=>serverPeers.push(peer),merge:remote=>left.store.exchange(remote) }); transports.push(host);
    const port = await host.start(0,'127.0.0.1');
    host.invite={...invite,port,hosts:['127.0.0.1']};
    const client = new context.Transport({ allowLoopback:true,device:()=>B,name:()=> 'Client',peers:()=>[] }); transports.push(client);
    const pair = await client.request(host.invite,'pair');
    assert.equal(confirmations,1); assert.notEqual(pair.key, invite.key); assert.equal(host.invite,null);
    const target={...invite,port,hosts:['127.0.0.1'],key:pair.key};
    const response=await client.request(target,'sync',{doc:await right.store.exchange()});
    await right.store.exchange(response.doc);
    await assert.rejects(()=>client.request({...target,key:'f'.repeat(64)},'sync',{doc:{}}));
    await assert.rejects(()=>client.request(target,'sync',{doc:{'pref:apiKey':[]}}));
    serverPeers.splice(0);
    await assert.rejects(()=>client.request(target,'sync',{doc:{}}));
    console.log('LAN merge, conflict, deletion, storage, encryption, pairing and revocation tests passed');
  } finally { transports.forEach(t=>t.stop()); await fsp.rm(tmp,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
