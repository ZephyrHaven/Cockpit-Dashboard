const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const date=text=>({format:format=>format==='YYYY-MM-DD'?text.slice(0,10):text});
const context=vm.createContext({require,console:{warn(){}},TODO_FILE:'_data/todos.md',window:{moment:()=>date('2026-09-17')},parseDate:date,
  ensureTodoIds:require('../src/todo-focus.js').ensureTodoIds,
  extractTags:raw=>({cleanText:raw,tags:[],priority:'mid',dueDate:null,dueHasTime:false})});
for(const name of ['todo-repeat','todos','todo-bulk'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),context);
vm.runInContext('this.api={mutateTodos,applyTodoUndo,history:cockpitTodoUndo};',context);
(async()=>{
  let content='<!-- keep -->\n- [ ] A | id:a | owner:alice\n- [ ] B | id:b\n';let fail=false;
  const vault={getAbstractFileByPath:()=>({}),read:async()=>content,modify:async(_,text)=>{if(fail)throw Error('disk');content=text;}};
  const api=context.api;
  await api.mutateTodos(vault,todos=>{todos.find(todo=>todo.id==='a').done=true;todos.find(todo=>todo.id==='a').doneDate=date('2026-09-17');});
  const frame=api.history.get(vault).at(-1);
  content=content.replace('- [ ] B','- [ ] B edited elsewhere');
  let result=await api.mutateTodos(vault,todos=>api.applyTodoUndo(todos,frame),{undo:false});
  assert.equal(result.saved,true);assert.match(content,/- \[ \] A/);assert.match(content,/B edited elsewhere/);assert.match(content,/<!-- keep -->/);assert.match(content,/owner:alice/);
  await api.mutateTodos(vault,todos=>{todos.splice(0,1);});const deletion=api.history.get(vault).at(-1);
  result=await api.mutateTodos(vault,todos=>api.applyTodoUndo(todos,deletion),{undo:false});assert.equal(result.saved,true);assert.match(content,/- \[ \] A/);
  await api.mutateTodos(vault,todos=>{todos.find(todo=>todo.id==='a').done=true;});const completion=api.history.get(vault).at(-1);
  content=content.replace('- [x] A','- [x] A newer');const before=content;
  result=await api.mutateTodos(vault,todos=>api.applyTodoUndo(todos,completion),{undo:false});assert.equal(result.saved,false);assert.equal(content,before,'Conflicting undo leaves the entire group untouched.');
  const length=api.history.get(vault).length;fail=true;await api.mutateTodos(vault,todos=>todos.splice(0,1));assert.equal(api.history.get(vault).length,length,'Failed saves never enter undo history.');
  console.log('Committed undo, preservation and conflict checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
