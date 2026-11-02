module.exports = { mount: function cockpitReadingProgressExample(ctx) {
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
} };
