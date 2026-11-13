// 화면(DOM) 동일성 기록: 화면 상태마다 모든 요소의 계산된 스타일, 상자 위치와 크기, 글자, 그리고 캔버스를 가린 화면 사진의 해시를 적는다.
// 평소 상태와 단추에 hover, active, focus를 강제로 건 상태를 모두 본다. 두 판을 각각 기록한 뒤 ui_diff.js로 비교한다.
// node tools/same/ui.js <게임 폴더 절대 경로> <결과.json> [화면 크기들|all] [3d,2d|all] [상태들]      SHOTS=<폴더>면 사진도 남긴다. DETAIL=1이면 속성 값을 모두 남긴다(상태와 크기를 하나로 좁혀 쓴다)
const { chromium } = require('playwright');const path=require('path'),fs=require('fs'),crypto=require('crypto');const U=require('./states.js');
const dir=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),arg=(i,d)=>process.argv[i]&&process.argv[i]!=='all'?process.argv[i].split(','):d;
const VPS=arg(4,U.VIEWPORTS),MODES=arg(5,['3d','2d']),NAMES=arg(6,Object.keys(U.STATES)),DETAIL=process.env.DETAIL==='1';
const SNAP=(detail)=>{for(const a of document.getAnimations()){try{a.finish();}catch(e){try{a.pause();a.currentTime=0;}catch(e2){}}}
 const F=(x,s)=>{for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619);}return x>>>0;};
 const pathOf=el=>{const parts=[];for(let e=el;e&&e!==document.documentElement;e=e.parentElement){let k=e.tagName.toLowerCase();if(e.id){parts.unshift(k+'#'+e.id);break;}const cls=[...e.classList].join('.');if(cls)k+='.'+cls;const sib=e.parentElement?[...e.parentElement.children].filter(x=>x.tagName===e.tagName):[e];if(sib.length>1)k+='['+sib.indexOf(e)+']';parts.unshift(k);}return parts.join('>');};
 const one=(el,pseudo)=>{const cs=getComputedStyle(el,pseudo||null);if(pseudo&&(cs.content==='none'||cs.content==='normal'))return detail?null:0;if(detail){const o={};for(let i=0;i<cs.length;i++)o[cs[i]]=cs.getPropertyValue(cs[i]);return o;}let h=0;for(let i=0;i<cs.length;i++)h=(h+F(2166136261,cs[i]+':'+cs.getPropertyValue(cs[i])))>>>0;return h;};   // a sum: the engine lists custom properties in an order that changes from load to load
 const res={};for(const el of document.body.querySelectorAll('*')){if(el.tagName==='SCRIPT'||el.tagName==='STYLE')continue;const r=el.getBoundingClientRect();
  res[pathOf(el)]=[one(el),one(el,'::before'),one(el,'::after'),[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100).join(','),el.children.length?'':el.textContent.slice(0,80)];}
 res['body']=[one(document.body),0,0,'',''];res['html']=[one(document.documentElement),0,0,'',''];return res;};
(async()=>{const b=await chromium.launch();const file=U.hooked(dir,'snap');const res={};const jobs=[];for(const vp of VPS)for(const mode of MODES)jobs.push([vp,mode]);let next=0;const bad=[];
 const worker=async()=>{while(next<jobs.length){const [vp,mode]=jobs[next++];let p;try{p=await U.open(b,file,vp,mode);}catch(e){bad.push(vp+' '+mode+' open: '+e.message);continue;}
  const cdp=await p.context().newCDPSession(p);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  for(const name of NAMES){const key=name+'@'+vp+'/'+mode;try{await U.enter(p,name);}catch(e){bad.push(key+': '+String(e.message).split('\n')[0].slice(0,160));continue;}
   const rec={rest:await p.evaluate(SNAP,DETAIL)};
   const {root}=await cdp.send('DOM.getDocument',{depth:0});const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'button,.choice,input,.tbtn'});
   for(const [tag,cls] of [['hover',['hover']],['active',['active','hover']],['focus',['focus','focus-visible']]]){for(const id of nodeIds)await cdp.send('CSS.forcePseudoState',{nodeId:id,forcedPseudoClasses:cls});rec[tag]=await p.evaluate(SNAP,DETAIL);}
   for(const id of nodeIds)await cdp.send('CSS.forcePseudoState',{nodeId:id,forcedPseudoClasses:[]});
   await p.evaluate(()=>{const s=document.createElement('style');s.id='__hide';s.textContent='canvas,video{visibility:hidden!important}';document.head.appendChild(s);for(const a of document.getAnimations()){try{a.finish();}catch(e){try{a.pause();a.currentTime=0;}catch(e2){}}}});
   let png=null;for(let k=0;k<3&&!png;k++){try{png=await p.screenshot({timeout:120000});}catch(e){bad.push(key+': screenshot try '+(k+1)+' failed');}}   // a slow machine: try again rather than lose the whole run
   rec.shot=png?crypto.createHash('sha1').update(png).digest('hex'):'none';
   if(png&&process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});fs.writeFileSync(path.join(process.env.SHOTS,key.replace(/[@/]/g,'_')+'.png'),png);}
   await p.evaluate(()=>document.getElementById('__hide').remove());res[key]=rec;}
  if(p.__errs.length)bad.push(vp+' '+mode+' page errors: '+p.__errs.slice(0,2).join(' | '));await p.context().close();console.log('done',vp,mode);}};
 await Promise.all([worker(),worker(),worker(),worker()]);await b.close();
 const sorted={};for(const k of Object.keys(res).sort())sorted[k]=res[k];fs.writeFileSync(out,JSON.stringify(sorted));
 console.log('instances',Object.keys(res).length,'problems',bad.length);for(const x of bad.slice(0,30))console.log('PROBLEM',x);})();
