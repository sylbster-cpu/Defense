// 장별 밸런스: 봇이 전체 게임을 돌려 장마다 돌파 수, 시설 피해, 장 끝 송신소, 맵 규칙이 작동한 횟수를 낸다.
// node tools/chapter_bal.js <게임 폴더 절대 경로> [판 수, 기본 40] [맵 바꾸기, 예: 5=straight,8=pinch 또는 all=straight]
//   봇 casual: 0.8초마다 판단, 과부하는 범위 안 2기 이상, 떨어진 아이템을 1초 뒤에 줍고 위협이 크거나 시설이 60 아래면 쓴다.
//   봇 weak:   2초마다 판단, 과부하는 3기 이상, 아이템은 2초 뒤에 줍는다.
//   맵 바꾸기로 같은 장을 다른 맵에서 돌리면 맵 규칙이 난이도를 얼마나 바꾸는지 볼 수 있다. NOITEMS=1 이면 아이템을 줍지 않는다(장 끝 보상만 칸에 들어와 쓰인다).
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
const dir=path.resolve(process.argv[2]),N=+process.argv[3]||40,SWAP=process.argv[4]||'',NOITEMS=process.env.NOITEMS==='1';
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');const f=path.join(dir,'_cb_'+process.pid+'.html');fs.writeFileSync(f,s);
const BOT=(tick,react,pulseAt,n,seed)=>`(function(){mute=true;const swap=${JSON.stringify(SWAP)};const keep=MAP_OF.slice();
 if(swap)for(const kv of swap.split(',')){const [k,id]=kv.split('='),i=MAPS.findIndex(m=>m.id===id);if(i<0)throw new Error('no map '+id);if(k==='all')for(let c=1;c<MAP_OF.length;c++)MAP_OF[c]=i;else MAP_OF[+k]=i;}
 let rs=${seed};const r0=Math.random;Math.random=()=>{rs=(rs*1664525+1013904223)>>>0;return rs/4294967296;};
 const e0=ev3;let falls=0,crosses=0;ev3=function(o){if(o.t==='fall')falls++;else if(o.t==='cross')crosses++;e0(o);};
 const C=[];for(let k=0;k<=TOTAL_OPS;k++)C.push({n:0,leaks:0,l2:0,fac:0,core:0,kills:0,falls:0,crosses:0,held:0,cover:0,lost:0,time:0});
 let wins=0;
 for(let run=0;run<${n};run++){reset();newStage(1);let fr=0,guard=0,ch=1,l0=0,k0=0,f0=falls,c0=crosses,held=0,cover=0;
  const close=(lost)=>{const c=C[ch];c.n++;const l=leaks-l0;c.leaks+=l;c.l2+=l*l;c.fac+=200-facilities[0]-facilities[1];c.core+=core;c.kills+=kills-k0;c.falls+=falls-f0;c.crosses+=crosses-c0;c.held+=held;c.cover+=cover;c.time+=stageTime;if(lost)c.lost++;};
  while(phase!=='finish'&&guard++<30*1200){
   if(phase==='upgrade'){close(false);const o=offeredUpgrades;choose(o[(run+upgradeHistory.length)%o.length]);ch=op;l0=leaks;k0=kills;f0=falls;c0=crosses;held=0;cover=0;continue;}
   update(1/30);fr++;
   for(const e of enemies){if(e.hp<=0)continue;if(map.gate&&gateShut(e.lane)&&e.y<=GATE.y&&e.y-e.py<e.speed/30*.5)held+=1/30;if(map.cover(e.lane,e.y))cover+=1/30;}
   if(!${NOITEMS})for(const d of drops.slice())if(DROP_LIFE-d.life>=${react}&&bag.length<BAG_MAX)takeDrop(d);
   if(fr%${tick}===0){const c=[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-190&&!map.cover(e.lane,e.y)).reduce((a,e)=>a+TYPES[e.type].value,0));
    if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane])switchLane(1-drone.lane);
    const inR=enemies.filter(e=>e.hp>0&&(e.lane===drone.lane||map.near(e.y))&&!map.cover(e.lane,e.y)&&Math.abs(e.y-drone.y)<effects.pulseRange).length;if(drone.pulseCooldown<=.01&&inR>=${pulseAt})pulse();
    if(bag.length&&(c[0]+c[1]>=5||facilities[0]<60||facilities[1]<60)){const id=bag[0];if(id==='magnet'){aim=0;useMagnet(drone.lane,DRONE_Y-30);}else if(id==='orbital'){const l=c[1]>c[0]?1:0;let lead=null;for(const e of enemies)if(e.hp>0&&e.lane===l&&(!lead||e.y>lead.y))lead=e;aim=0;useAim(l,lead?lead.y-20:DRONE_Y);}else{bag.shift();applyItem(id);}}}
  }
  if(phase==='finish'){const won=core>0&&op===TOTAL_OPS;close(!won);if(won)wins++;}}
 const maps=MAP_OF.map(i=>MAPS[i].id);Math.random=r0;ev3=e0;for(let k=0;k<MAP_OF.length;k++)MAP_OF[k]=keep[k];
 return JSON.stringify({wins,C,maps});})()`;
