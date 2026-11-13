// 판 2026.11.13-3 시험: 화면을 떠났다 돌아올 때(설정 창), 배경음 재시도, 강화·결과 화면의 전투 단추 숨김, 8장(배율 1.85와 새 일정),
// 다시 도전(한 판에 한 번), 패배 기록, 유인 섬멸, 다음 작전 정찰, 맵별 특별 목표(열한 장 각각 달성과 하나 모자랄 때), 화면 맞춤(스크롤 없음).
// 판 2026.11.13-4: 뒤로 가기(한 번 설정 열기, 두 번 닫기, 뒤로 가는 동안 기록을 쌓지 않음, 터치로 다시 두 칸), 바꾼 화면 문구.
// node tools/goal_test.js <게임 폴더 절대 경로> [출력 폴더(화면 사진, 생략 가능)]
const { chromium } = require('playwright');const {hooked,inGame,checks}=require('./lib.js');const path=require('path'),fs=require('fs');
const dir=path.resolve(process.argv[2]),out=process.argv[3]?path.resolve(process.argv[3]):null;if(out)fs.mkdirSync(out,{recursive:true});
const f=hooked(dir,'gl');
// a machine placed by hand: put(lane,type,y,{extra})
const PUT="const put=(lane,type,y,o)=>{const m=TYPES[type];const e=Object.assign({id:Math.random(),lane,type,x:LANES[lane],y,py:y,hp:m.hp,maxHp:m.hp,speed:0,slow:0,stun:0,flash:0,wiggle:0,wv:1},o||{});enemies.push(e);return e;};";
const START=ch=>`reset();liveRun=true;newStage(${ch});phase='battle';pattern=[[1e9,0,'runner']];nextSpawn=0;enemies=[];drone.y=DRONE_Y;holdState=null;hideCoach();`;
(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const {ck,end}=checks();
 // ---------- rules (2D page) ----------
 {const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);
  const T=inGame(p);
  await T("$('title').hidden=true;$('titleVid').pause();learned.drill=learned.item=learned.pulse=learned.combo=true;for(const m of MAPS)learned.maps[m.id]=true;for(const k in ITEMS)learned.items[k]=true;0");
  // chapter 8 numbers
  const c8=JSON.parse(await T("(()=>{const w=[0,0,0];let hp=0;for(const ev of stages[8]){w[waveIndex.call(null,ev[0])-1]||0;}const b=WAVES[8];for(const ev of stages[8])w[ev[0]<b[0]?0:ev[0]<b[1]?1:2]++;for(const ev of stages[8])hp+=Math.round(TYPES[ev[2]].hp*OP_HP[8]*(ev[2]==='boss'?1:HP_SCALE));return JSON.stringify({hp8:OP_HP[8],n:stages[8].length,w,hp,boss:stages[8].filter(e=>e[2]==='boss').length,others:OP_HP.filter((v,i)=>i!==8).join(',')});})()"));
  ck('chapter 8: hull 1.85, 84 machines in 22/30/32, one boss',c8.hp8===1.85&&c8.n===84&&c8.w.join('/')==='22/30/32'&&c8.boss===1,c8);
  ck('other chapters keep their hull',c8.others==='0,1,1,1.18,1.32,1.38,1.52,1.5,1.72,2.02,1.95,2.02',c8.others);
  // leaving the page opens the settings; closing them resumes
  await T("mute=true;"+START(3)+"0");
  const t0=+await T('stageTime');await p.waitForTimeout(300);const t1=+await T('stageTime');
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(300);
  const s1=JSON.parse(await T("JSON.stringify({open:settingsOpen,t:stageTime,paused})"));await p.waitForTimeout(300);const t2=+await T('stageTime');
  ck('blur opens the settings and the battle holds',s1.open&&!s1.paused&&Math.abs(t2-s1.t)<1e-9&&t1>t0,{t0,t1,s1,t2});
  await p.click('#setClose');await p.waitForTimeout(400);const s2=JSON.parse(await T("JSON.stringify({open:settingsOpen,t:stageTime,paused})"));
  ck('"닫고 계속" resumes the battle',!s2.open&&s2.t>t2,s2);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  ck('page hidden opens the settings',await T('settingsOpen'));
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});});
  await p.mouse.click(300,200);await p.waitForTimeout(300);
  const s3=JSON.parse(await T("JSON.stringify({open:settingsOpen,t:stageTime})"));await p.waitForTimeout(300);
  ck('a touch on the field closes the settings and play goes on',!s3.open&&+await T('stageTime')>s3.t,s3);
  await T("showOverlay(false);reset();phase='intro';0");
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));
  ck('blur outside a battle opens nothing',!(await T('settingsOpen')));
  // ambience: a battle that began before the sounds were baked gets them once baking ends; volume 0 at the start then raised
  const a1=JSON.parse(await T("(()=>{mute=false;prefs.vol=80;SFX.ready=false;SFX.ambOn=false;if(SFX.bus&&SFX.bus.ambSrc){try{SFX.bus.ambSrc.stop();}catch(e){}SFX.bus.ambSrc=null;}"+START(2)+"const before=!!(SFX.bus&&SFX.bus.ambSrc);bakeSounds(RELAY_SFX.names.length);return JSON.stringify({before,after:!!(SFX.bus&&SFX.bus.ambSrc),ready:SFX.ready});})()"));
  ck('ambience starts when the sounds become ready during a battle',!a1.before&&a1.after&&a1.ready,a1);
  const a2=JSON.parse(await T("(()=>{upgradeScreen();if(SFX.bus.ambSrc){try{SFX.bus.ambSrc.stop();}catch(e){}SFX.bus.ambSrc=null;}prefs.vol=0;choose(offeredUpgrades[0]);const before=!!SFX.bus.ambSrc;return JSON.stringify({before,op});})()"));
  await p.evaluate(()=>{const el=document.getElementById('setVol');el.value=70;el.dispatchEvent(new Event('input',{bubbles:true}));});
  const a3=JSON.parse(await T("JSON.stringify({after:!!SFX.bus.ambSrc,vol:prefs.vol,gainTarget:SFX.ambOn})"));
  ck('ambience starts when the volume is raised from 0 during a battle',!a2.before&&a3.after,{a2,a3});
  await T("mute=true;prefs.vol=100;savePrefs();if(SFX.bus&&SFX.bus.ambSrc){try{SFX.bus.ambSrc.stop();}catch(e){}SFX.bus.ambSrc=null;}0");
  // battle buttons hidden on the upgrade and result screens
  const vis=()=>p.evaluate(()=>['pulseBtn','itemBtn','itemBtn2'].map(id=>getComputedStyle(document.getElementById(id)).visibility).join(','));
  await T(START(2)+"updateControls();0");const vb=await vis();
  await T("upgradeScreen();0");const vu=await vis();
  await T("choose(offeredUpgrades[0]);core=0;update(1/30);0");const vf=await vis();const ph=await T('phase');
  await T("retryStage();0");const vr=await vis();
  ck('battle buttons: shown in battle, hidden on the upgrade and result screens, shown again after a retry',vb==='visible,visible,visible'&&vu==='hidden,hidden,hidden'&&ph==='finish'&&vf==='hidden,hidden,hidden'&&vr==='visible,visible,visible',{vb,vu,vf,vr,ph});
  // lure kill: three machines that crossed over, destroyed by one overload
  const lure=async crossed=>JSON.parse(await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='cross');${START('ch')}const evs=[];const e0=ev3;ev3=o=>{evs.push(o);e0(o);};
   for(let i=0;i<3;i++)put(drone.lane,'runner',DRONE_Y-40+i*20,{hp:1,crossed:${crossed?1:0},from:1-drone.lane});const s0=score;drone.pulseCooldown=0;pulse();for(let i=0;i<20;i++)update(1/30);ev3=e0;
   const m=evs.find(o=>o.t==='multi');return JSON.stringify({name:m&&m.name,n:m&&m.n,gain:score-s0});})()`));
  const l1=await lure(true),l0=await lure(false);
  ck('lure kill: three crossed machines in one overload are named and paid 50 each on top',l1.name==='유인 섬멸'&&l0.name==='동시 격파'&&l1.gain-l0.gain===150,{l1,l0});
  // special goals: every chapter from 2 on, met with exactly n, missed with n-1
  const G=JSON.parse(await T("JSON.stringify({count:goalCount(),one:!!goalOf(1),maps:Array.from({length:TOTAL_OPS},(_,i)=>goalOf(i+1)?MAPS[MAP_OF[i+1]].id:'-')})"));
  ck('eleven special goals, none in chapter 1',G.count===11&&!G.one&&G.maps.filter(x=>x!=='-').length===11,G);
  // each case places machines so that exactly k of them meet the goal's condition, then fires one overload (the mine case steps on a mine)
  const CASES={
   pinch:k=>`for(let i=0;i<k;i++)put(i%2,'runner',(MAPK.pinch.a+MAPK.pinch.b)/2+i*4,{hp:1});`,   // k in the gorge, the lanes taking turns
   detour:k=>`drone.lane=0;drone.x=LANES[0];for(let i=0;i<k;i++)put(0,'runner',345+i*15,{hp:1});put(0,'runner',300,{hp:1});`,   // the one at 300 is outside the detour
   wave:k=>`drone.lane=0;drone.x=LANES[0];for(let i=0;i<k;i++)put(1,'runner',350+i*15,{hp:1});put(0,'runner',360,{hp:1});`,
   gate:k=>`for(let i=0;i<k;i++)put(drone.lane,'runner',300+i*12,{hp:1,ruled:1});put(drone.lane,'runner',360,{hp:1});`,
   bridge:k=>`for(let i=0;i<k;i++)put(drone.lane,'runner',290+i*10,{});put(drone.lane,'brute',320,{hp:1});`,
   tunnel:k=>`for(let i=0;i<k;i++)put(drone.lane,'runner',245+i*15,{hp:1});put(drone.lane,'runner',360,{hp:1});`,
   cross:k=>`for(let i=0;i<k;i++)put(drone.lane,'runner',300+i*12,{hp:1,crossed:1});put(drone.lane,'runner',370,{hp:1});`,
   mine:k=>`const m=mines.find(q=>q.lane===0);const y=m.y;for(let i=0;i<k;i++)put(0,'runner',i===0?y-1:y+4+i*6,{hp:1,speed:i===0?120:0});drone.lane=1;drone.x=LANES[1];update(1/30);`,   // one mine and what it catches; the goal counts mine kills over the chapter
   flood:k=>`const c=(FLOOD[0]+FLOOD[1])/2;for(let i=0;i<k;i++)put(i%2,'brute',c-30+i*8,{hp:900});put(drone.lane,'brute',FLOOD[1]+40,{hp:900});`,
   boost:k=>`drone.lane=1;drone.x=LANES[1];for(let i=0;i<k;i++)put(1,'runner',345+i*15,{hp:1});put(1,'runner',300,{hp:1});`,
   vent:k=>`for(let i=0;i<k;i++)put(drone.lane,'runner',240+i*14,{hp:1});put(drone.lane,'runner',360,{hp:1});`,
  };
  const run=async(id,k)=>JSON.parse(await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='${id}');${START('ch')}const g=goalOf(ch);const k=${k};const evs=[];const e0=ev3;ev3=o=>{evs.push(o);e0(o);};const s0=score;
   ${CASES[id]('k')}if(!g.mine){drone.pulseCooldown=0;pulse();}ev3=e0;return JSON.stringify({met:goalNow,done:goalsDone.slice(),gain:score-s0,banner:evs.some(o=>o.t==='multi'&&o.name==='특별 목표 달성'),n:g.n,ch});})()`));
  for(const id of Object.keys(CASES)){const n=JSON.parse(await T(`JSON.stringify(GOALS['${id}'].n)`));const yes=await run(id,n),no=await run(id,n-1);
   ck(`goal ${id} (chapter ${yes.ch}): met with ${n}, not with ${n-1}`,yes.met&&yes.banner&&yes.done.join()===String(yes.ch)&&yes.gain>=300&&!no.met&&!no.done.length,{yes,no});}
  const one=JSON.parse(await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='pinch');${START('ch')}for(let i=0;i<6;i++)put(drone.lane,'runner',DRONE_Y-30+i*10,{hp:1});drone.pulseCooldown=0;pulse();return JSON.stringify({met:goalNow});})()`));
  ck('goal pinch: six on one lane do not count',!one.met,one);
  const twice=JSON.parse(await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='tunnel');${START('ch')}const s0=score;for(let r=0;r<2;r++){for(let i=0;i<3;i++)put(drone.lane,'runner',245+i*15,{hp:1});drone.pulseCooldown=0;pulse();}return JSON.stringify({done:goalsDone.length,gain:score-s0});})()`));
  ck('a goal pays once per chapter',twice.done===1&&twice.gain<600,twice);
  // scouting on the upgrade screen
  const sc=await T(`(()=>{${START(7)}enemies=[];nextSpawn=pattern.length;stageHurt=true;update(1/30);return document.querySelector('.scout').textContent;})()`);
  ck('scouting names chapter 8, its machines, the boss and the goal',/다음 작전 · WAVE 8 샛길/.test(sc)&&/적 84기 · 소형 35 · 중형 38 · 대형 10 · 거대 병기/.test(sc)&&sc.includes('건너온 적 4기를 과부하 한 번으로 격파 (+300점)'),sc);
  const sc11=await T(`(()=>{${START(11)}enemies=[];nextSpawn=pattern.length;update(1/30);return document.querySelector('.scout').textContent;})()`);
  ck('scouting before the last chapter names the final machine',/WAVE 12 화염로/.test(sc11)&&/최종 병기/.test(sc11),sc11);
  const gl=await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='tunnel');${START('ch')}for(let i=0;i<3;i++)put(drone.lane,'runner',245+i*15,{hp:1});drone.pulseCooldown=0;pulse();enemies=[];nextSpawn=pattern.length;update(1/30);return document.querySelector('#overlayContent .report').textContent;})()`);
  ck('the upgrade screen reports a met goal',gl.includes('특별 목표 달성 · +300점'),gl);
  // retry: lose chapter 3 after two upgrades; the retry restores what chapter 3 began with, with the score cut by 20%
  const r=JSON.parse(await T(`(()=>{${PUT}beginRun();holdState=null;hideCoach();lessonQuiet=99;
   for(const ch of [1,2]){enemies=[];nextSpawn=pattern.length;stageHurt=true;update(1/30);choose(offeredUpgrades[0]);}
   const snap=JSON.parse(JSON.stringify({op,core,bag,score,ranks:upgradeRanks,hist:upgradeHistory.length,kills,leaks,effects}));
   score+=777;bag=['wall','jam'];kills+=5;core=0;put(0,'runner',LEAK_Y-1,{wv:2});put(1,'runner',LEAK_Y-1,{wv:3});put(1,'runner',LEAK_Y-1,{wv:3});enemies.forEach(e=>e.speed=60);update(1/20);
   const fin={phase,again:!!$('againBtn'),againText:$('againBtn')&&$('againBtn').textContent,retryText:$('retryBtn').textContent,report:document.querySelector('#overlayContent .report').textContent};
   $('againBtn').click();
   const after={phase,op,core,bag:bag.slice(),score,ranks:upgradeRanks,hist:upgradeHistory.length,kills,leaks,effects,retryUsed};
   core=0;update(1/30);const fin2={phase,again:!!$('againBtn'),retryText:$('retryBtn').textContent,report:document.querySelector('#overlayContent .report').textContent};
   return JSON.stringify({snap,fin,after,fin2});})()`));
  const S=r.snap,A=r.after;
  ck('loss offers the one retry of the run',r.fin.phase==='finish'&&r.fin.again&&/WAVE 3-1부터 다시/.test(r.fin.againText)&&/점수 -20%/.test(r.fin.againText)&&r.fin.retryText==='처음부터 다시 출격',r.fin);
  ck('retry restores the chapter start (upgrades, items, hub, record) with the score cut by 20%',A.phase==='battle'&&A.op===3&&A.core===S.core&&JSON.stringify(A.bag)===JSON.stringify(S.bag)&&JSON.stringify(A.ranks)===JSON.stringify(S.ranks)&&A.hist===S.hist&&A.kills===S.kills&&A.leaks===S.leaks&&JSON.stringify(A.effects)===JSON.stringify(S.effects)&&A.score===Math.round(S.score*.8)&&A.retryUsed,{S,A});
  ck('second loss: no retry, plain restart, the report says the retry was used',r.fin2.phase==='finish'&&!r.fin2.again&&r.fin2.retryText==='다시 출격'&&r.fin2.report.includes('다시 도전 1회 사용'),r.fin2);
  ck('loss record: breaches by lane and by attack, overloads',r.fin.report.includes('WAVE 3 돌파 · 발전소 쪽 1 · 정비소 쪽 2')&&r.fin.report.includes('공격별 · 3-1 0기 · 3-2 1기 · 3-3 2기')&&/과부하 0회 · 한 번에 최대 0기/.test(r.fin.report)&&/특별 목표 0 \/ 11/.test(r.fin.report),r.fin.report);
  const rec=await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='cross');beginRun();newStage(ch);holdState=null;hideCoach();pattern=[[1e9,0,'runner']];nextSpawn=0;enemies=[];
   for(let i=0;i<3;i++)put(drone.lane,'brute',DRONE_Y-30+i*15,{hp:900});drone.pulseCooldown=0;pulse();drone.pulseCooldown=0;put(drone.lane,'brute',DRONE_Y,{hp:900});pulse();core=0;update(1/30);return document.querySelector('#overlayContent .report').textContent;})()`);
  ck('loss record counts overloads and the most machines one struck',/과부하 2회 · 한 번에 최대 4기/.test(rec),rec);
  const win=await T(`(()=>{${START(12)}stars=[1,1,1,1,1,1,1,1,1,1,1];enemies=[];nextSpawn=pattern.length;update(1/30);return JSON.stringify({phase,again:!!$('againBtn'),retry:$('retryBtn').textContent,rec:/돌파 · 발전소 쪽/.test(document.querySelector('#overlayContent .report').textContent)});})()`);
  ck('victory: no retry button and no loss record',JSON.parse(win).phase==='finish'&&!JSON.parse(win).again&&JSON.parse(win).retry==='다시 출격'&&!JSON.parse(win).rec,win);
  ck('no page errors (2D)',!errs.length,errs.slice(0,3).join(' | '));await p.close();}
 // ---------- back button (real page, real touches): the first back opens the settings, the second closes them, going back adds nothing ----------
 // Chrome skips history entries a page adds without a user activation (docs/history_manipulation_intervention.md in Chromium), so the game may add
 // entries only during a touch or a key press. The test counts every pushState and when it happens. (page.goBack() is history.back(), which Chrome does
 // not subject to the skipping, so the skipping itself cannot be reproduced here; what is checked is that the game never needs it.)
 for(const mode of ['','?2d=1']){const c=await b.newContext({viewport:{width:844,height:390},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{window.__push=[];window.__inPop=false;const ps=history.pushState.bind(history);history.pushState=function(st,t,u){window.__push.push({inPop:window.__inPop,relay:st&&st.relay});return ps(st,t,u);};
   window.addEventListener('popstate',()=>{window.__inPop=true;setTimeout(()=>{window.__inPop=false;},0);},{capture:true});});
  await p.goto('file://'+f+mode);if(!mode){try{await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:8000});}catch(e){errs.push('2.5D did not start');}}
  await p.waitForTimeout(300);const T=inGame(p);const url0=p.url();
  await T("mute=true;learned.drill=learned.item=learned.pulse=learned.combo=true;for(const m of MAPS)learned.maps[m.id]=true;0");
  await p.click('#skipFilm');await p.click('#skipBtn');await p.waitForTimeout(400);await T("holdState=null;hideCoach();0");
  const st=()=>p.evaluate(()=>({open:!document.getElementById('settings').hidden,depth:history.state&&history.state.relay||0,pushes:window.__push.length,inPop:window.__push.filter(x=>x.inPop).length,phase:window.__relay.phase,t:+window.__relay.stageTime.toFixed(2)}));
  const box=await p.locator('#field').boundingBox();const tap=()=>p.mouse.click(box.x+box.width*.4,box.y+box.height*.3);
  await tap();await p.waitForTimeout(200);const s0=await st();
  await p.goBack();await p.waitForTimeout(300);const s1=await st();
  await p.goBack();await p.waitForTimeout(300);const s2=await st();await p.waitForTimeout(300);const s2b=await st();
  await tap();await p.waitForTimeout(200);const s3=await st();
  await p.goBack();await p.waitForTimeout(300);const s4=await st();
  await p.click('#setClose');await p.waitForTimeout(300);const s5=await st();
  await p.goBack();await p.waitForTimeout(300);const s6=await st();await p.goBack();await p.waitForTimeout(300);const s7=await st();
  await tap();await p.waitForTimeout(200);const s8b=await st();   // playing again (tops up to two), then the player leaves the page
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(200);const s8=await st();
  await p.goBack();await p.waitForTimeout(300);const s9=await st();
  const tag=(mode?'2D':'2.5D')+' back button';
  ck(tag+': a touch lays down two entries',s0.depth===2&&s0.pushes>=2&&!s0.open,s0);
  ck(tag+': first back opens the settings',s1.open&&s1.depth===1,s1);
  ck(tag+': second back closes them and the battle goes on',!s2.open&&s2.depth===0&&s2b.t>s2.t&&s2.phase==='battle'&&p.url()===url0,{s2,s2b});
  ck(tag+': nothing is added while going back',s9.inPop===0&&s2.pushes===s0.pushes,{pushes:[s0.pushes,s1.pushes,s2.pushes],inPop:s9.inPop});
  ck(tag+': the next touch tops up to two, back opens again, "닫고 계속" closes and tops up',s3.depth===2&&s4.open&&s4.depth===1&&!s5.open&&s5.depth===2&&s6.open&&!s7.open,{s3,s4,s5,s6,s7});
  ck(tag+': settings opened by leaving the page close with one back',s8b.depth===2&&s8.open&&!s9.open&&s9.depth===1&&s9.phase==='battle',{s8b,s8,s9});
  ck(tag+': no page errors',!errs.length,errs.slice(0,2));await c.close();}
 // ---------- wording (2026-11-13 review): the new texts are on screen and the old ones are gone ----------
 {const p=await b.newPage({viewport:{width:844,height:390}});await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(300);const T=inGame(p);
  const w=JSON.parse(await T(`JSON.stringify({title:document.title,tag:document.querySelector('.title-tag').textContent,caps:FILM_CAPS.map(c=>c[2]),cards:Object.values(CARD_NAMES),multi:[3,4,5,8].map(MULTI_NAME),
   rules:MAPS.map(m=>m.rule).join(' '),repair:ITEMS.repair.desc,build:$('titleBuild').textContent})`));
  ck('wording: title, tagline, film captions, card names, multi-kill names',w.title==='중계선: 최후의 방어'&&w.tag.startsWith('전선은 둘, 지원 기체는 하나.')&&w.caps.join('/')==='전선은 둘/지원 기체는 하나/중앙 송신소를 지켜라'&&w.cards.join('/')==='기동 사격/비상 축전/협동 조준/잔해 살포'&&w.multi.join('/')==='동시 격파/동시 격파/대량 격파/섬멸'&&/^시험판 · /.test(w.build),w);
  ck('wording: map rules and the repair text',w.rules.includes('협곡에서는 두 전선이 붙어 있어')&&w.rules.includes('물에 잠긴 적에게는')&&w.rules.includes('피해를 입습니다')&&w.rules.includes('바로 파괴됩니다')&&w.rules.includes('번집니다. 터진 지뢰는')&&!/(고|며|면서|어서|아서),/.test(w.rules)&&w.repair.startsWith('두 시설 가운데 더 부서진 쪽의'),w.rules.slice(0,120));
  const up=await T(`(()=>{mute=true;$('title').hidden=true;reset();newStage(1);liveRun=true;phase='battle';pattern=[];nextSpawn=0;enemies=[];facilities=[0,100];update(1/30);return document.querySelector('#overlayContent').textContent;})()`);
  ck('wording: facility words on the upgrade screen (가동/정지), no 유지/붕괴/생존',up.includes('발전소 정지')&&up.includes('정비소 가동')&&!/유지|붕괴|생존/.test(up),up.slice(0,160));
  await p.close();}
 // ---------- screens: no scroll, every button inside the screen, text size (2.5D and 2D) ----------
 const sizes=[[568,320],[667,375],[844,390],[390,844],[360,740]];
 for(const mode of ['','?2d=1'])for(const [w,h] of sizes){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+f+mode);if(!mode){try{await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:8000});}catch(e){errs.push('2.5D did not start');}}
  await p.waitForTimeout(300);const T=inGame(p);
  await T("$('title').hidden=true;$('titleVid').pause();mute=true;learned.drill=learned.item=learned.pulse=learned.combo=true;for(const m of MAPS)learned.maps[m.id]=true;0");
  const measure=()=>p.evaluate(()=>{const q=s=>document.querySelector(s),content=q('#overlayContent'),z=parseFloat(content.style.zoom)||1;
   const inside=el=>{if(!el)return true;const r=el.getBoundingClientRect();return r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1;};
   let min=99;for(const el of content.querySelectorAll('p,.report,.scout,small,.ctag,.k'))if(el.offsetParent)min=Math.min(min,parseFloat(getComputedStyle(el).fontSize)*z);
   return{zoom:+z.toFixed(3),minFont:+min.toFixed(1),scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,
    buttons:[...content.querySelectorAll('button')].every(inside),card:inside(q('.overlay-card'))};});
  // the busiest upgrade screen: a met goal, the item reward and the scouting of chapter 8
  await T(`(()=>{reset();liveRun=true;newStage(7);phase='battle';pattern=[];nextSpawn=0;enemies=[];goalNow=true;stageHurt=false;score=123456;bestCombo=88;update(1/30);})()`);await p.waitForTimeout(900);
  const up=await measure();if(out)await p.screenshot({path:path.join(out,`upgrade_${mode?'2d':'3d'}_${w}x${h}.png`)});
  // the busiest result screen: a loss with the record and both buttons
  await T(`(()=>{choose(offeredUpgrades[0]);chap={leaks:[4,1],waves:[0,2,3],pulses:3,maxHit:2};core=0;update(1/30);})()`);await p.waitForTimeout(900);
  const fi=await measure();if(out)await p.screenshot({path:path.join(out,`result_${mode?'2d':'3d'}_${w}x${h}.png`)});
  ck(`${mode?'2D':'2.5D'} ${w}x${h}: upgrade and result screens fit without scrolling, all buttons on screen`,!up.scroll&&!fi.scroll&&up.buttons&&fi.buttons&&up.card&&fi.card&&!errs.length,{up,fi,errs:errs.slice(0,2)});
  await c.close();}
 // ---------- 2.5D: the banners of a lure kill and a met goal draw without errors ----------
 {const c=await b.newContext({viewport:{width:844,height:390},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning'&&/hud\.js/.test(m.text()))errs.push(m.text());});
  await p.goto('file://'+f);try{await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:8000});}catch(e){errs.push('2.5D did not start');}
  const T=inGame(p);
  await T(`(()=>{$('title').hidden=true;$('titleVid').pause();mute=true;learned.drill=learned.item=learned.pulse=learned.combo=true;for(const m of MAPS)learned.maps[m.id]=true;${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='cross');${START('ch')}
   for(let i=0;i<4;i++)put(drone.lane,'runner',DRONE_Y-40+i*15,{hp:1,crossed:1,from:1-drone.lane});put(drone.lane,'brute',DRONE_Y+60,{hp:900});drone.pulseCooldown=0;pulse();})()`);
  await p.waitForTimeout(150);if(out)await p.screenshot({path:path.join(out,'banner_goal.png')});
  await p.waitForTimeout(1500);if(out)await p.screenshot({path:path.join(out,'banner_lure.png')});
  const st=JSON.parse(await T("JSON.stringify({goal:goalNow,active:G3.active})"));
  ck('2.5D: goal and lure banners queue and draw without errors',st.goal&&st.active&&!errs.length,{st,errs:errs.slice(0,2)});await c.close();}
 await b.close();end();})();
