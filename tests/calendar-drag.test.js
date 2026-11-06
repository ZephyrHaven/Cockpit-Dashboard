const assert=require('node:assert/strict');
const {bindCalendarTodoDrag}=require('../src/calendar-drag.js');
global.PLUGIN_ID='cockpit-dashboard';
class Target {
  constructor(){this.attrs={};this.listeners={};this.classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),remove:(...xs)=>xs.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x)};}
  setAttribute(k,v){this.attrs[k]=v;}addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);}querySelectorAll(){return [drop];}
  closest(){return this.control||null;}
  dispatch(type,extra={}){const event={target:this,stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},preventDefault(){this.prevented=true;},...extra};for(const handler of this.listeners[type]||[])handler(event);return event;}
}
const drop=new Target(),root=new Target(),el=new Target();
const todo={raw:{id:'task-id'},done:false};
bindCalendarTodoDrag(el,todo,()=>root);
assert.equal(el.attrs.draggable,'true');
el.dispatch('pointerdown');assert.equal(el.dispatch('click').prevented,undefined,'A normal click is not consumed.');
const payload=new Map(),dataTransfer={setData:(type,value)=>payload.set(type,value)};
el.dispatch('dragstart',{dataTransfer});assert.equal(payload.get('application/x-cockpit-todo'),'task-id');assert.equal(payload.get('application/x-cockpit-calendar'),'1');assert.equal(dataTransfer.effectAllowed,'move');assert.ok(root.classes.has('is-dragging-todo'));
drop.classList.add('todo-drop-target');el.dispatch('dragend');assert.ok(!root.classes.has('is-dragging-todo'));assert.ok(!drop.classes.has('todo-drop-target'));
assert.equal(el.dispatch('click').stopped,true,'Dropping or cancelling cannot accidentally open the task detail.');
el.dispatch('pointerdown');assert.equal(el.dispatch('click').prevented,undefined,'The next intentional click opens normally.');
const control=new Target();el.control=control;el.dispatch('pointerdown');assert.equal(el.dispatch('dragstart',{dataTransfer}).prevented,true,'Alarm and edit buttons keep their own interaction.');
el.control=null;el.dispatch('pointerdown');root.control={};assert.equal(el.dispatch('dragstart',{dataTransfer}).prevented,true,'Layout editing cannot initiate a task drag.');root.control=null;
for(const disabled of [{...todo,done:true},{...todo,teamTodo:true},{raw:{}}]){const target=new Target();bindCalendarTodoDrag(target,disabled,()=>root);assert.equal(target.attrs.draggable,undefined);}
console.log('Calendar drag payload, click separation, controls and cancellation passed');
