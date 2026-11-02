// custom-components-runtime.js — 只有受控消息跨越组件 Worker 与主页面边界。
function cockpitCustomWorkerMain() {
  const pending=new Map(),actions=new Map(),subscribers=new Set();let sequence=0,started=false;
  const send=message=>self.postMessage(message);
  const fail=error=>send({type:'error',message:String(error?.message||error).slice(0,300)});
  const call=(method,value)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});send({type:'request',id,method,value});});
  const run=fn=>Promise.resolve().then(fn).catch(fail);
  self.onmessage=event=>{
    const message=event.data||{};
    if(message.type==='ping'){send({type:'pong'});return;}
    if(message.type==='result'){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(new Error(message.error)):p.resolve(message.value);}return;}
    if(message.type==='event'){const fn=actions.get(message.action);if(fn)run(()=>fn(message.value));return;}
    if(message.type==='changed'){for(const fn of subscribers)run(()=>fn(message.scopes));return;}
    if(message.type!=='start'||started)return;started=true;
    run(async()=>{
      const api=Object.freeze({
        language:message.language,theme:message.theme,
        render:tree=>send({type:'render',tree}),
        storage:Object.freeze({get:()=>call('storage.get'),set:value=>call('storage.set',value)}),
        data:Object.freeze({todos:()=>call('data.todos'),focus:()=>call('data.focus')}),
        on:(action,fn)=>{if(typeof action!=='string'||typeof fn!=='function')throw new Error('Invalid action handler');actions.set(action,fn);return()=>actions.delete(action);},
        onDataChanged:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);},
        setInterval:(fn,ms)=>{const id=setInterval(()=>run(fn),Math.max(1000,Math.min(3600000,Number(ms)||1000)));return()=>clearInterval(id);}
      });
      if(typeof require!=='undefined'||typeof process!=='undefined'||typeof self.Buffer!=='undefined'||typeof self.module!=='undefined')throw new Error('当前宿主未隔离 Worker，组件已停止 / This host does not isolate component Workers.');
      const module={exports:{}};self.module=module;importScripts(message.componentURL);
      if(typeof module.exports.mount!=='function')throw new Error('组件必须导出 mount(ctx) / Export mount(ctx).');
      await module.exports.mount(api);send({type:'ready'});
    });
  };
  self.addEventListener('unhandledrejection',event=>{event.preventDefault();fail(event.reason);});
}
function cockpitCustomBrokerMain() {
  let token='',worker=null,url='',componentURL='',count=0,tick=Date.now();
  const send=message=>parent.postMessage({...message,token},'*');
  const stop=()=>{worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);if(componentURL)URL.revokeObjectURL(componentURL);url='';componentURL='';};
  window.addEventListener('message',event=>{
    if(event.source!==parent)return;const message=event.data||{};
    if(message.type==='init'&&!worker){
      token=message.token;
      try{
        url=URL.createObjectURL(new Blob([message.source],{type:'text/javascript'}));componentURL=URL.createObjectURL(new Blob([message.code],{type:'text/javascript'}));worker=new Worker(url);
        worker.onerror=event=>{event.preventDefault();send({type:'error',message:event.message||'Component execution failed.'});stop();};
        worker.onmessage=event=>{
          if(Date.now()-tick>1000){tick=Date.now();count=0;}
          if(++count>60){send({type:'error',message:'组件消息过于频繁 / Component message rate exceeded.'});stop();return;}
          const m=event.data;
          if(m&&['render','request','ready','pong','error'].includes(m.type))send(m);
        };
        worker.postMessage({type:'start',language:message.language,theme:message.theme,componentURL});
      }catch(error){send({type:'error',message:String(error.message)});stop();}
      return;
    }
    if(message.token!==token)return;
    if(message.type==='stop'){stop();return;}
    if(worker&&['ping','result','event','changed'].includes(message.type))worker.postMessage(message);
  });
}
function cockpitCustomBrokerDocument(nonce) {
  const csp="default-src 'none'; script-src 'nonce-"+nonce+"' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><script nonce="'+nonce+'">('+cockpitCustomBrokerMain.toString()+')();<'+ '/script>';
}
function cockpitCustomSafeCss(css) {
  // 只接收不加载资源的展示属性；未采用的构造样式表不触发 @import。
  const allowed=new Set(['color','background-color','border-color','border-top-color','border-bottom-color','border-width','border-style','border-radius','padding','padding-top','padding-bottom','padding-left','padding-right','margin','margin-top','margin-bottom','margin-left','margin-right','gap','row-gap','column-gap','display','grid-template-columns','grid-template-rows','align-items','justify-content','flex','flex-direction','flex-wrap','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-decoration','white-space','overflow-wrap','word-break','width','max-width','min-width','height','min-height','max-height','opacity']);
  const sheet=new CSSStyleSheet();sheet.replaceSync(css||'');const output=[];
  for(const rule of sheet.cssRules){
    if(rule.type!==1)continue;
    const declarations=[];
    for(const prop of rule.style)if(allowed.has(prop))declarations.push(prop+':'+rule.style.getPropertyValue(prop));
    if(declarations.length)output.push(rule.selectorText+'{'+declarations.join(';')+'}');
  }
  return output.join('\n');
}
function cockpitCustomRenderTree(parent,tree,dispatch,previous=new Map()) {
  const next=new Map();
  const patch=(container,nodes)=>{
    const keep=new Set();
    nodes.forEach((node,index)=>{
      let el=previous.get(node.key);if(!el||el.localName!==node.tag)el=document.createElement(node.tag);
      next.set(node.key,el);keep.add(el);
      el.className=node.class||'';
      if(node.label)el.setAttribute('aria-label',node.label);else el.removeAttribute('aria-label');
      if(node.tag==='button')el.type='button';
      if(node.tag==='input')el.type=node.type;
      if(['input','textarea','select','option'].includes(node.tag)){
        const value=node.value??'';if(el.value!==value&&el.getRootNode().activeElement!==el)el.value=value;
        el.placeholder=node.placeholder||'';el.disabled=!!node.disabled;el.maxLength=4000;
      }
      if(node.tag==='input')el.checked=!!node.checked;
      if(node.tag==='button')el.disabled=!!node.disabled;
      if(node.tag==='progress'){el.max=100;el.value=node.value;}
      el.onclick=node.action?()=>dispatch(node.action,{}):null;
      el.onchange=node.change?()=>dispatch(node.change,{value:String(el.value).slice(0,4000),checked:!!el.checked}):null;
      if(node.children?.length)patch(el,node.children);else if(el.textContent!==(node.text||''))el.textContent=node.text||'';
      if(container.children[index]!==el)container.insertBefore(el,container.children[index]||null);
    });
    for(const child of [...container.children])if(!keep.has(child))child.remove();
  };
  patch(parent,[tree]);return next;
}
function cockpitStartCustomRuntime(view,entry,host,onFailure) {
  const service=view._plugin.customComponents;const id=entry.manifest.id;let stopped=false,ready=false,rendered=false,nodes=new Map(),lastPong=Date.now(),startedAt=Date.now(),count=0,tick=Date.now(),inflight=0;
  const bytes=crypto.getRandomValues(new Uint8Array(24));const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const broker=document.createElement('iframe');broker.hidden=true;broker.tabIndex=-1;broker.title='Component runtime';broker.setAttribute('aria-hidden','true');broker.setAttribute('sandbox','allow-scripts');
  broker.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');
  style.textContent=':host{display:block;max-width:100%;color:var(--text-normal);font:inherit}*{box-sizing:border-box}#surface{padding:4px;overflow:auto;max-height:520px}button,input,textarea,select{font:inherit;color:inherit;max-width:100%;border:1px solid var(--background-modifier-border);border-radius:8px;background:var(--background-secondary);padding:8px 12px}button{cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--ck-accent,var(--interactive-accent));outline-offset:2px}input[type=checkbox]{width:auto}progress{width:100%;accent-color:var(--ck-accent,var(--interactive-accent))}'+cockpitCustomSafeCss(entry.styles);
  shadow.appendChild(style);const surface=document.createElement('div');surface.id='surface';shadow.appendChild(surface);
  surface.textContent=view._lang()==='en'?'Starting component…':'正在启动组件…';
  const post=message=>{if(!stopped)broker.contentWindow?.postMessage({...message,token},'*');};
  const runtime={id,host,post,destroy(){
    if(stopped)return;stopped=true;clearInterval(timer);window.removeEventListener('message',receive);observer.disconnect();
    broker.contentWindow?.postMessage({type:'stop',token},'*');broker.remove();service.runtimes.delete(runtime);
  }};
  const fail=message=>{if(stopped)return;runtime.destroy();host.remove();onFailure(String(message||'Component failed.').slice(0,300));};
  const receive=async event=>{
    if(stopped||event.source!==broker.contentWindow||event.data?.token!==token)return;
    try{
      const m=customComponentJson(event.data,CUSTOM_COMPONENT_LIMITS.messageBytes);
      if(Date.now()-tick>1000){count=0;tick=Date.now();}customComponentAssert(++count<=60,'Component message rate exceeded.');
      if(m.type==='pong'){lastPong=Date.now();return;}
      if(m.type==='ready'){
        if(!rendered){fail('组件没有生成界面 / Component did not render a UI.');return;}
        ready=true;service.markHealthy?.(id,entry.code).catch(error=>console.warn('Cockpit component health save failed',error));return;
      }
      if(m.type==='error'){fail(m.message);return;}
      if(m.type==='render'){
        const tree=normalizeCustomComponentTree(m.tree);
        if(!rendered){surface.textContent='';rendered=true;}
        nodes=cockpitCustomRenderTree(surface,tree,(action,value)=>post({type:'event',action,value}),nodes);return;
      }
      if(m.type==='request'){
        customComponentAssert(Number.isInteger(m.id)&&m.id>0&&inflight<8,'Invalid component request.');inflight++;
        try {const value=await service.request(id,m.method,m.value,view,()=>!stopped);post({type:'result',id:m.id,value});}
        catch(error){post({type:'result',id:m.id,error:String(error.message).slice(0,200)});}
        finally{inflight--;}
      }
    }catch(error){fail(error.message);}
  };
  window.addEventListener('message',receive);
  broker.onload=()=>post({type:'init',source:'('+cockpitCustomWorkerMain.toString()+')();',code:entry.code,language:view._lang(),theme:document.body.classList.contains('theme-dark')?'dark':'light'});
  broker.srcdoc=cockpitCustomBrokerDocument(token);
  const timer=setInterval(()=>{
    if(document.hidden){lastPong=Date.now();startedAt=Date.now();return;}
    if(Date.now()-lastPong>6000||(!ready&&Date.now()-startedAt>12000)){fail('组件运行超时，已停止 / Component timed out and was stopped.');return;}
    post({type:'ping'});
  },1000);
  const observer=new MutationObserver(()=>{if(!host.isConnected)runtime.destroy();});observer.observe(view.containerEl,{childList:true,subtree:true});
  service.runtimes.add(runtime);document.body.appendChild(broker);return runtime;
}