const JOBS=[];const PARTS=4;
for(const [bot,tick,react,pulseAt] of [['casual',24,1,2],['weak',60,2,3]])for(let k=0;k<PARTS;k++)JOBS.push({bot,tick,react,pulseAt,n:Math.ceil(N/PARTS),seed:1000*k+(bot==='weak'?7:3)});
(async()=>{const b=await chromium.launch();const out={};let next=0;
 const worker=async()=>{const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  while(next<JOBS.length){const j=JOBS[next++];const r=JSON.parse(await p.evaluate(c=>window.__t(c),BOT(j.tick,j.react,j.pulseAt,j.n,j.seed)));
   const o=out[j.bot]||(out[j.bot]={wins:0,runs:0,C:null,maps:r.maps});o.wins+=r.wins;o.runs+=j.n;
   if(!o.C)o.C=r.C;else r.C.forEach((c,k)=>{for(const q in c)o.C[k][q]+=c[q];});}
  await p.close();};
 await Promise.all([worker(),worker(),worker(),worker()]);await b.close();fs.unlinkSync(f);
 for(const bot of ['casual','weak']){const o=out[bot];console.log(`\n봇 ${bot} · ${o.runs}판 · 승 ${o.wins}/${o.runs}${SWAP?' · 맵 바꿈 '+SWAP:''}${NOITEMS?' · 아이템 줍지 않음':''}`);
  console.log('장 맵        판   돌파(±)      시설피해  장끝송신소  격파   시간  패배  추락  건넘  관문대기(초) 터널(초)');
  for(let k=1;k<o.C.length;k++){const c=o.C[k];if(!c.n)continue;const m=c.leaks/c.n,se=Math.sqrt(Math.max(0,c.l2/c.n-m*m)/c.n);
   console.log(String(k).padStart(2),o.maps[k].padEnd(8),String(c.n).padStart(5),(m.toFixed(2)+' ±'+se.toFixed(2)).padStart(12),(c.fac/c.n).toFixed(0).padStart(8),(c.core/c.n).toFixed(0).padStart(10),(c.kills/c.n).toFixed(0).padStart(6),(c.time/c.n).toFixed(0).padStart(6),String(c.lost).padStart(5),(c.falls/c.n).toFixed(1).padStart(6),(c.crosses/c.n).toFixed(1).padStart(6),(c.held/c.n).toFixed(1).padStart(10),(c.cover/c.n).toFixed(1).padStart(9));}}
 fs.writeFileSync(path.join(process.cwd(),'chapter_bal.json'),JSON.stringify(out,null,1));})();
