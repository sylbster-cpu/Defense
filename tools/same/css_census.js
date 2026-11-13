// 스타일 규칙 조사: 선택자마다 몇 개의 화면 상태에서 요소와 맞는지 센다. 한 번도 맞지 않는 규칙은 지울 후보다(지우기 전에 그 클래스가 정말 쓰이지 않는지 확인한다).
// node tools/same/css_census.js <게임 폴더 절대 경로> <결과.json> [화면 크기들] [3d,2d]
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const U=require('./states.js');
const dir=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),VPS=process.argv[4]?process.argv[4].split(','):U.VIEWPORTS,MODES=process.argv[5]?process.argv[5].split(','):['3d','2d'];
const PROBE=()=>{const res=[];const strip=s=>s.replace(/::?(before|after|placeholder|-webkit-[a-z-]+|-moz-[a-z-]+)/g,'').replace(/:(hover|active|focus-visible|focus-within|focus|disabled|enabled|checked)/g,'');
 const split=s=>{const o=[];let d=0,c='';for(const ch of s){if(ch==='('||ch==='[')d++;if(ch===')'||ch===']')d--;if(ch===','&&d===0){o.push(c.trim());c='';}else c+=ch;}o.push(c.trim());return o;};
 const walk=(list,ctx,on)=>{for(const r of list){if(r.type===1){for(const part of split(r.selectorText)){let m=0;const q=strip(part)||'*';try{m=on&&document.querySelector(q)?1:0;}catch(e){m=on?1:0;}res.push([ctx,part,m]);}}
  else if(r.type===4)walk(r.cssRules,ctx?ctx+' && '+r.conditionText:r.conditionText,on&&matchMedia(r.conditionText).matches);}};
 for(const s of document.styleSheets)walk(s.cssRules,'',true);return res;};
(async()=>{const b=await chromium.launch();const file=U.hooked(dir,'cen');const agg=new Map();const jobs=[];for(const vp of VPS)for(const mode of MODES)jobs.push([vp,mode]);let next=0;const bad=[];
 const worker=async()=>{while(next<jobs.length){const [vp,mode]=jobs[next++];let p;try{p=await U.open(b,file,vp,mode);}catch(e){bad.push(vp+' '+mode+' open: '+e.message);continue;}
  for(const name of Object.keys(U.STATES)){try{await U.enter(p,name);}catch(e){bad.push(vp+' '+mode+' '+name+': '+String(e.message).split('\n')[0].slice(0,160));continue;}
   const r=await p.evaluate(PROBE);r.forEach(([ctx,part,m],i)=>{const k=i+'\u0001'+ctx+'\u0001'+part;const a=agg.get(k)||{n:0,where:[]};if(m){a.n++;if(a.where.length<3)a.where.push(name+'@'+vp+'/'+mode);}agg.set(k,a);});}
  if(p.__errs.length)bad.push(vp+' '+mode+' page errors: '+p.__errs.slice(0,2).join(' | '));await p.context().close();}};
 await Promise.all([worker(),worker(),worker(),worker()]);await b.close();
 const rows=[...agg].map(([k,a])=>{const [i,ctx,part]=k.split('\u0001');return {i:+i,ctx,part,n:a.n,where:a.where};}).sort((x,y)=>x.i-y.i);
 fs.writeFileSync(out,JSON.stringify(rows));const never=rows.filter(r=>!r.n);
 console.log('instances',jobs.length*Object.keys(U.STATES).length,'selector parts',rows.length,'never matched',never.length);for(const x of bad.slice(0,30))console.log('PROBLEM',x);})();
