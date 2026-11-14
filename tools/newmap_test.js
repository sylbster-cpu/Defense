// 맵 규칙(고압선, 관문, 다리, 터널, 샛길, 침수로, 가속로, 격납고, 포격장, 변전소, 역장, 도주로, 모래폭풍), 열여섯 장 구성(판 2026.11.13-7), 강화 상한, 새 아이템(연쇄 번개, 궤도 포격),
// 콤보·다중 격파·점수·별, 새 지형 안내, 2.5D에서 오류 없이 그려지는지 확인.  node tools/newmap_test.js <게임 폴더 절대 경로>
const { chromium } = require('playwright');const {hooked,checks,inGame}=require('./lib.js');const path=require('path');const dir=path.resolve(process.argv[2]);
const f=hooked(dir,'nm');
(async()=>{const b=await chromium.launch();const {ck,end}=checks();
 // ---- rules, on the 2D page with the clock in the test's hands ----
 {const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));const T=inGame(p);const J=async x=>JSON.parse(await T(x));
  await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  await T(`mute=true;$('title').hidden=true;learned.item=true;learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=true;
   window.__stage=k=>{reset();newStage(k);enemies=[];pattern=[[1e9,0,'runner']];nextSpawn=0;turrets=[];};
   window.__put=(l,t,y,hp)=>{spawn(l,t);const e=enemies[enemies.length-1];e.y=y;if(hp){e.hp=e.maxHp=hp;}return e;};
   window.__run=sec=>{for(let i=0;i<Math.round(sec*60);i++)update(1/60);};window.__cid=id=>MAP_OF.findIndex(i=>MAPS[i].id===id);0`);
  // structure
  ck('sixteen chapters, each on its own map',await T("TOTAL_OPS===16&&new Set(MAP_OF.slice(1)).size===16&&MAP_OF.slice(1).every(i=>i>0)"),await T("MAP_OF.slice(1).map(i=>MAPS[i].id).join()"));
  ck('maps per chapter',await T("MAP_OF.slice(1).map(i=>MAPS[i].id).join()")==='pylon,pinch,detour,wave,gate,bridge,tunnel,cross,hangar,flood,flee,boost,barrier,storm,grid,mortar');
  ck('the minefield and the fire vents are gone',await T("!MAPS.some(m=>m.id==='mine'||m.id==='vent')&&typeof MINE==='undefined'&&typeof VENT==='undefined'"));
  ck('every chapter has a schedule, three waves, a hull scale and a name',await T("Array.from({length:TOTAL_OPS},(_,i)=>i+1).every(k=>stages[k]&&stages[k].length>20&&WAVES[k]&&OP_HP[k]>0)"));
  ck('only chapter 16 has the last boss',await T("__stage(8);spawn(0,'boss');const a=!enemies[0].final;__stage(TOTAL_OPS);spawn(0,'boss');a&&enemies[0].final===true"));
  ck('the drill keeps the plain straight road',await T("MAPS[0].id==='straight'&&!MAPS[0].rule"));
  // the maps whose rule lives in a stretch of road (the six of build 2026.11.13-7 act through doors, shells, charges, a wall or the weather and were tuned by their own numbers)
  ck('every stretch map has a stretch of about a fifth of the field',await T("MAPS.slice(1).filter(m=>!['hangar','mortar','grid','barrier','flee','storm'].includes(m.id)).every(m=>{let n=0,t=0;for(let l=0;l<2;l++)for(let y=LANE_TOP;y<LEAK_Y;y++){t++;if(m.zone(l,y))n++;}return n/t>.19&&n/t<.24;})"),await T("MAPS.slice(1).map(m=>{let n=0,t=0;for(let l=0;l<2;l++)for(let y=LANE_TOP;y<LEAK_Y;y++){t++;if(m.zone(l,y))n++;}return m.id+' '+Math.round(n/t*100)+'%';}).join(', ')"));
  // 고압선
  await T("__stage(1);window.__a=[__put(0,'brute',200,1000),__put(0,'brute',320,1000)];damageEnemy(__a[0],10,0,0,'drone');damageEnemy(__a[1],10,0,0,'drone');0");
  ck('pylon: machines under the lines take 1.2x damage, others not',await T("__a[0].hp===1000-12&&__a[1].hp===990"),await T("__a.map(e=>e.hp)"));
  // 관문
  await T("__stage(__cid('gate'));drone.lane=1;drone.x=LANES[1];window.__g=[__put(0,'grunt',150,1e6),__put(0,'runner',120,1e6),__put(1,'grunt',150,1e6)];__run(3);0");
  const g1=await J("JSON.stringify({shut:[gateShut(0),gateShut(1)],y:__g.map(e=>+e.y.toFixed(1))})");const GY=+await T('GATE.y');
  ck('gate: lane 0 shuts first, the first machine waits with its nose at the gate',g1.shut[0]&&!g1.shut[1]&&Math.abs(g1.y[0]-(GY-13))<.02,g1);
  ck('gate: the next one queues a body length behind',g1.y[1]<=g1.y[0]-(13+10+3)+.01,g1);
  ck('gate: the open lane flows',g1.y[2]>GY+50,g1);
  await T("__run(4);0");const g2=await J("JSON.stringify({shut:[gateShut(0),gateShut(1)],y:__g.map(e=>+e.y.toFixed(1))})");
  ck('gate: after 4 s lane 0 opens and lane 1 shuts two seconds later',!g2.shut[0]&&g2.shut[1]&&g2.y[0]>GY,g2);
  await T("const e=__put(1,'grunt',150,1e6);__g.push(e);__run(1.5);0");ck('gate: lane 1 now holds',await T("Math.abs(__g[3].y-(GATE.y-13))<.02"),await T("__g[3].y"));
  // 다리
  await T("__stage(__cid('bridge'));drone.lane=0;drone.x=LANES[0];window.__b=[__put(0,'grunt',250),__put(0,'brute',270,5000),__put(0,'boss',280,5000),__put(0,'grunt',350,5000)];drone.pulseCooldown=0;pulse();0");
  const br=await J("JSON.stringify(__b.map(e=>Math.round(e.hp)))");
  ck('bridge: the overload knocks a small or medium machine off',br[0]<=0&&await T("__b[0].fell===true"),br);
  ck('bridge: brutes and bosses hold on and take the overload damage',br[1]===5000-75&&br[2]===5000-75,br);
  ck('bridge: off the bridge, ordinary damage',br[3]===5000-75,br);
  await T("const e=__put(0,'grunt',300,100);e.hp=21;damageEnemy(e,2,0,0,'drone');window.__bl=e;0");ck('bridge: a badly damaged machine on the bridge falls too',await T("__bl.hp<=0&&__bl.fell===true"));
  // 터널
  await T("__stage(__cid('tunnel'));drone.lane=0;drone.x=LANES[0];window.__u=[__put(0,'grunt',250,5000),__put(0,'grunt',320,5000)];0");
  ck('tunnel: a machine inside cannot be targeted',await T("pickTarget(0,DRONE_Y,999)===__u[1]&&pickTarget(0,250,5)===null"));
  await T("drone.pulseCooldown=0;pulse();0");ck('tunnel: the overload reaches inside',await T("__u[0].hp<5000&&__u[1].hp<5000"),await T("__u.map(e=>e.hp)"));
  await T("bag=['magnet'];aim=0;useAim(0,330);0");ck('tunnel: the magnet does not pull it out',await T("!(__u[0].pullT>0)"));
  await T("__u[0].y=300;0");ck('tunnel: out of the exit it can be hit again',await T("pickTarget(0,DRONE_Y,999)!==null&&!map.cover(0,300)"));
  // 샛길
  await T("__stage(__cid('cross'));drone.lane=0;drone.x=LANES[0];window.__c=[__put(1,'grunt',CROSS[0]+3,1e6),__put(0,'grunt',CROSS[0]+3,1e6),__put(1,'brute',CROSS[0]+3,1e6),__put(1,'boss',CROSS[0]+3,1e6)];__run(.3);0");
  const c1=await J("JSON.stringify(__c.map(e=>[e.lane,e.from===undefined?-1:e.from,+(e.crossT||0).toFixed(2)]))");
  ck('crossover: a machine on the other lane comes over to the drone',c1[0][0]===0&&c1[0][1]===1&&c1[0][2]>0,c1);
  ck('crossover: a machine on the drone lane stays',c1[1][0]===0&&c1[1][1]===-1,c1);
  ck('crossover: brutes and bosses keep their lane',c1[2][0]===1&&c1[3][0]===1,c1);
  await T("drone.lane=1;drone.x=LANES[1];const e=__put(0,'runner',CROSS[0]+20,1e6);__c.push(e);__run(.2);0");ck('crossover: it follows where the drone is, anywhere in the stretch',await T("__c[4].lane===1"));
  ck('crossover: a machine crosses only once',await T("__c[0].lane===0"));
  // 침수로
  await T("__stage(__cid('flood'));drone.lane=0;drone.x=LANES[0];window.__w=[__put(1,'brute',300,5000),__put(1,'brute',420,5000)];drone.pulseCooldown=0;pulse();0");
  ck('flood: the overload shocks machines in the water on the other lane, not outside it',await T("__w[0].hp===5000-Math.round(75*MAPK.flood.k*100)/100&&__w[1].hp===5000"),await T("__w.map(e=>e.hp)"));
  await T("__stage(__cid('flood'));drone.lane=0;drone.x=LANES[0];window.__w2=[__put(0,'brute',300,5000),__put(0,'brute',310,5000)];drone.shotCooldown=0;update(1/60);0");
  ck('flood: a drone round spreads to a machine close by in the water',await T("__w2[0].hp<5000&&__w2[1].hp<5000"),await T("__w2.map(e=>+e.hp.toFixed(1))"));
  // 가속로
  await T("__stage(__cid('boost'));drone.lane=0;drone.x=LANES[0];window.__f=[__put(0,'brute',200,1e6),__put(1,'brute',200,1e6)];for(const e of __f)e.speed=TYPES.brute.speed;__run(.5);0");   // (every machine's own speed spread taken out)
  ck('boost: machines on the rails of the workshop lane are 15% faster',await T("Math.abs((__f[1].y-200)/(__f[0].y-200)-MAPK.boost.k)<.02"),await T("__f.map(e=>+e.y.toFixed(2))"));
  // 격납고: a door opens every cycle, the lanes in turn, and lets out two small machines; the drone on that lane keeps it shut (and the goal counts it)
  await T("__stage(__cid('hangar'));drone.lane=1;drone.x=LANES[1];hangarT=[stageTime,stageTime+99];window.__hv=[];const e0=ev3;ev3=o=>{if(o.t==='hangar')__hv.push(o);e0(o);};update(1/60);ev3=e0;0");
  const h1=await J("JSON.stringify({n:enemies.length,lanes:enemies.map(e=>e.lane),types:enemies.map(e=>e.type),ys:enemies.map(e=>Math.round(e.y)),child:!enemies.some(e=>e.rare),ev:__hv,next:hangarT[0]-stageTime})");
  ck('hangar: the door of a lane without the drone opens and lets out two small machines at the door (never rare)',h1.n===2&&h1.lanes.join()==='0,0'&&h1.types.join()==='runner,runner'&&h1.ys.every(y=>Math.abs(y-250)<=5)&&h1.child&&h1.ev.length===1&&!h1.ev[0].shut&&Math.abs(h1.next-12)<.05,h1);
  await T("enemies=[];drone.lane=0;drone.x=LANES[0];hangarT[0]=stageTime;window.__hv=[];const e1=ev3;ev3=o=>{if(o.t==='hangar')__hv.push(o);e1(o);};update(1/60);ev3=e1;0");
  ck('hangar: with the drone on that lane the door stays shut, and that is counted for the goal',await T("enemies.length===0&&__hv.length===1&&__hv[0].shut===1&&chap.cnt===1"),await T("JSON.stringify({n:enemies.length,ev:__hv,cnt:chap.cnt})"));
  await T("drone.lane=1;drone.x=LANES[1];nextSpawn=pattern.length;hangarT[0]=stageTime;update(1/60);0");ck('hangar: no door opens once the attack has all come out',await T("enemies.length===0"));
  ck('hangar: the doors take turns (lane 0 at half a cycle, lane 1 at a full cycle)',await T("newStage(__cid('hangar'));hangarT[0]===HANGAR.cycle/2&&hangarT[1]===HANGAR.cycle"));
  // 포격장: a shell every cycle on the turrets, the lanes in turn; the drone on that lane shoots it down, otherwise that lane's turret stops for MORTAR.stun s
  await T("reset();newStage(__cid('mortar'));enemies=[];pattern=[[1e9,0,'runner']];nextSpawn=0;drone.lane=0;drone.x=LANES[0];shellT=.001;update(1/60);window.__m0=JSON.stringify(shells);__run(MORTAR.fall+.1);0");
  ck('mortar: the shell falls for MORTAR.fall s on lane 0 first; over the drone it is shot down and the goal counts it',await T("JSON.parse(__m0).length===1&&JSON.parse(__m0)[0].lane===0&&shells.length===0&&turrets.every(t=>!(t.jam>0))&&chap.cnt===1"),await T("JSON.stringify({m0:__m0,jam:turrets.map(t=>t.jam||0),cnt:chap.cnt})"));
  await T("shellT=.001;update(1/60);window.__ml=shells[0]&&shells[0].lane;window.__mt=__put(1,'grunt',TURRET_Y-30,1e6);__mt.speed=0;__run(MORTAR.fall+.05);window.__mh=__mt.hp;window.__mj=turrets.find(t=>t.lane===1).jam;__run(MORTAR.stun-.3);window.__mh2=__mt.hp;__run(.6);0");
  ck('mortar: the next shell goes to lane 1; with the drone away it stops that turret for MORTAR.stun s, then it fires again',await T("__ml===1&&__mj>MORTAR.stun-.1&&__mh2===__mh&&__mt.hp<__mh&&!(turrets.find(t=>t.lane===0).jam>0)"),await T("JSON.stringify({lane:__ml,jam:__mj,hp:[__mh,__mh2,__mt.hp]})"));
  ck('mortar: no shells once the attack has all come out',await T("enemies=[];shells=[];nextSpawn=pattern.length;shellT=.001;update(1/60);shells.length===0"));
  // 변전소: every overload uses a charge; with none left it does not fire; a charge comes back every GRID.refill s, up to GRID.max
  await T("__stage(__cid('grid'));drone.lane=0;drone.x=LANES[0];window.__gq=[];for(let i=0;i<GRID.max;i++){__put(0,'brute',DRONE_Y-20,5000);drone.pulseCooldown=0;pulse();__gq.push(grid);}__put(0,'brute',DRONE_Y-20,5000);drone.pulseCooldown=0;pulse();window.__gcd=drone.pulseCooldown;0");
  ck('substation: each overload takes one of four charges; with none left the overload does not fire',await T("__gq.join()==='3,2,1,0'&&grid===0&&__gcd===0"),await T("JSON.stringify({q:__gq,cd:__gcd})"));
  await T("__run(GRID.refill-.1);window.__g1=grid;__run(.2);window.__g2=grid;__run(GRID.refill*6);0");
  ck('substation: a charge comes back every GRID.refill s, never above GRID.max',await T("__g1===0&&__g2===1&&grid===GRID.max"),await T("[__g1,__g2,grid]"));
  // 역장: up BARRIER.up of every BARRIER.cycle s; while up, nothing reaches a machine beyond it; machines walk through
  await T("__stage(__cid('barrier'));drone.lane=0;drone.x=LANES[0];stageTime=1;window.__ba=[__put(0,'brute',BARRIER.y-15,5000),__put(0,'brute',BARRIER.y+20,5000)];for(const e of __ba)e.speed=0;0");
  ck('barrier: while it stands a machine beyond it cannot be targeted, one this side can',await T("barrierUp()&&behindBarrier(__ba[0])&&!behindBarrier(__ba[1])&&pickTarget(0,DRONE_Y,999)===__ba[1]"));
  await T("drone.pulseCooldown=0;pulse();0");ck('barrier: the overload does not reach past it either',await T("__ba[0].hp===5000&&__ba[1].hp<5000"),await T("__ba.map(e=>e.hp)"));
  ck('barrier: it goes down after BARRIER.up s, and the machine beyond can be hit',await T("stageTime=BARRIER.up+.5;!barrierUp()&&!behindBarrier(__ba[0])&&pickTarget(0,BARRIER.y-15,5)===__ba[0]"));
  await T("__stage(__cid('barrier'));window.__bw=__put(0,'grunt',BARRIER.y-30);window.__bs=__bw.speed;stageTime=0;__run(1.5);0");
  ck('barrier: machines walk through it at their own speed',await T("__bw.y>BARRIER.y-30+__bs*1.4&&barrierUp()"),await T("__bw.y"));
  // 도주로: a small machine on the drone's lane in the stretch runs over to the other lane; medium ones and machines on the other lane stay
  await T("__stage(__cid('flee'));drone.lane=0;drone.x=LANES[0];window.__fl=[__put(0,'runner',FLEE[0]+3,1e6),__put(0,'grunt',FLEE[0]+3,1e6),__put(1,'runner',FLEE[0]+3,1e6)];__run(.2);0");
  const fl=await J("JSON.stringify(__fl.map(e=>[e.lane,e.from===undefined?-1:e.from,!!e.crossed]))");
  ck('flee: a small machine on the drone lane runs to the other lane; medium ones and the other lane stay',fl[0][0]===1&&fl[0][1]===0&&fl[0][2]&&fl[1][0]===0&&!fl[1][2]&&fl[2][0]===1&&!fl[2][2],fl);
  await T("drone.lane=1;drone.x=LANES[1];__run(.2);0");ck('flee: it runs once only',await T("__fl[0].lane===1"));
  // 모래폭풍: every range is 80%, machines 10% slower
  await T("__stage(__cid('storm'));0");
  ck('storm: drone, overload, turret and field-turret ranges are STORM.range of normal',await T("Math.abs(DR()-effects.droneRange*STORM.range)<1e-9&&Math.abs(PR()-effects.pulseRange*STORM.range)<1e-9&&Math.abs(TR()-BAL.turretRange*STORM.range)<1e-9&&rangeK()===STORM.range"));
  await T("drone.lane=0;drone.x=LANES[0];window.__st=[__put(0,'brute',DRONE_Y-effects.droneRange*.9,5000)];__st[0].speed=0;0");
  ck('storm: a machine just inside the normal range is out of the drone\'s reach',await T("pickTarget(0,DRONE_Y,DR())===null&&pickTarget(0,DRONE_Y,effects.droneRange)===__st[0]"));
  await T("__stage(__cid('storm'));window.__sw=[__put(0,'brute',200,1e6)];__sw[0].speed=TYPES.brute.speed;__run(1);__stage(__cid('pinch'));__sw.push(__put(0,'brute',200,1e6));__sw[1].speed=TYPES.brute.speed;__run(1);0");
  ck('storm: machines walk at STORM.speed of their speed',await T("Math.abs((__sw[0].y-200)/(__sw[1].y-200)-STORM.speed)<.02"),await T("__sw.map(e=>+e.y.toFixed(2))"));
  // items
  ck('items: twelve kinds, and the drop is one of thirteen (twelve plus the field turret)',await T("Object.keys(ITEMS).length===12&&ITEMS.chain&&ITEMS.orbital&&ICON.chain&&ICON.orbital"));
  await T("__stage(2);window.__ch=[__put(0,'brute',400,1000),__put(0,'brute',350,1000),__put(1,'brute',380,1000),__put(1,'brute',150,1000)];applyItem('chain');0");
  ck('chain lightning: from the foremost machine to the nearest, across lanes, not to one out of reach',await T("__ch[0].hp===940&&__ch[1].hp===940&&__ch[2].hp===940&&__ch[3].hp===1000"),await T("__ch.map(e=>e.hp)"));
  await T("__stage(2);learned.item=true;liveRun=false;window.__o=[__put(1,'brute',300,1000),__put(1,'brute',350,1000),__put(1,'brute',400,1000),__put(0,'brute',300,1000)];for(const e of __o)e.speed=0;drone.lane=1;drone.x=LANES[1];drone.shotCooldown=99;bag=['orbital'];useItem(0);window.__oa=aim;useAim(1,300);window.__os=strikes.length;__run(.5);window.__oh=__o[0].hp;__run(.7);0");
  ck('orbital strike: aimed like the magnet, lands a second later on that lane only',await T("__oa===0&&__os===1&&__oh===1000&&__o[0].hp===840&&__o[1].hp===840&&__o[2].hp===1000&&__o[3].hp===1000&&strikes.length===0&&bag.length===0"),await T("__o.map(e=>e.hp)"));
  // feel
  await T("__stage(2);for(let i=0;i<5;i++){const e=__put(0,'runner',300);damageEnemy(e,1e6,0,0,'drone');}window.__c5=combo;__run(2.1);0");
  ck('combo: kills close together count up, and it ends after 2 s',await T("__c5===5&&combo===0&&bestCombo===5"));
  await T("__stage(2);drone.pulseCooldown=8;for(let i=0;i<15;i++){const e=__put(0,'runner',300);damageEnemy(e,1e6,0,0,'drone');}0");ck('combo: every 15 the overload recharges 2 s',await T("Math.abs(drone.pulseCooldown-6)<.01"),await T("drone.pulseCooldown"));
  await T("__stage(2);for(let i=0;i<4;i++){const e=__put(0,'runner',300);damageEnemy(e,1e6,0,0,'drone');}const e=__put(0,'runner',300);e.y=LEAK_Y-1;update(1/60);0");ck('combo: a breach breaks it',await T("combo===0"));
  await T("__stage(2);const s0=score;for(let i=0;i<3;i++){const e=__put(0,'grunt',300);damageEnemy(e,1e6,0,0,'pulse');}window.__s1=score-s0;__run(.4);window.__s2=score-s0;0");
  ck('multi-kill: three at once pay a bonus after the window',await T("__s2-__s1===90"),await T("[__s1,__s2]"));
  ck('stars: 3 without a breach, 2 with both facilities standing, 1 otherwise',await T("reset();newStage(1);stageHurt=false;const a=chapterStars();stageHurt=true;const b2=chapterStars();facilities[0]=0;const c=chapterStars();a===3&&b2===2&&c===1"));
  ck('upgrade: the counter shows fifteen picks',await T("reset();newStage(1);upgradeScreen();$('overlay').textContent.includes('강화 1 / 15')"),await T("($('overlay').textContent.match(/강화 \\d+ \\/ \\d+/)||[''])[0]"));
  ck('upgrade: the cap rule holds',await T("reset();newStage(2);for(const k in upgradeRanks)upgradeRanks[k]=4;upgradeScreen();rankCap()===8&&offeredUpgrades.length===3"));
  ck('result: score and best are kept',await T("reset();newStage(TOTAL_OPS);best=0;score=1234;finish(true);best>=1234&&+localStorage.getItem('relayBest')>=1234&&!!$('scoreNum')"));
  // a lesson on the first visit of every rule map
  for(const [id,name] of [['pylon','고압선'],['gate','관문'],['bridge','다리'],['tunnel','터널'],['cross','샛길'],['hangar','격납고'],['flood','침수로'],['flee','도주로'],['boost','가속로'],['barrier','역장'],['storm','모래폭풍'],['grid','변전소'],['mortar','포격장']]){
   const t=await T(`releaseHold&&holdState&&releaseHold();learned.maps={};reset();liveRun=true;newStage(__cid('${id}'));pattern=[[1e9,0,'runner']];nextSpawn=0;let i=0;while(!holdState&&i++<400){lessonTick(1/30);update(1/30);}holdState?$('coachTitle').textContent:''`);
   ck('lesson on the first visit: '+name,t==='새 지형 · '+name,t);await T("releaseHold();0");}
  ck('no errors (2D)',!errs.length,errs.slice(0,2));await p.close();}
 // ---- 2.5D: every rule map is drawn without errors, in both layouts, with the new effects going off ----
 for(const [w,h] of [[844,390],[390,844]]){const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));const T=inGame(p);
  await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
  await T("mute=true;$('title').hidden=true;learned.item=true;learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=true;0");
  for(let k=1;k<=16;k++){await T(`reset();newStage(${k});shellT=1;for(let i=0;i<60*9;i++)update(1/60);drone.pulseCooldown=0;pulse();applyItem('chain');bag=['orbital'];aim=0;useAim(drone.lane,DRONE_Y-40);for(let i=0;i<4;i++){const e=enemies.find(q=>q.hp>0);if(e)damageEnemy(e,1e6,0,0,'pulse');}0`);await p.waitForTimeout(450);}
  ck(w+'x'+h+' 2.5D draws all sixteen maps and the new effects without errors and stays in 2.5D',!errs.filter(e=>!/intro\.mp3/.test(e)).length&&await T("G3.active===true"),errs.slice(0,2));
  ck(w+'x'+h+' no scroll',await T("document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1"));
  await p.close();}
 await b.close();end();})();
