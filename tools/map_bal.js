// 맵 비교: 모든 맵을 같은 적 일정(기준 장)으로 돌려 세 가지를 같은 잣대로 잰다.
//   구간 몫   = 규칙이 걸리는 구간(map.zone)이 전선 길이에서 차지하는 몫. 두 전선의 평균과, 구간이 있는 전선만의 평균
//   작동 비율 = 그 장에 나온 적 가운데 규칙이 한 번이라도 작용한 적의 몫(ruleMark)
//   세기      = 같은 일정을 규칙 없는 직선로에서 돌렸을 때와의 돌파 수 차이(음수면 막는 쪽이 쉬워짐)
// node tools/map_bal.js <게임 폴더 절대 경로> [판 수, 기본 200] [기준 장, 기본 4,5,6] [맵, 기본 전부]
// 봇은 chapter_bal.js와 같은 casual(0.8초)과 weak(2초). 아이템은 줍지 않는다. 강화는 기준 장마다 정해 둔 상태에서 시작한다.
const { chromium } = require('playwright');const {hooked,bot}=require('./lib.js');const path=require('path'),fs=require('fs');
const dir=path.resolve(process.argv[2]),N=+process.argv[3]||200,REF=(process.argv[4]||'4,5,6').split(',').map(Number),ONLY=process.argv[5]?process.argv[5].split(','):null;
const f=hooked(dir,'mb');
const RUN=(mapId,k,tick,pulseAt,n,seed)=>`(function(){mute=true;const keep=MAP_OF[${k}],mi=MAPS.findIndex(m=>m.id===${JSON.stringify(mapId)});if(mi<0)throw new Error('no map');MAP_OF[${k}]=mi;
 let rs=${seed};const r0=Math.random;Math.random=()=>{rs=(rs*1664525+1013904223)>>>0;return rs/4294967296;};
 const st={leaks:0,l2:0,ruled:0,came:0,core:0,lost:0};
 for(let run=0;run<${n};run++){reset();const picks=${k}-1;upgradeRanks.stable=Math.ceil(picks/2);upgradeRanks.precision=Math.floor(picks/2);effects=baseEffects();
  for(const id of ['stable','precision'])if(upgradeRanks[id])Object.assign(effects,BAL.card[id](upgradeRanks[id]));
  newStage(${k});let fr=0,guard=0;
  while(phase==='battle'&&guard++<30*300){update(1/30);fr++;
   if(fr%${tick}===0){const c=${bot.threat};${bot.act(pulseAt)}}}
  st.leaks+=leaks;st.l2+=leaks*leaks;st.ruled+=ruleCount;st.came+=spawnCount;st.core+=core;if(core<=0)st.lost++;}
 Math.random=r0;MAP_OF[${k}]=keep;return JSON.stringify(st);})()`;
const ZONE=`(function(){const out={};for(const m of MAPS){const per=[0,1].map(l=>{let n=0,t=0;for(let y=LANE_TOP;y<LEAK_Y;y+=1){t++;if(m.zone(l,y))n++;}return n/t;});out[m.id]={both:(per[0]+per[1])/2,lanes:per,name:m.name};}return JSON.stringify(out);})()`;
(async()=>{const b=await chromium.launch();const pages=[];for(let i=0;i<4;i++){const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(400);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});pages.push(p);}
 const zone=JSON.parse(await pages[0].evaluate(c=>window.__t(c),ZONE));const ids=Object.keys(zone).filter(id=>!ONLY||ONLY.includes(id)||id==='straight');
 const jobs=[];for(const id of ids)for(const k of REF)for(const [bot,tick,pa] of [['casual',24,2],['weak',60,3]])jobs.push({id,k,bot,tick,pa});
 const res={};let next=0;
 await Promise.all(pages.map(async p=>{while(next<jobs.length){const j=jobs[next++];const r=JSON.parse(await p.evaluate(c=>window.__t(c),RUN(j.id,j.k,j.tick,j.pa,N,1000*j.k+(j.bot==='weak'?7:3))));res[j.id+'/'+j.k+'/'+j.bot]=r;}}));
 await b.close();
 const avg=(id,bot,key)=>REF.reduce((a,k)=>a+res[id+'/'+k+'/'+bot][key]/N,0)/REF.length;
 console.log(`기준 장 ${REF.join(',')} · 장마다 ${N}판 · 아이템 없음`);
 console.log('맵        이름     구간몫(두 전선/구간 전선)  작동비율 casual  weak   돌파 casual  weak   세기 casual  weak  평균');
 const out={};
 for(const id of ids){const z=zone[id],zl=z.lanes.filter(v=>v>0),act=['casual','weak'].map(bt=>REF.reduce((a,k)=>a+res[id+'/'+k+'/'+bt].ruled/Math.max(1,res[id+'/'+k+'/'+bt].came),0)/REF.length);
  const lk=['casual','weak'].map(bt=>avg(id,bt,'leaks')),d=['casual','weak'].map((bt,i)=>lk[i]-avg('straight',bt,'leaks'));
  out[id]={zone:z.both,zoneLane:zl.length?zl.reduce((a,v)=>a+v,0)/zl.length:0,act,leaks:lk,d};
  console.log(id.padEnd(9),z.name.padEnd(5),(Math.round(z.both*100)+'% / '+Math.round(out[id].zoneLane*100)+'%').padStart(14),'          ',(Math.round(act[0]*100)+'%').padStart(6),(Math.round(act[1]*100)+'%').padStart(6),'   ',lk[0].toFixed(2).padStart(6),lk[1].toFixed(2).padStart(6),'  ',(d[0]>=0?'+':'')+d[0].toFixed(2).padStart(5),(d[1]>=0?'+':'')+d[1].toFixed(2).padStart(5),((d[0]+d[1])/2>=0?' +':' ')+((d[0]+d[1])/2).toFixed(2));}
 const se=Math.sqrt(REF.reduce((a,k)=>{const r=res['straight/'+k+'/casual'];const m=r.leaks/N;return a+(r.l2/N-m*m)/N;},0))/REF.length;
 console.log('세기의 오차(casual, 대략) ±'+(Math.SQRT2*se).toFixed(2));
 fs.writeFileSync(path.join(process.cwd(),'map_bal.json'),JSON.stringify(out,null,1));})();
