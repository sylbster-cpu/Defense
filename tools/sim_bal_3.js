// 중계선: 최후의 방어 — 균형 시뮬레이션 도구 v3 (저장소에는 넣지 않은 작업용 스크립트). Playwright 필요.
// 사용: node sim_bal_3.js <index.html 경로> [조합·봇당 반복 횟수, 기본 8. 판단에는 32 이상 권장]
// 환경변수
//   BUILDLIST=SSSS,PPPP,SPSP   S=순환 전원 P=협동 조준 E=비상 축전 R=잔해 차폐 (작전 1~4 뒤에 고르는 순서)
//   SPEEDS=fast,slow,casual,very   판단 주기/지연: fast 즉시, slow 0.6/0.4초, casual 1.2/0.5초, very 2.0/0.7초 (기본 slow,casual,very)
//   POLS=never,stay,hold,base,move,rhythm   이동 성향. never 안 옮김, stay→move 순으로 자주 옮김,
//        rhythm = base + 순환 전원 3단계 이상에서 강화가 끝날 때마다 옮김 (기본 hold,base,move)
//   GEO=돌파선y,기체y,포탑y   전선 좌표 바꿔 보기 (예 506,292,411 = 판 2026.11.10-1의 전선)
//   PATCH='BAL.card.stable=n=>({...});'   게임 코드 뒤에 실행할 수치 변경 / HPX=1.1 적 체력 배율 / SW=1 봇별 이동·돌파 출력
// 칸 읽는 법: 승리 시 남은 송신소 내구도 평균. 괄호는 승리 횟수(전승이면 생략), x는 전패.
// v3에서 바뀐 점
//  1) 소리를 끈다(mute). 끄지 않으면 한 번에 여러 판을 돌릴 때 소리 객체가 쌓여 느려지고 페이지가 죽는다.
//  2) 속도와 이동 성향을 따로 조합한다. 조합마다 "맞는 플레이"와 "안 맞는 플레이"를 함께 보기 위함.
//  3) 전선 좌표를 바꿔 볼 수 있다. 난이도가 다른 두 판을 비교할 때는 좌표를 맞춘 대조군을 둘 것.
// v2에서 이어받은 원칙: 강화는 게임이 실제로 제시한 3장 안에서만 고른다. 봇은 기체 사거리를 벗어난 적을 쫓지 않는다(reachEnd).
const { chromium } = require('playwright');const fs=require('fs'),path=require('path');
const SRC=process.argv[2],N=+process.argv[3]||8,HPX=+process.env.HPX||1;
let s=fs.readFileSync(SRC,'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();');
if(!s.includes('__t'))throw new Error('hook');
if(process.env.GEO){const [lk,dr,tu]=process.env.GEO.split(',');const a='LEAK_Y=608,DRONE_Y=340,TURRET_Y=489';if(!s.includes(a))throw new Error('geo');s=s.replace(a,`LEAK_Y=${lk},DRONE_Y=${dr},TURRET_Y=${tu}`);}
const f=path.join(__dirname,'simpage_'+process.pid+'.html');fs.writeFileSync(f,s);
const CODE=`
mute=true;
${process.env.PATCH||''}
for(const k in TYPES)TYPES[k].hp=Math.round(TYPES[k].hp*${HPX});
let BOTCFG={ratio:1.25,margin:40,tick:0,delay:0};let Q=[],nextThink=0;
const reachEnd=()=>drone.y+effects.droneRange;
function threat(lane){let s=0;const re=reachEnd();for(const e of enemies){if(e.lane!==lane||e.hp<=0||e.y>re)continue;const urg=0.4+Math.max(0,Math.min(1,(e.y-99)/(re-99)));s+=e.hp*urg;}
  for(let i=nextSpawn;i<pattern.length;i++){const p=pattern[i];if(p[0]>stageTime+1.5)break;if(p[1]===lane)s+=TYPES[p[2]].hp*0.3;}return s;}
function think(){const out=[];const cur=drone.lane,oth=1-cur,tc=threat(cur),to=threat(oth);const re=reachEnd();const danger=l=>enemies.some(e=>e.lane===l&&e.hp>0&&e.y>re-110&&e.y<=re-10);
  const ready=drone.moveCooldown<=0.02;
  if(!BOTCFG.never&&ready&&(to>tc*BOTCFG.ratio+BOTCFG.margin||(danger(oth)&&!danger(cur))))out.push(['move',oth]);
  else if(BOTCFG.rhythm&&ready&&effects.echo>0&&drone.burst<=0&&to>0&&!danger(cur))out.push(['move',oth]);
  if(drone.pulseCooldown<=0.02){const close=enemies.filter(e=>e.hp>0&&e.lane===drone.lane&&Math.abs(e.y-drone.y)<effects.pulseRange);
    if(close.length){const hp=close.reduce((a,e)=>a+Math.min(e.hp,effects.pulseDamage),0);if(close.length>=3||hp>=effects.pulseDamage*1.6||close.some(e=>e.y>drone.y+effects.pulseRange-25))out.push(['pulse']);}}
  return out;}
function act(a){if(a[0]==='move'){if(drone.lane!==a[1])switchLane(a[1]);}else if(drone.pulseCooldown<=0.02)pulse();}
function bot(){if(!BOTCFG.tick){for(const a of think())act(a);return;}
  while(Q.length&&Q[0].t<=stageTime)act(Q.shift().a);
  if(stageTime>=nextThink){nextThink=stageTime+BOTCFG.tick;for(const a of think())Q.push({t:stageTime+BOTCFG.delay,a});}}
function runOne(build,cfg){BOTCFG=cfg;Q=[];nextThink=0;let blocked=0,facDown=0;const picked=[];
  reset();newStage(1);let guard=0;
  while(guard++<900000){if(phase==='battle'){bot();update(1/60);if(phase!=='battle'){Q=[];nextThink=0;}}
    else if(phase==='upgrade'){facDown+=(facilities[0]<=0?1:0)+(facilities[1]<=0?1:0);let id=build[op-1];
      if(!offeredUpgrades.includes(id)){blocked++;id=offeredUpgrades.find(x=>build.includes(x))||offeredUpgrades[0];}
      picked.push(id[0]);choose(id);}else break;}
  return{win:phase==='finish'&&core>0,core:Math.round(core),op,leaks,switches,blocked,facDown,picked:picked.join('')};}
window.__runMany=(build,cfg,n)=>{const out=[];for(let i=0;i<n;i++)out.push(runOne(build,cfg));return out;};`;
const N_={S:'stable',P:'precision',E:'emergency',R:'rubble'};
const builds=Object.fromEntries((process.env.BUILDLIST||'SRSR,SSSS,SRSS,PPPP,SPPP,SPSP,SPER,ERER').split(',').map(k=>[k,k.split('').map(c=>N_[c])]));
const POL={stay:{ratio:2.2,margin:150},hold:{ratio:1.6,margin:80},base:{ratio:1.25,margin:40},move:{ratio:.85,margin:10},rhythm:{ratio:1.25,margin:40,rhythm:true},never:{ratio:1.25,margin:40,never:true}};
const SPD={fast:{tick:0,delay:0},slow:{tick:.6,delay:.4},casual:{tick:1.2,delay:.5},very:{tick:2.0,delay:.7}};
const speeds=(process.env.SPEEDS||'slow,casual,very').split(','),pols=(process.env.POLS||'hold,base,move').split(',');
const bots={};for(const sp of speeds)for(const po of pols)bots[sp[0]+'_'+po]=Object.assign({},SPD[sp],POL[po]);
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+f);await p.waitForTimeout(150);await p.evaluate(c=>window.__t(c),CODE);
 const names=Object.keys(bots);
 console.log(`GEO ${process.env.GEO||'file'} | HPx${HPX} | runs ${N} | cell = wins(if<N) mean core when winning${process.env.PATCH?' | PATCH':''}`);
 console.log('build '+names.map(n=>n.padStart(9)).join('')+'   leaks  moves  lost-op');
 for(const [bn,bd] of Object.entries(builds)){const cells=[],swb=[],lkb=[];let lk=0,sw=0,n=0,bl=0;const lost=[];
  for(const cn of names){const rs=await p.evaluate(([bd,cfg,n])=>window.__runMany(bd,cfg,n),[bd,bots[cn],N]);let w=0,c=0,sb=0,lb=0;
   for(const r of rs){if(r.win){w++;c+=r.core;}else lost.push(r.op);lk+=r.leaks;sw+=r.switches;sb+=r.switches;lb+=r.leaks;bl+=r.blocked;n++;}
   cells.push((w?String(Math.round(c/w)):'x')+(w<N?`(${w})`:'')) ;swb.push(String(Math.round(sb/N)));lkb.push((lb/N).toFixed(0));}
  const cnt={};for(const o of lost)cnt[o]=(cnt[o]||0)+1;
  console.log(bn.padEnd(6)+cells.map(c=>c.padStart(9)).join('')+`   ${(lk/n).toFixed(1).padStart(5)}  ${String(Math.round(sw/n)).padStart(4)}  ${Object.entries(cnt).map(([o,c])=>o+':'+c).join(' ')||'-'}${bl?'  blocked '+(bl/n).toFixed(2):''}`);
  if(process.env.SW){console.log('  이동'+swb.map(c=>c.padStart(9)).join(''));console.log('  돌파'+lkb.map(c=>c.padStart(9)).join(''));}}
 if(errs.length)console.log('ERRORS',errs.slice(0,3));await b.close();fs.unlinkSync(f);})();
