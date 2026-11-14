// 특별 목표와 유인 섬멸의 봇 기준 빈도(판 2026.11.13-3, 20.3절): 장마다 목표를 달성한 비율과 유인 섬멸 횟수.
// node tools/goal_bal.js <게임 폴더 절대 경로> [판 수, 기본 100]
//   봇은 chapter_bal.js와 같은 casual(0.8초마다 판단, 과부하 2기 이상)과 weak(2초마다, 3기 이상)이고 목표를 노리지 않는다.
//   사람은 목표를 노리므로 이보다 자주 달성할 것이다. 기준 수(GOALS의 n)를 바꿀 때 다시 잰다.
const { chromium } = require('playwright');const {hooked,bot}=require('./lib.js');const path=require('path');
const dir=path.resolve(process.argv[2]),N=+process.argv[3]||100;const f=hooked(dir,'gb');
const BOT=(tick,react,pulseAt,n,seed)=>`(function(){mute=true;let rs=${seed};const r0=Math.random;Math.random=()=>{rs=(rs*1664525+1013904223)>>>0;return rs/4294967296;};
 let lures=0;const e0=ev3;ev3=function(o){if(o.t==='multi'&&o.name==='유인 섬멸')lures++;e0(o);};
 const C=[];for(let k=0;k<=TOTAL_OPS;k++)C.push({n:0,goal:0,lure:0});let wins=0;
 for(let run=0;run<${n};run++){reset();newStage(1);let fr=0,guard=0,l0=0;
  while(phase!=='finish'&&guard++<30*2400){
   if(phase==='upgrade'){const c=C[op];c.n++;if(goalNow)c.goal++;c.lure+=lures-l0;l0=lures;const o=offeredUpgrades;choose(o[(run+upgradeHistory.length)%o.length]);continue;}
   update(1/30);fr++;
   for(const d of drops.slice())if(DROP_LIFE-d.life>=${react}&&bag.length<BAG_MAX)takeDrop(d);
   if(fr%${tick}===0){const c=${bot.threat};${bot.act(pulseAt)}${bot.useItem}}}
  if(phase==='finish'){const c=C[op];c.n++;if(goalNow)c.goal++;c.lure+=lures-l0;if(core>0)wins++;}}
 const maps=MAP_OF.map(i=>MAPS[i].name);Math.random=r0;ev3=e0;return JSON.stringify({wins,C,maps});})()`;
(async()=>{const b=await chromium.launch();const res={};
 await Promise.all([['casual',24,1,2,3],['weak',60,2,3,7]].map(async([name,tick,react,pa,seed])=>{const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  res[name]=JSON.parse(await p.evaluate(c=>window.__t(c),BOT(tick,react,pa,N,seed)));await p.close();}));
 await b.close();
 console.log(`봇 둘 · 각 ${N}판 · 승 casual ${res.casual.wins}/${N}, weak ${res.weak.wins}/${N}`);
 console.log('장 맵      casual 달성  weak 달성  유인 섬멸/장(casual, weak)');
 for(let k=2;k<res.casual.C.length;k++){const a=res.casual.C[k],w=res.weak.C[k],pc=c=>(100*c.goal/Math.max(1,c.n)).toFixed(0)+'%';
  console.log(String(k).padStart(2),res.casual.maps[k].padEnd(5),pc(a).padStart(11),pc(w).padStart(10),'   '+(a.lure/Math.max(1,a.n)).toFixed(2)+', '+(w.lure/Math.max(1,w.n)).toFixed(2));}})();
