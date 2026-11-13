// 맵 규칙(고압선, 관문, 다리, 터널, 샛길, 지뢰밭, 침수로, 가속로, 화염로), 열두 장 구성, 강화 상한, 새 아이템(연쇄 번개, 궤도 포격),
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
   window.__run=sec=>{for(let i=0;i<Math.round(sec*60);i++)update(1/60);};0`);
  // structure
  ck('twelve chapters, each on its own map',await T("TOTAL_OPS===12&&new Set(MAP_OF.slice(1)).size===12"),await T("MAP_OF.slice(1).map(i=>MAPS[i].id).join()"));
  ck('maps per chapter',await T("MAP_OF.slice(1).map(i=>MAPS[i].id).join()")==='pylon,pinch,detour,wave,gate,bridge,tunnel,cross,mine,flood,boost,vent');
  ck('every chapter has a schedule, three waves, a hull scale and a name',await T("[1,2,3,4,5,6,7,8,9,10,11,12].every(k=>stages[k]&&stages[k].length>20&&WAVES[k]&&OP_HP[k]>0)"));
  ck('only chapter 12 has the last boss',await T("__stage(8);spawn(0,'boss');const a=!enemies[0].final;__stage(12);spawn(0,'boss');a&&enemies[0].final===true"));
  ck('the drill keeps the plain straight road',await T("MAPS[0].id==='straight'&&!MAPS[0].rule"));
  ck('every rule map has a stretch of about a fifth of the field',await T("MAPS.slice(1).every(m=>{let n=0,t=0;for(let l=0;l<2;l++)for(let y=LANE_TOP;y<LEAK_Y;y++){t++;if(m.zone(l,y))n++;}return n/t>.19&&n/t<.24;})"),await T("MAPS.slice(1).map(m=>{let n=0,t=0;for(let l=0;l<2;l++)for(let y=LANE_TOP;y<LEAK_Y;y++){t++;if(m.zone(l,y))n++;}return m.id+' '+Math.round(n/t*100)+'%';}).join(', ')"));
  // 고압선
  await T("__stage(1);window.__a=[__put(0,'brute',200,1000),__put(0,'brute',320,1000)];damageEnemy(__a[0],10,0,0,'drone');damageEnemy(__a[1],10,0,0,'drone');0");
  ck('pylon: machines under the lines take 1.2x damage, others not',await T("__a[0].hp===1000-12&&__a[1].hp===990"),await T("__a.map(e=>e.hp)"));
  // 관문
  await T("__stage(5);drone.lane=1;drone.x=LANES[1];window.__g=[__put(0,'grunt',150,1e6),__put(0,'runner',120,1e6),__put(1,'grunt',150,1e6)];__run(3);0");
  const g1=await J("JSON.stringify({shut:[gateShut(0),gateShut(1)],y:__g.map(e=>+e.y.toFixed(1))})");const GY=+await T('GATE.y');
  ck('gate: lane 0 shuts first, the first machine waits with its nose at the gate',g1.shut[0]&&!g1.shut[1]&&Math.abs(g1.y[0]-(GY-13))<.02,g1);
  ck('gate: the next one queues a body length behind',g1.y[1]<=g1.y[0]-(13+10+3)+.01,g1);
  ck('gate: the open lane flows',g1.y[2]>GY+50,g1);
  await T("__run(4);0");const g2=await J("JSON.stringify({shut:[gateShut(0),gateShut(1)],y:__g.map(e=>+e.y.toFixed(1))})");
  ck('gate: after 4 s lane 0 opens and lane 1 shuts two seconds later',!g2.shut[0]&&g2.shut[1]&&g2.y[0]>GY,g2);
  await T("const e=__put(1,'grunt',150,1e6);__g.push(e);__run(1.5);0");ck('gate: lane 1 now holds',await T("Math.abs(__g[3].y-(GATE.y-13))<.02"),await T("__g[3].y"));
  // 다리
  await T("__stage(6);drone.lane=0;drone.x=LANES[0];window.__b=[__put(0,'grunt',250),__put(0,'brute',270,5000),__put(0,'boss',280,5000),__put(0,'grunt',350,5000)];drone.pulseCooldown=0;pulse();0");
  const br=await J("JSON.stringify(__b.map(e=>Math.round(e.hp)))");
  ck('bridge: the overload knocks a small or medium machine off',br[0]<=0&&await T("__b[0].fell===true"),br);
  ck('bridge: brutes and bosses hold on and take the overload damage',br[1]===5000-75&&br[2]===5000-75,br);
  ck('bridge: off the bridge, ordinary damage',br[3]===5000-75,br);
  await T("const e=__put(0,'grunt',300,100);e.hp=21;damageEnemy(e,2,0,0,'drone');window.__bl=e;0");ck('bridge: a badly damaged machine on the bridge falls too',await T("__bl.hp<=0&&__bl.fell===true"));
  // 터널
  await T("__stage(7);drone.lane=0;drone.x=LANES[0];window.__u=[__put(0,'grunt',250,5000),__put(0,'grunt',320,5000)];0");
  ck('tunnel: a machine inside cannot be targeted',await T("pickTarget(0,DRONE_Y,999)===__u[1]&&pickTarget(0,250,5)===null"));
  await T("drone.pulseCooldown=0;pulse();0");ck('tunnel: the overload reaches inside',await T("__u[0].hp<5000&&__u[1].hp<5000"),await T("__u.map(e=>e.hp)"));
  await T("bag=['magnet'];aim=0;useAim(0,330);0");ck('tunnel: the magnet does not pull it out',await T("!(__u[0].pullT>0)"));
  await T("__u[0].y=300;0");ck('tunnel: out of the exit it can be hit again',await T("pickTarget(0,DRONE_Y,999)!==null&&!map.cover(0,300)"));
  // 샛길
  await T("__stage(8);drone.lane=0;drone.x=LANES[0];window.__c=[__put(1,'grunt',CROSS[0]+3,1e6),__put(0,'grunt',CROSS[0]+3,1e6),__put(1,'brute',CROSS[0]+3,1e6),__put(1,'boss',CROSS[0]+3,1e6)];__run(.3);0");
  const c1=await J("JSON.stringify(__c.map(e=>[e.lane,e.from===undefined?-1:e.from,+(e.crossT||0).toFixed(2)]))");
  ck('crossover: a machine on the other lane comes over to the drone',c1[0][0]===0&&c1[0][1]===1&&c1[0][2]>0,c1);
  ck('crossover: a machine on the drone lane stays',c1[1][0]===0&&c1[1][1]===-1,c1);
  ck('crossover: brutes and bosses keep their lane',c1[2][0]===1&&c1[3][0]===1,c1);
  await T("drone.lane=1;drone.x=LANES[1];const e=__put(0,'runner',CROSS[0]+20,1e6);__c.push(e);__run(.2);0");ck('crossover: it follows where the drone is, anywhere in the stretch',await T("__c[4].lane===1"));
  ck('crossover: a machine crosses only once',await T("__c[0].lane===0"));
  // 지뢰밭
  await T("__stage(9);drone.lane=1;drone.x=LANES[1];window.__m=[__put(0,'brute',MINE.a+15,5000),__put(0,'brute',(MINE.a+MINE.b)/2-5,5000)];__run(.5);0");
  const mi=await J("JSON.stringify({hp:__m.map(e=>e.hp),arm:mines.map(m=>m.lane+':'+Math.round(m.arm))})");
  ck('mines: stepping on one sets off the chain on that lane',mi.arm.filter(a=>a.startsWith('0:')&&!a.endsWith(':0')).length===3&&mi.arm.filter(a=>a.startsWith('1:')&&a.endsWith(':0')).length===3,mi);
  ck('mines: the machines near a blast take its damage',mi.hp[0]<=5000-35&&mi.hp[1]<=5000-35,mi);
  // 침수로
  await T("__stage(10);drone.lane=0;drone.x=LANES[0];window.__w=[__put(1,'brute',300,5000),__put(1,'brute',420,5000)];drone.pulseCooldown=0;pulse();0");
  ck('flood: the overload shocks machines in the water on the other lane, not outside it',await T("__w[0].hp===5000-Math.round(75*MAPK.flood.k*100)/100&&__w[1].hp===5000"),await T("__w.map(e=>e.hp)"));
  await T("__stage(10);drone.lane=0;drone.x=LANES[0];window.__w2=[__put(0,'brute',300,5000),__put(0,'brute',310,5000)];drone.shotCooldown=0;update(1/60);0");
  ck('flood: a drone round spreads to a machine close by in the water',await T("__w2[0].hp<5000&&__w2[1].hp<5000"),await T("__w2.map(e=>+e.hp.toFixed(1))"));
  // 가속로
  await T("__stage(11);drone.lane=0;drone.x=LANES[0];window.__f=[__put(0,'brute',200,1e6),__put(1,'brute',200,1e6)];__run(.5);0");
  ck('boost: machines on the rails of the workshop lane are 15% faster',await T("Math.abs((__f[1].y-200)/(__f[0].y-200)-MAPK.boost.k)<.02"),await T("__f.map(e=>+e.y.toFixed(2))"));
  // 화염로
  await T("__stage(12);drone.lane=1;drone.x=LANES[1];window.__v=__put(0,'brute',250,1e6);__v.speed=0;__run(3.6);window.__vp=ventPhase();0");
  ck('vents: they glow a second before they fire',await T("__vp===1&&__v.hp===1e6"));
  await T("__run(2.5);0");ck('vents: a burst burns machines in the stretch (10 per second for 1.5 s)',await T("Math.abs((1e6-__v.hp)-15)<.01"),await T("1e6-__v.hp"));
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
  ck('upgrade: the counter shows eleven picks',await T("reset();newStage(1);upgradeScreen();$('overlay').textContent.includes('강화 1 / 11')"),await T("($('overlay').textContent.match(/강화 \\d+ \\/ \\d+/)||[''])[0]"));
  ck('upgrade: the cap rule holds',await T("reset();newStage(2);for(const k in upgradeRanks)upgradeRanks[k]=4;upgradeScreen();rankCap()===8&&offeredUpgrades.length===3"));
  ck('result: score and best are kept',await T("reset();newStage(TOTAL_OPS);best=0;score=1234;finish(true);best>=1234&&+localStorage.getItem('relayBest')>=1234&&!!$('scoreNum')"));
  // a lesson on the first visit of every rule map
  for(const [k,name] of [[1,'고압선'],[5,'관문'],[6,'다리'],[7,'터널'],[8,'샛길'],[9,'지뢰밭'],[10,'침수로'],[11,'가속로'],[12,'화염로']]){
   const t=await T(`releaseHold&&holdState&&releaseHold();learned.maps={};reset();liveRun=true;newStage(${k});pattern=[[1e9,0,'runner']];nextSpawn=0;let i=0;while(!holdState&&i++<400){lessonTick(1/30);update(1/30);}holdState?$('coachTitle').textContent:''`);
   ck('lesson on the first visit: '+name,t==='새 지형 · '+name,t);await T("releaseHold();0");}
  ck('no errors (2D)',!errs.length,errs.slice(0,2));await p.close();}
 // ---- 2.5D: every rule map is drawn without errors, in both layouts, with the new effects going off ----
 for(const [w,h] of [[844,390],[390,844]]){const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));const T=inGame(p);
  await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
  await T("mute=true;$('title').hidden=true;learned.item=true;learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=true;0");
  for(const k of [1,2,3,4,5,6,7,8,9,10,11,12]){await T(`reset();newStage(${k});for(let i=0;i<60*9;i++)update(1/60);drone.pulseCooldown=0;pulse();applyItem('chain');bag=['orbital'];aim=0;useAim(drone.lane,DRONE_Y-40);for(let i=0;i<4;i++){const e=enemies.find(q=>q.hp>0);if(e)damageEnemy(e,1e6,0,0,'pulse');}0`);await p.waitForTimeout(450);}
  ck(w+'x'+h+' 2.5D draws all twelve maps and the new effects without errors and stays in 2.5D',!errs.filter(e=>!/intro\.mp3/.test(e)).length&&await T("G3.active===true"),errs.slice(0,2));
  ck(w+'x'+h+' no scroll',await T("document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1"));
  await p.close();}
 await b.close();end();})();
