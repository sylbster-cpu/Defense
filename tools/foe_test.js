// 변종 적 시험(판 2026.11.13-6, 23장): 일정표의 변종 배정, 방패형(과부하 감소·감전은 그대로·다리에서 안 떨어짐), 분열형(조각 둘, 장갑, 떨어지면 안 갈라짐,
// 조각이 다 부서져야 장이 끝남), 수리형(같은 전선·범위·거대 병기 제외·자기 제외), 첫 등장 안내와 기억, 정찰 글, 2.5D·2D 그리기 오류 없음.
// 판 2026.11.13-9: 장당 공격 수(3·4·5)와 공격마다 체력 증가, 한 기마다 다른 속도, 방패형 새 규칙(앞지르기 금지, 뒤의 적 과부하 피해 감소),
// 보스 단계(변종 성질을 가진 거대 병기, 운반 병기, 돌진 병기, 최종 병기는 장식 없는 16장 보스만), 보스 안내와 정찰 이름, 패배 기록의 공격 수, 훈련 끝 문구, 그리기.
// node tools/foe_test.js <게임 폴더 절대 경로> [출력 폴더(화면 사진, 생략 가능)]
const { chromium } = require('playwright');const {hooked,inGame,checks}=require('./lib.js');const path=require('path'),fs=require('fs');
const dir=path.resolve(process.argv[2]),out=process.argv[3]?path.resolve(process.argv[3]):null;if(out)fs.mkdirSync(out,{recursive:true});
const f=hooked(dir,'foe');
const PUT="const put=(lane,type,y,o)=>{const m=TYPES[type];const e=Object.assign({id:Math.random(),lane,type,x:LANES[lane],y,py:y,hp:m.hp,maxHp:m.hp,speed:0,slow:0,stun:0,flash:0,wiggle:0,wv:1},o||{});enemies.push(e);return e;};";
const START=ch=>`reset();liveRun=true;newStage(${ch});phase='battle';pattern=[[1e9,0,'runner']];nextSpawn=0;enemies=[];drone.y=DRONE_Y;holdState=null;hideCoach();`;
const LEARN="mute=true;$('title').hidden=true;$('titleVid').pause();learned.drill=learned.item=learned.pulse=learned.combo=true;for(const m of MAPS)learned.maps[m.id]=true;for(const k in ITEMS)learned.items[k]=true;";
const J2=async T=>JSON.parse(await T("JSON.stringify({n:enemies.length,ram:enemies.some(e=>e.ramDash||e.ramWarn)})"));
(async()=>{const b=await chromium.launch();const {ck,end}=checks();
 {const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(400);
  const T=inGame(p);await T(LEARN+"learned.foes={shield2:true,split:true,medic:true,boss_shield:true,boss_split:true,boss_medic:true,boss_carrier:true,boss_ram:true};0");
  // the schedule: which chapters carry which variants
  const cnt=JSON.parse(await T("JSON.stringify(Array.from({length:TOTAL_OPS},(_,i)=>{const c={shield:0,split:0,medic:0};for(const ev of stages[i+1])if(ev[3])c[ev[3]]++;return c;}))"));
  const first=k=>cnt.findIndex(c=>c[k]>0)+1;
  ck('variants start at chapter 4 (shield), 6 (split), 9 (medic) and stay after',first('shield')===4&&first('split')===6&&first('medic')===9&&cnt.slice(3).every(c=>c.shield>0)&&cnt.slice(5).every(c=>c.split>0)&&cnt.slice(8).every(c=>c.medic>0),cnt.map((c,i)=>(i+1)+':'+c.shield+'/'+c.split+'/'+c.medic).join(' '));
  const kinds=JSON.parse(await T("JSON.stringify(Object.values(stages).flat().filter(ev=>ev[3]).map(ev=>ev[2]+':'+ev[3]).filter((v,i,a)=>a.indexOf(v)===i))"));
  ck('shields and medics are medium machines, split machines large; bosses carry shield, split, medic, carrier or ram (build 2026.11.13-9)',kinds.sort().join()==='boss:carrier,boss:medic,boss:ram,boss:shield,boss:split,brute:split,grunt:medic,grunt:shield',kinds);
  // shield
  const sh=JSON.parse(await T(`(()=>{${PUT}${START(5)}const a=put(drone.lane,'grunt',DRONE_Y-30,{hp:900,maxHp:900,kind:'shield'}),n=put(drone.lane,'grunt',DRONE_Y-20,{hp:900,maxHp:900});
   drone.pulseCooldown=0;pulse();const ps=[900-a.hp,900-n.hp];const h0=a.hp;damageEnemy(a,19,0,0,'drone');const dr=h0-a.hp;const h1=a.hp;damageEnemy(a,15,0,0,'shock');return JSON.stringify({ps,dr,shock:h1-a.hp,p:FOE.shield.pulse});})()`));
  ck('shield: the overload does a quarter, shots and the water shock do full damage',Math.abs(sh.ps[0]-sh.ps[1]*sh.p)<.01&&sh.dr===19&&sh.shock===15,sh);
  const br=JSON.parse(await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='bridge');${START('ch')}const y=(BRIDGE[0]+BRIDGE[1])/2;const a=put(drone.lane,'grunt',Math.max(y,DRONE_Y-60),{kind:'shield',hp:900,maxHp:900}),n=put(drone.lane,'grunt',Math.max(y,DRONE_Y-60)+5,{hp:900,maxHp:900});
   drone.pulseCooldown=0;pulse();return JSON.stringify({shieldFell:!!a.fell,shieldHp:a.hp,plainFell:!!n.fell,inZone:map.fall(a.lane,a.y)});})()`));
  ck('shield: the overload does not knock it off a bridge (an ordinary medium machine falls)',br.inZone&&!br.shieldFell&&br.shieldHp>0&&br.plainFell,br);
  // split
  const sp=JSON.parse(await T(`(()=>{${PUT}${START(7)}nextSpawn=pattern.length;const e=put(0,'brute',300,{kind:'split',hp:5,maxHp:500,wv:2});damageEnemy(e,99,0,0,'drone');const before=enemies.filter(q=>q.hp>0).length;
   update(1/60);const kids=enemies.filter(q=>q.hp>0&&q.type==='runner');const full=Math.round(TYPES.runner.hp*OP_HP[7]*HP_SCALE*(1+HP_WAVE));   /* the pieces belong to attack 2 (wv 2): +HP_WAVE */
   return JSON.stringify({before,kids:kids.length,ys:kids.map(q=>Math.round(q.y)),hp:kids.map(q=>q.maxHp),expect:Math.round(TYPES.runner.hp*OP_HP[7]*HP_SCALE*FOE.split.hp*(1+HP_WAVE)),wv:kids.map(q=>q.wv),rare:kids.some(q=>q.rare),phase});})()`));
  ck('split: destroyed, it breaks into two small machines where it stood, with 60% hull, same attack, never rare',sp.before===0&&sp.kids===2&&sp.ys.every(y=>Math.abs(y-300)<=8)&&sp.hp.every(h=>h===sp.expect)&&sp.wv.every(w=>w===2)&&!sp.rare,sp);
  ck('split: the chapter is not over while the pieces are on the field',sp.phase==='battle',sp.phase);
  const sf=JSON.parse(await T(`(()=>{${PUT}${START(7)}const e=put(0,'brute',300,{kind:'split',hp:5,maxHp:500});e.fell=true;damageEnemy(e,99,0,0,'fall');update(1/60);return JSON.stringify({kids:enemies.filter(q=>q.hp>0).length});})()`));
  ck('split: a machine that fell off a bridge does not break apart',sf.kids===0,sf);
  // medic
  const md=JSON.parse(await T(`(()=>{${PUT}${START(4)}turrets=[];drone.shotCooldown=1e9;const m=put(1,'grunt',300,{kind:'medic',hp:50,maxHp:100}),near=put(1,'grunt',300+FOE.medic.r-5,{hp:50,maxHp:100}),far=put(1,'grunt',300+FOE.medic.r+10,{hp:50,maxHp:100}),
   other=put(0,'grunt',300,{hp:50,maxHp:100}),boss=put(1,'boss',290,{hp:50,maxHp:100});for(const e of enemies)e.speed=0;for(let i=0;i<30;i++)update(1/30);
   return JSON.stringify({self:m.hp,near:+near.hp.toFixed(1),far:far.hp,other:other.hp,boss:boss.hp,expect:50+100*FOE.medic.rate*1});})()`));
  ck('medic: repairs its lane within reach (10% a second), not itself, not the other lane, not beyond reach, not a boss',Math.abs(md.near-md.expect)<1.5&&md.self===50&&md.far===50&&md.other===50&&md.boss===50,md);
  // lesson and scouting
  const ls=JSON.parse(await T(`(()=>{${PUT}learned.foes={};${START(4)}lessonQuiet=99;stageTime=5;const e=put(0,'grunt',200,{kind:'shield'});lessonTick(1/30);const a={hold:holdState&&holdState.need,title:$('coachTitle').textContent,main:$('coachMain').textContent};
   releaseHold();lessonQuiet=99;lessonTick(1/30);return JSON.stringify({a,again:!!holdState,learned:learned.foes});})()`));
  ck('a variant is explained the first time it is in view, once (the shield under its new key since its rule changed)',ls.a.hold==='tap'&&ls.a.title==='새 적 · 방패형'&&ls.a.main.includes('방패형 뒤에 있는 적은')&&ls.a.main.includes('50% 덜 받고')&&ls.a.main.includes('75%')&&!ls.again&&ls.learned.shield2===true,ls);
  const sc=await T(`(()=>{${START(8)}enemies=[];nextSpawn=pattern.length;stageHurt=true;update(1/30);return document.querySelector('.scout').textContent;})()`);
  ck('scouting names the variants of the next chapter',/변종 · 방패형 \d+ · 분열형 \d+ · 수리형 \d+/.test(sc),sc);
  // the 2D canvases draw every variant
  await T(`(()=>{${PUT}showOverlay(false);${START(10)}put(0,'grunt',250,{kind:'shield'});put(0,'brute',300,{kind:'split'});put(1,'grunt',260,{kind:'medic'});put(1,'grunt',300,{healT:.2});})()`);
  await p.waitForTimeout(400);if(out)await p.screenshot({path:path.join(out,'foe_2d.png')});
  ck('no page errors (2D)',!errs.length,errs.slice(0,3));await p.close();}
 // ---------- build 2026.11.13-9: longer chapters, the shield's new rule, every machine's own speed, the bosses that grow ----------
 {const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(400);
  const T=inGame(p),J=async x=>JSON.parse(await T(x));await T(LEARN+"learned.foes={shield2:true,split:true,medic:true,boss_shield:true,boss_split:true,boss_medic:true,boss_carrier:true,boss_ram:true};0");
  const S0=ch=>`reset();liveRun=false;newStage(${ch});phase='battle';pattern=[[1e9,0,'runner']];nextSpawn=0;enemies=[];turrets=[];drone.shotCooldown=1e9;`;
  const st=await J("JSON.stringify(Array.from({length:TOTAL_OPS},(_,i)=>{const k=i+1,b=WAVES[k],at=t=>b.filter(x=>t>=x).length+1;return {k,n:NATT(k),w:b.length+1,bosses:stages[k].filter(e=>e[2]==='boss').map(e=>(e[3]||'X')+'@'+at(e[0]))};}))");
  ck('attacks per chapter: 3 for chapters 1-4, 4 for 5-10, 5 for 11-16 (WAVES agree)',st.every(c=>c.n===(c.k<=4?3:c.k<=10?4:5)&&c.w===c.n),st.map(c=>c.k+':'+c.n).join(' '));
  const want={3:'X@3',4:'X@3',5:'X@4',7:'X@4',8:'X@4',9:'shield@4',10:'split@4',11:'medic@5',12:'carrier@5',13:'X@5,shield@5',14:'ram@5,split@5',15:'X@3,carrier@5,ram@5',16:'medic@3,X@5,shield@5'};
  ck('bosses: in the last attack, a boss in every chapter from 9, two from 13, kinds grow (shield, split, medic, carrier, ram)',st.every(c=>(want[c.k]||'')===c.bosses.join()),st.filter(c=>c.bosses.length).map(c=>c.k+':'+c.bosses.join()).join(' '));
  ck('the attack number follows the clock (chapter 12: 22 s each)',await T("(()=>{op=12;return [0,21.9,22,43.9,44,66,88,120].map(waveIndex).join();})()")==='1,1,2,2,3,4,5,5');
  const hw=await J(`(()=>{${S0(12)}const o=[];for(let w=1;w<=5;w++){wave=w;spawn(0,'grunt',null,{child:1,y:200});o.push(enemies[enemies.length-1].maxHp);}   /* child: never rare (a rare one has 1.6x) */return JSON.stringify({o,base:Math.round(TYPES.grunt.hp*OP_HP[12]*HP_SCALE)});})()`);
  ck('hull grows 6% with each attack of a chapter',hw.o.every((h,i)=>Math.abs(h-hw.base*(1+.06*i))<=1),hw);
  const sp=await J(`(()=>{${S0(3)}for(let i=0;i<300;i++)spawn(i%2,'runner');spawn(0,'boss');const v=enemies.filter(e=>e.type==='runner').map(e=>e.speed/TYPES.runner.speed);return JSON.stringify({min:Math.min(...v),max:Math.max(...v),boss:enemies.find(e=>e.type==='boss').speed===TYPES.boss.speed});})()`);
  ck('every machine walks within 12% of its kind\'s speed, spread out; a boss walks at its kind\'s speed',sp.min>=.88&&sp.max<=1.12&&sp.max-sp.min>.18&&sp.boss,sp);
  // the shield's new rule
  const bl=await J(`(()=>{${PUT}${S0(4)}const s=put(0,'grunt',300,{kind:'shield'}),r=put(0,'runner',200,{speed:84});for(let i=0;i<180;i++)update(1/60);return JSON.stringify({r:+r.y.toFixed(1)});})()`);
  ck('shield: machines walk past it (the no-passing rule of build 2026.11.13-9 was taken out in -10)',bl.r>300,bl);
  const gd=await J(`(()=>{${PUT}${S0(4)}drone.lane=0;drone.x=LANES[0];const s=put(0,'grunt',DRONE_Y-10,{kind:'shield',hp:900,maxHp:900}),a=put(0,'brute',DRONE_Y-40,{hp:900,maxHp:900}),c=put(0,'brute',DRONE_Y+20,{hp:900,maxHp:900}),o=put(1,'brute',DRONE_Y-40,{hp:900,maxHp:900});
   drone.pulseCooldown=0;pulse();const ov=[900-s.hp,900-a.hp,900-c.hp];damageEnemy(a,19,0,0,'drone');return JSON.stringify({ov,shot:900-ov[1]-a.hp,d:effects.pulseDamage,g:FOE.shield.guard});})()`);
  ck('shield: machines behind it take half the overload, the one ahead all of it, the shield a quarter; shots are not reduced',gd.ov[0]===gd.d*.25&&gd.ov[1]===gd.d*gd.g&&gd.ov[2]===gd.d&&gd.g===.5&&gd.shot===19,gd);
  // build 2026.11.13-10 (owner's choice): rubble only near where the drone left, not again while slowed nor for rubbleImm s after; emergency range +10 a rank, recharge counts at most refundCap hits
  const rb=await J(`(()=>{${PUT}${S0(4)}Object.assign(effects,BAL.card.rubble(4));effects.rubble=1;drone.lane=0;drone.x=LANES[0];const near=put(0,'grunt',DRONE_Y-100),far=put(0,'grunt',DRONE_Y-DR()-20),other=put(1,'grunt',DRONE_Y);
   const hop=()=>{drone.moveCooldown=0;switchLane(1-drone.lane);};hop();const first=[near.slow,far.slow,other.slow];for(let i=0;i<60;i++)update(1/30);hop();hop();const again=near.slow;
   while(near.slow>0)update(1/30);const imm=near.slowImm;hop();hop();const inImm=near.slow;for(let i=0;i<70;i++)update(1/30);hop();hop();return JSON.stringify({first,again:+again.toFixed(2),imm:+imm.toFixed(2),inImm,after:near.slow,dur:effects.rubbleSlow,immS:BAL.rubbleImm});})()`);
  ck('rubble: only the machines within the drone\'s reach of where it left; not again while slowed, nor for 2 s after',rb.first[0]===rb.dur&&rb.first[1]===0&&rb.first[2]===0&&rb.again<rb.dur-1.9&&rb.imm>1.9&&rb.inImm===0&&rb.after===rb.dur&&rb.immS===2,rb);
  const em=await J(`(()=>{${PUT}const o={};for(const n of [1,4]){${S0(4)}Object.assign(effects,BAL.card.emergency(n));drone.lane=0;drone.x=LANES[0];for(let i=0;i<8;i++)put(0,'brute',DRONE_Y-30+i*5,{hp:9e3,maxHp:9e3});drone.pulseCooldown=0;pulse();o[n]={range:effects.pulseRange,cd:+drone.pulseCooldown.toFixed(2),refund:effects.refund};}return JSON.stringify(o);})()`);
  ck('emergency: range 165 / 195 at ranks 1 and 4; the recharge counts at most four machines hit',em[1].range===165&&em[4].range===195&&em[1].cd===+(9-em[1].refund*4).toFixed(2)&&em[4].cd===3,em);
  const ct=await T("cardDescription('rubble')+' | '+cardDescription('emergency')");
  ck('card texts say where the rubble falls, its pause and the four-machine count',ct.includes('그 자리 근처의 적')&&ct.includes('2초 동안 다시 걸리지 않음')&&ct.includes('1기당(4기까지)'),ct);
  // the bosses
  const sb=await J(`(()=>{${PUT}${S0(13)}drone.lane=1;drone.x=LANES[1];const s=put(1,'boss',DRONE_Y-5,{kind:'shield',hp:9e3,maxHp:9e3}),a=put(1,'brute',DRONE_Y-30,{hp:900,maxHp:900}),c=put(1,'brute',DRONE_Y+30,{hp:900,maxHp:900});drone.pulseCooldown=0;pulse();return JSON.stringify({a:900-a.hp,c:900-c.hp,d:effects.pulseDamage});})()`);
  ck('shield boss: halves the overload on the machines behind it, not ahead',sb.a===sb.d*.5&&sb.c===sb.d,sb);
  const spb=await J(`(()=>{${S0(10)}nextSpawn=pattern.length;spawn(0,'boss','split');const c=enemies[0];c.y=300;c.wv=4;damageEnemy(c,1e9,0,0,'drone');update(1/60);return JSON.stringify(enemies.filter(e=>e.hp>0).map(e=>e.type+':'+e.maxHp+':'+e.wv));})()`);
  const spx=await T("Math.round(TYPES.brute.hp*OP_HP[10]*HP_SCALE*FOE.split.hp*(1+HP_WAVE*3))");
  ck('split boss: breaks into two large machines (60% of a large hull, its attack)',spb.length===2&&spb.every(x=>x==='brute:'+spx+':4'),{spb,spx});
  const mb=await J(`(()=>{${PUT}${S0(11)}const m=put(1,'boss',300,{kind:'medic',hp:500,maxHp:1000,speed:0}),q=put(1,'grunt',330,{hp:50,maxHp:100,speed:0}),bo=put(1,'boss',320,{hp:50,maxHp:100,speed:0});for(let i=0;i<30;i++)update(1/30);return JSON.stringify({q:+q.hp.toFixed(1),bo:bo.hp,self:m.hp});})()`);
  ck('medic boss: repairs the machines of its lane near it, not bosses, not itself',Math.abs(mb.q-60)<1.5&&mb.bo===50&&mb.self===500,mb);
  const ca=await J(`(()=>{${S0(12)}let kids=0,rare=0,behind=true;const s0=spawn;spawn=(l,t,k,o)=>{s0(l,t,k,o);const e=enemies[enemies.length-1];if(o&&o.child){kids++;if(e.rare)rare++;if(!(e.y<c.y))behind=false;}};
   s0(0,'boss','carrier');var c=enemies[0];c.y=200;c.speed=0;const at={};for(let i=1;i<=60*40;i++){update(1/60);if([294,306,594,606,2400].includes(i))at[i]=c.drops;}spawn=s0;return JSON.stringify({at,kids,rare,behind,drops:c.drops});})()`);
  ck('carrier: two small machines every 5 s behind it, six times at most, never rare',ca.at[294]===0&&ca.at[306]===1&&ca.at[594]===1&&ca.at[606]===2&&ca.at[2400]===6&&ca.kids===12&&!ca.rare&&ca.behind,ca);
  const ra=await J(`(()=>{${S0(14)}spawn(0,'boss','ram');const c=enemies[0];c.y=120;c.speed=1;const tl=[];for(let i=0;i<60*24;i++){update(1/60);tl.push(c.ramDash?'D':c.ramWarn?'w':'.');}const s=tl.join(''),runs=[];let m;const re=/w+D+/g;while((m=re.exec(s)))runs.push([m.index/60,(m[0].indexOf('D'))/60,m[0].length/60]);return JSON.stringify(runs.map(r=>r.map(x=>+x.toFixed(2))));})()`);
  ck('ram: glows 1 s, then charges 1.5 s; the first glow at 3 s, then every 8 s',ra.length===3&&ra.every((r,i)=>Math.abs(r[0]-(3+8*i))<.05&&Math.abs(r[1]-1)<.05&&Math.abs(r[2]-2.5)<.05),ra);
  const rs=await J(`(()=>{${S0(14)}spawn(0,'boss','ram');const c=enemies[0];c.y=120;c.ramT=4.1;update(.0001);const y0=c.y;update(.1);const d1=c.y-y0;c.ramT=7;update(.0001);const y1=c.y;update(.1);return JSON.stringify({dash:+d1.toFixed(3),walk:+(c.y-y1).toFixed(3),k:BOSSK.ram.k});})()`);
  ck('ram: it charges at 2.5 times its speed',Math.abs(rs.dash/rs.walk-rs.k)<.02,rs);
  const fb=await J(`(()=>{${S0(16)}spawn(0,'boss');spawn(1,'boss','shield');spawn(0,'boss','medic');return JSON.stringify(enemies.map(e=>[e.kind||'-',!!e.final,bossName(e)]));})()`);
  ck('the final machine is only the plain boss of the last chapter; boss names',JSON.stringify(fb)===JSON.stringify([['-',true,'최종 병기'],['shield',false,'방패 거대 병기'],['medic',false,'수리 거대 병기']]),fb);
  const toast=await T(`(()=>{${S0(12)}let m='';const t0=showToast;showToast=(x,d)=>{if(/접근/.test(x))m=x;t0(x,d);};pattern=[[0,1,'boss','carrier']];nextSpawn=0;update(1/60);showToast=t0;return m;})()`);
  ck('the warning names the boss',toast==='경고 · 운반 병기 접근',toast);
  const sc14=await T(`(()=>{reset();liveRun=true;newStage(13);phase='battle';enemies=[];nextSpawn=pattern.length;stageHurt=true;update(1/30);return document.querySelector('.scout').textContent;})()`);
  ck('scouting names the bosses of the next chapter',sc14.includes('· 돌진 병기 · 분열 거대 병기'),sc14);
  const bls=await J(`(()=>{learned.foes={shield2:true,split:true,medic:true};${S0(12)}liveRun=true;lessonQuiet=99;stageTime=5;spawn(0,'boss','carrier');enemies[0].y=200;lessonTick(1/30);const a={hold:holdState&&holdState.need,title:$('coachTitle').textContent,main:$('coachMain').textContent};releaseHold();return JSON.stringify({a,learned:learned.foes});})()`);
  ck('a new boss is explained the first time it is in view',bls.a.hold==='tap'&&bls.a.title==='새 적 · 운반 병기'&&bls.a.main.includes('5초마다 소형 적 2기')&&bls.learned.boss_carrier===true,bls);
  const rec=await T(`(()=>{${S0(12)}liveRun=true;core=0;update(1/30);return document.querySelector('#overlayContent .report').textContent;})()`);
  ck('the loss record lists every attack of the chapter (five in chapter 12)',/공격별 송신소 피해 · 12-1 0 · 12-2 0 · 12-3 0 · 12-4 0 · 12-5 0/.test(rec),rec);
  const dr=await T("[...document.scripts].map(x=>x.textContent).join('')");
  ck('the drill\'s last words: the last attack is 16-5, a pick after every chapter, more and stronger bosses later (not "three attacks")',dr.includes("'-'+NATT(TOTAL_OPS)+'까지")&&dr.includes('장이 끝날 때마다 강화를 하나 고릅니다')&&dr.includes('더 자주, 더 강하게')&&!dr.includes('공격을 세 번 막을 때마다'),await T("'1-1부터 '+TOTAL_OPS+'-'+NATT(TOTAL_OPS)"));
  ck('no page errors (build 2026.11.13-9 rules)',!errs.length,errs.slice(0,3));await p.close();}
 // 2.5D and 2D: the new bosses (carrier, a charging ram, a shield boss with its queue) draw without errors
 for(const [mode,w,h] of [['?q=1',844,390],['?q=1',390,844],['?2d=1',844,390],['?2d=1',390,844]]){const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning'&&/units\.js|hud\.js|fx\.js/.test(m.text()))errs.push(m.text());});
  await p.goto('file://'+f+mode);if(mode==='?q=1'){try{await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:10000});}catch(e){errs.push('2.5D did not start');}}else await p.waitForTimeout(400);
  const T=inGame(p);await T(LEARN+`learned.foes={shield2:true,split:true,medic:true,boss_shield:true,boss_split:true,boss_medic:true,boss_carrier:true,boss_ram:true};${START(13)}spawn(0,'boss','carrier');enemies[0].y=170;enemies[0].dropT=4.6;spawn(1,'boss','ram');enemies[1].y=180;enemies[1].ramT=4.2;spawn(1,'boss','shield');enemies[2].y=290;enemies[2].speed=3;spawn(1,'grunt');enemies[3].y=240;0`);
  await p.waitForTimeout(mode==='?q=1'?1500:600);if(out)await p.screenshot({path:path.join(out,'boss_'+(mode==='?q=1'?'3d':'2d')+'_'+w+'x'+h+'.png')});
  const s=await J2(T);ck(`${mode==='?q=1'?'2.5D':'2D'} ${w}x${h}: the new bosses draw without errors`,s.n>=4&&!errs.length,{s,errs:errs.slice(0,2)});await c.close();}
 // 2.5D: every variant and a repair glow draw without errors, landscape and portrait
 for(const [w,h] of [[844,390],[390,844]]){const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning'&&/units\.js|hud\.js/.test(m.text()))errs.push(m.text());});
  await p.goto('file://'+f+'?q=2');try{await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:10000});}catch(e){errs.push('2.5D did not start');}
  const T=inGame(p);await T(LEARN+`learned.foes={shield2:true,split:true,medic:true,boss_shield:true,boss_split:true,boss_medic:true,boss_carrier:true,boss_ram:true};${START(10)}spawn(0,'grunt','shield');enemies[0].y=220;spawn(0,'brute','split');enemies[1].y=280;spawn(1,'grunt','medic');enemies[2].y=240;spawn(1,'grunt');enemies[3].y=270;enemies[3].hp=30;for(const e of enemies)e.speed=3;0`);
  await p.waitForTimeout(1200);if(out)await p.screenshot({path:path.join(out,'foe_3d_'+w+'x'+h+'.png')});
  const st=JSON.parse(await T("JSON.stringify({active:G3.active,heal:enemies.some(e=>e.healT>0)})"));
  ck(`2.5D ${w}x${h}: variants and the repair glow draw without errors`,st.active&&st.heal&&!errs.length,{st,errs:errs.slice(0,2)});await c.close();}
 await b.close();end();})();
