// custom-components-example.js — 同一份模板供商店下载和开发示例使用。
function cockpitReadingProgressExample(ctx) {
  let state;
  const draw=()=>ctx.render({tag:'div',class:'reading',children:[
    {tag:'p',text:ctx.language==='en'?'Reading goal for this week':'本周阅读目标'},
    {tag:'strong',class:'reading-number',text:state.count+' / '+state.goal},
    {tag:'progress',key:'progress',label:'Reading progress',value:Math.round(state.count/state.goal*100)},
    {tag:'div',class:'reading-actions',children:[
      {tag:'button',key:'add',text:ctx.language==='en'?'Finish one chapter':'读完一章',action:'add'},
      {tag:'button',key:'reset',text:ctx.language==='en'?'Reset':'重置',action:'reset'}
    ]}
  ]});
  const save=async()=>{await ctx.storage.set(state);draw();};
  ctx.on('add',async()=>{state.count=Math.min(state.goal,state.count+1);await save();});
  ctx.on('reset',async()=>{state.count=0;await save();});
  return ctx.storage.get().then(saved=>{state={count:Math.max(0,Math.min(10,Number(saved?.count)||0)),goal:10};draw();});
}
function cockpitCustomExamplePackage() {
  return {manifest:{id:'example.reading-progress',name:'阅读进度',description:'记录本周阅读进度；数据保存在本机，可用于学习组件接口。',version:'1.0.0',apiVersion:1,icon:'book-open',category:'knowledge',entry:'main.js',styles:'styles.css',permissions:[]},
    code:'module.exports = { mount: '+cockpitReadingProgressExample.toString()+' };',
    styles:'.reading { display:flex; flex-direction:column; gap:12px; padding:8px; } .reading-number { font-size:28px; font-weight:700; color:var(--ck-accent); } .reading-actions { display:flex; flex-wrap:wrap; gap:8px; }'};
}
if(typeof module!=='undefined'&&module.exports&&typeof PLUGIN_ID==='undefined')module.exports={cockpitCustomExamplePackage};
