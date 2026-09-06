const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({ console, require, Buffer });
for (const name of ['lan-sync-core','team-sync-core']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/' + name + '.js'),'utf8'),ctx);
}
vm.runInContext(`
  this.policy = teamSyncPolicy;
  this.defaults = teamSyncDefaultPolicy;
  this.authorize = teamSyncAuthorize;
  this.canEdit = teamSyncCanEdit;
  this.canComplete = teamSyncCanComplete;
  this.canReassign = teamSyncCanReassign;
  this.canDelete = teamSyncCanDelete;
`,ctx);

const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32), D = 'd'.repeat(32), ID = 'e'.repeat(32);
const value = (text = 'Original', overrides = {}) => ({ text, done:false, priority:'mid', due:'', assignee:B, ...overrides });
const record = { id:ID, revision:1, value:value(), origin:{device:B,name:'Bob'}, updatedBy:{device:B,name:'Bob'}, createdAt:1, updatedAt:1 };
const state = { team:{id:'f'.repeat(32),host:A,name:'Studio'}, peers:[{device:B},{device:C}], tasks:{[ID]:record} };
const actor = { device:B, name:'Bob' };
const operation = next => ({ id:ID, seq:1, base:1, value:next });

const legacy = ctx.policy({ role:'editor', visibility:'all', canCreate:true, canDelete:false, syncTodos:true });
assert.equal(legacy.canEdit,true,'Existing editors retain their previous edit access');
assert.equal(legacy.canComplete,true,'Existing editors retain their previous completion access');
assert.equal(legacy.canReassign,false,'Upgrades never silently grant reassignment access');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.defaults())), {
  role:'editor',visibility:'all',canCreate:true,canEdit:true,canComplete:true,canReassign:false,canDelete:false,syncTodos:true
});

const viewer = ctx.policy({ ...ctx.defaults(), role:'viewer', canReassign:true, canDelete:true });
assert.equal(viewer.canCreate,false);assert.equal(viewer.canEdit,false);assert.equal(viewer.canComplete,false);
assert.equal(viewer.canReassign,false);assert.equal(viewer.canDelete,false);

const completionOnly = ctx.policy({ ...ctx.defaults(), canEdit:false, canComplete:true, canDelete:false });
assert.equal(ctx.canEdit(record,completionOnly,B),false);
assert.equal(ctx.canComplete(record,completionOnly,B),true);
assert.doesNotThrow(() => ctx.authorize(state,actor,completionOnly,operation(value('Original',{done:true}))));
assert.throws(() => ctx.authorize(state,actor,completionOnly,operation(value('Changed'))),/没有编辑内容/);
assert.throws(() => ctx.authorize(state,actor,completionOnly,operation(null)),/没有删除权限/);
assert.throws(() => ctx.authorize(state,actor,completionOnly,operation(value('Original',{assignee:C}))),/没有转派/);

const assigner = ctx.policy({ ...ctx.defaults(), canEdit:false, canComplete:false, canReassign:true });
assert.equal(ctx.canReassign(record,assigner,B),true);
assert.doesNotThrow(() => ctx.authorize(state,actor,assigner,operation(value('Original',{assignee:C}))));
assert.doesNotThrow(() => ctx.authorize(state,actor,assigner,{id:'1'.repeat(32),seq:1,base:0,value:value('New',{assignee:C})}));
assert.throws(() => ctx.authorize(state,actor,assigner,{id:'2'.repeat(32),seq:1,base:0,value:value('Unknown',{assignee:D})}),/负责人已退出/);

const deleter = ctx.policy({ ...ctx.defaults(), canEdit:false, canComplete:false, canDelete:true });
assert.equal(ctx.canDelete(record,deleter,B),true);
assert.doesNotThrow(() => ctx.authorize(state,actor,deleter,operation(null)));
assert.throws(() => ctx.authorize(state,{device:C,name:'Carol'},deleter,operation(null)),/操作范围/);
assert.throws(() => ctx.policy({ ...ctx.defaults(), canEdit:null }),/数据格式/);

console.log('Team permissions: migration, granular server authorization, assignment validation and viewer isolation passed');
