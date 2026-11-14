// 강화 카드의 세기(판 2026.11.13-5, 22.3절): 밸런스 봇(tools/lib.js의 casual·weak)이 전체 게임을 돌며, 그 카드가 후보에 나오면 늘 그것을 고른다.
// node tools/card_bal.js <게임 폴더 절대 경로> [판 수, 기본 100]
//   정책 rot = 봇의 평소 고르기(후보를 차례로 돌림), only:X = X가 나오면 늘 X(아니면 평소대로). 승, 판당 돌파, 끝 송신소, 그 카드의 단계(only:A+B는 두 카드 단계의 합), 판당 과부하 횟수를 낸다.
//   only:A+B = A가 나오면 A, 없고 B가 나오면 B(판 2026.11.13-9). OSC=1 이면 봇이 이동 대기가 끝날 때마다 다른 전선으로 옮긴다(잔해 살포를 계속 먹이는 플레이).
//   POLS='rot,only:emergency' 로 정책을 고르고, PATCH='BAL.card.emergency=n=>({...})' 로 카드 수치를 바꿔 시험한다(게임 파일은 바꾸지 않는다).
const { chromium } = require('playwright');const path=require('path');
const dir=path.resolve(process.argv[2]),N=+process.argv[3]||100,PATCH=process.env.PATCH||'',POLS=(process.env.POLS||'rot,only:emergency,only:stable,only:precision,only:rubble').split(',');const {hooked,bot}=require('./lib.js');const f=hooked(dir,'cbl');
const BOT=(pol,tick,react,pulseAt,n,seed)=>`(function(){mute=true;${PATCH};let rs=${seed};const r0=Math.random;Math.random=()=>{rs=(rs*1664525+1013904223)>>>0;return rs/4294967296;};
 let wins=0,leaksSum=0,coreSum=0,lost8=0,rank=0,offered=0,pulses=0;const pol=${JSON.stringify(pol)};const p0=pulse;pulse=function(){const c0=drone.pulseCooldown;p0();if(drone.pulseCooldown>c0)pulses++;};
 for(let run=0;run<${n};run++){reset();newStage(1);let fr=0,guard=0;
  while(phase!=='finish'&&guard++<30*2400){
   if(phase==='upgrade'){const o=offeredUpgrades;let pick=o[(run+upgradeHistory.length)%o.length];if(pol!=='rot'){const wants=pol.slice(5).split('+'),want=wants.find(x=>o.includes(x));if(want){pick=want;offered++;}}choose(pick);continue;}
   update(1/30);fr++;
   for(const d of drops.slice())if(DROP_LIFE-d.life>=${react}&&bag.length<BAG_MAX)takeDrop(d);
   if(fr%${tick}===0){const c=${bot.threat};${process.env.OSC==='1'?"if(drone.moveCooldown<=.01)switchLane(1-drone.lane);":''}${bot.act(pulseAt)}${bot.useItem}}}
  const won=core>0&&op===TOTAL_OPS&&phase==='finish';if(won)wins++;leaksSum+=leaks;coreSum+=core;rank+=pol==='rot'?0:pol.slice(5).split('+').reduce((a,k)=>a+upgradeRanks[k],0);}
 Math.random=r0;pulse=p0;return JSON.stringify({wins,leaks:leaksSum/${n},core:coreSum/${n},rank:rank/${n},offered:offered/${n},pulses:pulses/${n}});})()`;
(async()=>{const b=await chromium.launch();const pols=POLS;const jobs=[];
 for(const pol of pols)for(const [bn,tick,react,pa,seed] of [['casual',24,1,2,3],['weak',60,2,3,7]])jobs.push({pol,bn,tick,react,pa,seed});
 const res=[];let next=0;
 const worker=async()=>{const p=await b.newPage();await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(400);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  while(next<jobs.length){const j=jobs[next++];const r=JSON.parse(await p.evaluate(c=>window.__t(c),BOT(j.pol,j.tick,j.react,j.pa,N,j.seed)));res.push(Object.assign({pol:j.pol,bot:j.bn},r));}await p.close();};
 await Promise.all([worker(),worker(),worker(),worker()]);await b.close();
 console.log('정책              봇      승       돌파/판  끝 송신소  그 카드 단계  과부하/판');
 for(const pol of pols)for(const bn of ['casual','weak']){const r=res.find(x=>x.pol===pol&&x.bot===bn);console.log(pol.padEnd(17),bn.padEnd(7),(r.wins+'/'+N).padStart(7),r.leaks.toFixed(2).padStart(10),r.core.toFixed(0).padStart(10),(pol==='rot'?'-':r.rank.toFixed(1)).padStart(12),r.pulses.toFixed(0).padStart(10));}})();
