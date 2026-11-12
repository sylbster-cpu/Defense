// 새 맵 넷(관문, 다리, 터널, 샛길)의 규칙, 여덟 장 구성, 강화 상한, 새 지형 안내, 2.5D에서 오류 없이 그려지는지 확인.
// node tools/newmap_test.js <게임 폴더 절대 경로>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]);
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');const f=path.join(dir,'_nm_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();let bad=0;const ck=(n,ok,x)=>{console.log((ok?'ok  ':'BAD ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)bad++;};
 // ---- rules, on the 2D page with the clock in the test's hands ----
 {const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));const T=x=>p.evaluate(x=>window.__t(x),x);
  await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  await T(`mute=true;$('title').hidden=true;learned.item=true;learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=true;
   window.__stage=k=>{reset();newStage(k);enemies=[];pattern=[[1e9,0,'runner']];nextSpawn=0;turrets=[];};
   window.__put=(l,t,y,hp)=>{spawn(l,t);const e=enemies[enemies.length-1];e.y=y;if(hp){e.hp=e.maxHp=hp;}return e;};
   window.__run=sec=>{for(let i=0;i<Math.round(sec*60);i++)update(1/60);};0`);
  // structure
  ck('eight chapters, each on its own map',await T("TOTAL_OPS===8&&new Set(MAP_OF.slice(1)).size===8"),await T("MAP_OF.slice(1).map(i=>MAPS[i].id).join()"));
  ck('chapter 5..8 maps',await T("[5,6,7,8].map(i=>MAPS[MAP_OF[i]].id).join()")==='gate,bridge,tunnel,cross');
  ck('every chapter has a schedule, three waves and a hull scale',await T("[1,2,3,4,5,6,7,8].every(k=>stages[k]&&stages[k].length>20&&WAVES[k]&&OP_HP[k]>0)"));
  ck('only chapter 8 has the last boss; chapter 5 now has a mid boss',await T("__stage(5);spawn(0,'boss');const a=!enemies[0].final;__stage(8);spawn(0,'boss');a&&enemies[0].final===true"));
  ck('hull rises after chapter 5',await T("OP_HP[5]<OP_HP[6]&&OP_HP[6]<OP_HP[7]&&OP_HP[7]<OP_HP[8]"),await T("OP_HP.join()"));
  // gate
  await T("__stage(5);drone.lane=1;drone.x=LANES[1];window.__g=[__put(0,'grunt',150,1e6),__put(0,'runner',120,1e6),__put(1,'grunt',150,1e6)];__run(3);0");
  const g1=JSON.parse(await T("JSON.stringify({t:+stageTime.toFixed(2),shut:[gateShut(0),gateShut(1)],y:__g.map(e=>+e.y.toFixed(1))})"));
  ck('gate: lane 0 shut first, the first machine waits with its nose at the gate',g1.shut[0]&&!g1.shut[1]&&Math.abs(g1.y[0]-(180-13))<.02,g1);
  ck('gate: the next one queues a body length behind',g1.y[1]<=g1.y[0]-(13+10+3)+.01&&g1.y[1]>140,g1);
  ck('gate: the open lane flows',g1.y[2]>180+50,g1);
  await T("__run(2.6);0");const g2=JSON.parse(await T("JSON.stringify({t:+stageTime.toFixed(2),shut:[gateShut(0),gateShut(1)],y:__g.map(e=>+e.y.toFixed(1))})"));
  ck('gate: after 5 s they swap and the queue moves on',!g2.shut[0]&&g2.shut[1]&&g2.y[0]>185&&g2.y[1]>170,g2);
  await T("const e=__put(1,'grunt',150,1e6);__g.push(e);__run(1.5);0");ck('gate: lane 1 now holds',await T("Math.abs(__g[3].y-(180-13))<.02"),await T("__g[3].y"));
  // bridge
  await T("__stage(6);drone.lane=0;drone.x=LANES[0];window.__b=[__put(0,'grunt',250),__put(0,'brute',270,5000),__put(0,'boss',280,5000),__put(0,'grunt',320,5000)];drone.pulseCooldown=0;pulse();0");
  const br=JSON.parse(await T("JSON.stringify(__b.map(e=>Math.round(e.hp)))"));
  ck('bridge: the overload knocks ordinary machines off (whatever their hull)',br[0]<=0&&br[1]<=0,br);
  ck('bridge: the boss only takes the overload damage',br[2]===5000-75,br);
  ck('bridge: off the bridge, ordinary damage',br[3]===5000-75,br);
  ck('bridge: a fall is announced to the renderer and marked',await T("__b[0].fell===true&&__b[1].fell===true&&!__b[3].fell"));
  // tunnel
  await T("__stage(7);drone.lane=0;drone.x=LANES[0];window.__u=[__put(0,'grunt',190,5000),__put(0,'grunt',260,5000)];0");
  ck('tunnel: a machine inside cannot be targeted',await T("pickTarget(0,DRONE_Y,999)===__u[1]&&pickTarget(0,190,5)===null"));
  await T("effects.pulseRange=200;drone.pulseCooldown=0;pulse();0");ck('tunnel: the overload does not reach inside',await T("__u[0].hp===5000&&__u[1].hp<5000"),await T("__u.map(e=>e.hp)"));
  await T("bag=['magnet'];aim=0;useMagnet(0,300);0");ck('tunnel: the magnet does not pull it out',await T("!(__u[0].pullT>0)"));
  await T("__u[0].y=225;0");ck('tunnel: out of the exit it can be hit again',await T("pickTarget(0,DRONE_Y,999)!==null&&!map.cover(0,225)"));
  // crossover
  await T("__stage(8);drone.lane=0;drone.x=LANES[0];window.__c=[__put(0,'grunt',CROSS_Y-3,1e6),__put(1,'grunt',CROSS_Y-3,1e6),__put(0,'boss',CROSS_Y-1,1e6)];__run(.3);0");
  const c1=JSON.parse(await T("JSON.stringify(__c.map(e=>[e.lane,e.from===undefined?-1:e.from,+(e.crossT||0).toFixed(2)]))"));
  ck('crossover: a machine on the lane of the drone crosses to the other lane',c1[0][0]===1&&c1[0][1]===0&&c1[0][2]>0,c1);
  ck('crossover: a machine on the other lane keeps it',c1[1][0]===1&&c1[1][1]===-1,c1);
  ck('crossover: the boss keeps its lane',c1[2][0]===0,c1);
  await T("drone.lane=1;drone.x=LANES[1];const e=__put(1,'runner',CROSS_Y-2,1e6);__c.push(e);__run(.2);0");ck('crossover: it follows where the drone is',await T("__c[3].lane===0"));
  ck('crossover: once past, a machine never crosses again',await T("const l=__c[0].lane;__run(1);__c[0].lane===l"));
  // the last boss slides across when it changes lanes
  await T("__stage(8);const e=__put(0,'boss',300);damageEnemy(e,e.maxHp*.34+1,0,0,'drone');window.__fb=e;0");ck('last boss: lane change carries a slide for the renderer',await T("__fb.lane===1&&__fb.from===0&&__fb.crossT>0"));
  // upgrades
  await T("reset();newStage(2);upgradeRanks.stable=4;upgradeScreen();0");
  ck('upgrade: a card at the top rank is not offered, three cards still are',await T("offeredUpgrades.length===3&&!offeredUpgrades.includes('stable')&&offeredUpgrades.includes('precision')"),await T("offeredUpgrades.join()"));
  ck('upgrade: choosing a full card does nothing',await T("const n=upgradeRanks.stable;phase='upgrade';offeredUpgrades.push('stable');choose('stable');upgradeRanks.stable===n"));
  ck('upgrade: the counter shows seven picks',await T("reset();newStage(1);upgradeScreen();$('overlay').textContent.includes('강화 1 / 07')"),await T("($('overlay').textContent.match(/강화 \\d+ \\/ \\d+/)||[''])[0]"));
  for(const k of [1,2,3,4]){const want=await T(`reset();newStage(${k});const fo=['stable','precision'],alt=['stable','emergency','precision','rubble'].filter(id=>!fo.includes(id));[...fo,alt[(op-1)%alt.length]].join()`);   // the rule before the cap
  ck('upgrade: as before while no card is full (chapter '+k+')',await T("upgradeScreen();offeredUpgrades.join()")===want,want);}
  // a lesson on the first visit of every new map
  for(const [k,name] of [[5,'관문'],[6,'다리'],[7,'터널'],[8,'샛길']]){
   const t=await T(`releaseHold&&holdState&&releaseHold();learned.maps={};reset();liveRun=true;newStage(${k});pattern=[[1e9,0,'runner']];nextSpawn=0;let i=0;while(!holdState&&i++<400){lessonTick(1/30);update(1/30);}holdState?$('coachTitle').textContent:''`);
   ck('lesson on the first visit: '+name,t==='새 지형 · '+name,t);await T("releaseHold();0");}
  ck('no errors (2D)',!errs.length,errs.slice(0,2));await p.close();}
 // ---- 2.5D: every new map is drawn without errors, in both layouts ----
 for(const [w,h] of [[844,390],[390,844]]){const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));const T=x=>p.evaluate(x=>window.__t(x),x);
  await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
  await T("mute=true;$('title').hidden=true;learned.item=true;learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=true;0");
  for(const k of [5,6,7,8]){await T(`reset();newStage(${k});for(let i=0;i<60*9;i++)update(1/60);if(${k}===6){const e=enemies.find(e=>e.type!=='boss');if(e){e.y=250;e.lane=drone.lane;}drone.pulseCooldown=0;pulse();}0`);await p.waitForTimeout(700);}
  ck(w+'x'+h+' 2.5D draws the four new maps without errors and stays in 2.5D',!errs.filter(e=>!/intro\.mp3/.test(e)).length&&await T("G3.active===true"),errs.slice(0,2));
  ck(w+'x'+h+' no scroll',await T("document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1"));
  await p.close();}
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
