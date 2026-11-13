// 간단한 밸런스 훑기: 봇이 전체 게임을 N판 돌려 승률과 평균 도달 WAVE를 낸다. node bal_scan.js <게임 폴더> [판 수]
const { chromium } = require('playwright');const {hooked,bot}=require('./lib.js');const dir=process.argv[2],N=+process.argv[3]||16;
const f=hooked(dir,'bal');
const BOT=(tick,items,N)=>`(function(){mute=true;const res=[];for(let run=0;run<${N};run++){reset();newStage(1);let fr=0,guard=0;
 while(phase!=='finish'&&guard++<30*1200){
  if(phase==='upgrade'){const o=offeredUpgrades;choose(o[(run+upgradeHistory.length)%o.length]);continue;}
  update(1/30);fr++;
  if(fr%${tick}===0){const c=${bot.threat};${bot.act(2)}
   if(${items}){for(const d of drops.slice())if(DROP_LIFE-d.life>=.8)takeDrop(d);${bot.useItem}}}
 }
 res.push([core>0&&op===TOTAL_OPS?1:0,op,Math.round(core),kills,leaks]);}
 return JSON.stringify(res);})()`;
(async()=>{const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(600);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 for(const [name,tick,items] of [['fast (0.2s)',6,false],['casual (0.8s)',24,false],['slow (1.6s)',48,false],['casual + items',24,true]]){
  const r=JSON.parse(await p.evaluate(c=>window.__t(c),BOT(tick,items,N)));const w=r.filter(x=>x[0]).length;
  console.log(name.padEnd(16),'wins',String(w).padStart(2)+'/'+N,'avg chapter',(r.reduce((a,x)=>a+x[1],0)/N).toFixed(2),'avg hub',(r.reduce((a,x)=>a+x[2],0)/N).toFixed(0),'avg kills',(r.reduce((a,x)=>a+x[3],0)/N).toFixed(0),'avg leaks',(r.reduce((a,x)=>a+x[4],0)/N).toFixed(1));}
 await b.close();})();
