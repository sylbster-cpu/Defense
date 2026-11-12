// 아이템 확인: 전장에 떨어짐, 5초, 터치로 줍기, 두 칸 보관, 열 가지 효과, 자석의 위치 지정, 현장 포탑 확률, 장 끝 보상, 줍기 안내, 최종 보스.
// node tools/item_test.js <게임 폴더 절대 경로>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]);
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');const f=path.join(dir,'_it_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();let bad=0;const ck=(n,ok,x)=>{console.log((ok?'ok  ':'BAD ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)bad++;};
 for(const [w,h,mode] of [[844,390,''],[390,844,''],[844,390,'2d'],[390,844,'2d']]){
  const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const T=x=>p.evaluate(x=>window.__t(x),x),tag=w+'x'+h+(mode?' 2D':'');
  await p.goto('file://'+f+(mode?'?2d=1':'?q=0'));if(!mode)await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});else await p.waitForTimeout(600);
  // helpers inside the game: a fixed drop, where a drop is on the screen, a held clock
  await T(`$('title').hidden=true;$('titleVid').pause();mute=true;learned.item=learned.pulse=true;learned.maps={pinch:1,detour:1,wave:1};beginRun();pattern=[[1e9,0,'runner']];nextSpawn=0;turrets=[];paused=true;
   window.__drop=(item,lane,y)=>{const d={id:Math.random(),item,lane,y,life:DROP_LIFE};drops.push(d);return d;};
   window.__at=(d,h=2.4)=>{const r=canvas.getBoundingClientRect();if(G3.active)return G3.renderer.screenOf(d.lane,d.y,h);if(compactCanvas)return{x:r.left+cmp.x0+(d.y-LANE_TOP)/LANE_LEN*cmp.run,y:r.top+cmp.ys[d.lane]};return{x:r.left+LANES[d.lane]/W*r.width,y:r.top+d.y/H*r.height};};
   window.__run=(sec)=>{for(let i=0;i<Math.round(sec*60);i++)update(1/60);};0`);
  await p.waitForTimeout(300);
  const tapDrop=async i=>{const q=await T(`JSON.stringify(__at(drops[${i}]))`).then(JSON.parse);await p.touchscreen.tap(q.x,q.y);await p.waitForTimeout(120);};
  ck(tag+' two empty slots, both off',await p.isDisabled('#itemBtn')&&await p.isDisabled('#itemBtn2')&&await T("bag.length===0&&$('itemBtn').innerHTML===''"));
  // a rare machine falls: its item lies on the field, nothing is in the bag yet
  await T("const r0=Math.random;Math.random=()=>0;spawn(1,'runner');const e=enemies[enemies.length-1];e.rare=true;e.y=300;damageEnemy(e,1e6,0,0,'turret');Math.random=r0;enemies=[];0");
  ck('a rare machine leaves its item on the field',await T("drops.length===1&&drops[0].item==='wall'&&drops[0].lane===1&&Math.abs(drops[0].y-300)<1&&bag.length===0"),await T('JSON.stringify(drops.map(d=>[d.item,d.lane,Math.round(d.y)]))'));
  await T("paused=false;0");await tapDrop(0);
  ck('touching it takes it; the drone does not move',await T("bag.join()==='wall'&&drops.length===0&&drone.lane===0"),await T("JSON.stringify({bag,lane:drone.lane})"));
  ck('the first slot shows its icon',await T("$('itemBtn').classList.contains('has')&&!!$('itemBtn').querySelector('svg path')&&$('itemBtn2').innerHTML===''"));
  // a touch that is not on a drop still moves the drone
  await T("const d=__drop('jam',1,200);window.__far=JSON.stringify(__at({lane:1,y:440}));0");const far=JSON.parse(await T('window.__far'));await p.touchscreen.tap(far.x,far.y);await p.waitForTimeout(150);
  ck('a touch away from the drop moves the drone as before',await T("drone.lane===1&&drops.length===1"));
  // it stays five seconds
  await T("paused=true;drops[0].life=DROP_LIFE;__run(4.8);0");ck('still there after 4.8 s',await T("drops.length===1"));await T("__run(.4);0");ck('gone after 5 s, nothing gained',await T("drops.length===0&&bag.join()==='wall'"));
  // at double speed the game clock runs twice as fast, but the item still stays five seconds of the player's time
  await T("speed=2;__drop('jam',0,300);for(let i=0;i<Math.round(4.8*30);i++)update(2/30);0");ck('double speed: still there after 4.8 s of real time',await T("drops.length===1"),await T("drops[0]&&+drops[0].life.toFixed(2)"));await T("for(let i=0;i<Math.round(.4*30);i++)update(2/30);0");ck('double speed: gone after 5 s of real time',await T("drops.length===0"));await T("speed=1;0");
  // two are kept; a third cannot be taken
  await T("__drop('jam',0,260);__drop('clone',0,360);paused=false;drone.lane=1;drone.x=LANES[1];drone.moveCooldown=0;0");await tapDrop(0);
  ck('a second item is kept',await T("bag.join()==='wall,jam'&&drops.length===1"));await tapDrop(0);
  ck('a third is refused and stays on the field',await T("bag.length===2&&drops.length===1&&drops[0].item==='clone'"),await T("$('toast').textContent"));
  // using a slot
  await T("drops=[];enemies=[];for(let i=0;i<3;i++){spawn(0,'grunt');enemies[i].y=200+i*20;enemies[i].hp=enemies[i].maxHp=1e5;}drone.lane=1;drone.x=LANES[1];0");
  await p.click('#itemBtn2');await p.waitForTimeout(120);ck('the second slot is used, the first is kept',await T("aid.jam>4&&bag.join()==='wall'"));
  await p.click('#itemBtn');await p.waitForTimeout(120);ck('wall stops the other lane',await T("aid.wall>3&&aid.wallLane===0&&bag.length===0"));
  // every effect, by the clock
  await T("paused=true;aid.wall=aid.jam=0;facilities=[40,90];applyItem('repair');0");ck('repair +30 on the weaker facility',await T("facilities[0]===70&&facilities[1]===90"));
  await T("drone.moveCooldown=2;drone.pulseCooldown=9;applyItem('charge');0");ck('overcharge clears both waits',await T("drone.moveCooldown===0&&drone.pulseCooldown===0"));
  await T("applyItem('turret');__run(1.2);0");ck('temporary turret shoots the other lane',await T("aid.turret>6&&enemies.some(e=>e.lane===0&&e.hp<e.maxHp)"));
  await T("aid.turret=0;for(const e of enemies){e.hp=e.maxHp;e.y=DRONE_Y-60;}applyItem('clone');__run(1);0");ck('second drone shoots the other lane',await T("aid.clone>4&&enemies.some(e=>e.hp<e.maxHp)"));
  // stimpack: faster shots, half the wait to move
  await T("aid.clone=0;enemies=[];spawn(1,'brute');enemies[0].y=DRONE_Y-40;enemies[0].speed=0;enemies[0].hp=enemies[0].maxHp=1e6;drone.lane=1;drone.x=LANES[1];drone.shotCooldown=0;drone.burst=0;const k0=()=>{const h0=enemies[0].hp;__run(3);return Math.round((h0-enemies[0].hp)/BAL.droneDmg);};window.__a=k0();applyItem('stim');window.__b=k0();0");
  const sa=await T('window.__a'),sb=await T('window.__b');ck('stimpack: about 1.5 times the shots in the same time',sb/sa>1.4&&sb/sa<1.6,{before:sa,with:sb});
  await T("drone.moveCooldown=0;paused=false;switchLane(0);paused=true;window.__mc=drone.moveCooldown;0");ck('stimpack: half the wait after moving',Math.abs((await T('window.__mc'))-(await T('effects.moveBase'))*.5)<.01,await T('window.__mc'));
  // pierce: the round goes on through two more machines
  await T("aid.stim=0;enemies=[];for(let i=0;i<4;i++){spawn(0,'brute');enemies[i].y=DRONE_Y-20-i*30;enemies[i].hp=enemies[i].maxHp=1000;}drone.lane=0;drone.x=LANES[0];drone.shotCooldown=0;drone.burst=0;applyItem('pierce');update(1/60);0");
  ck('pierce: the target and the two behind it are hit, the fourth is not',await T("enemies.map(e=>Math.round((1000-e.hp)*10)/10).join()")==='19,13.3,13.3,0',await T("enemies.map(e=>Math.round((1000-e.hp)*10)/10).join()"));
  // splash: machines close to the target are hit as well
  await T("aid.pierce=0;enemies=[];for(const y of [DRONE_Y-20,DRONE_Y-50,DRONE_Y-90]){spawn(0,'brute');const e=enemies[enemies.length-1];e.y=y;e.hp=e.maxHp=1000;}spawn(1,'brute');enemies[3].y=DRONE_Y-20;enemies[3].hp=enemies[3].maxHp=1000;drone.shotCooldown=0;applyItem('splash');update(1/60);0");
  ck('splash: within 45 of the target yes, farther and the other lane no',await T("enemies.map(e=>Math.round((1000-e.hp)*10)/10).join()")==='19,9.5,0,0',await T("enemies.map(e=>Math.round((1000-e.hp)*10)/10).join()"));
  // magnet: the slot arms it, a touch on the field names the place (the touch below is on the road itself, height 0)
  await T("aid.splash=0;enemies=[];for(const y of [150,220,300,420]){spawn(0,'grunt');const e=enemies[enemies.length-1];e.y=y;e.hp=e.maxHp=1e5;}spawn(0,'boss');enemies[4].y=260;spawn(1,'grunt');enemies[5].y=240;for(const e of enemies){e.speed=0;e.hp=e.maxHp=1e6;}bag=['magnet'];drone.lane=1;drone.x=LANES[1];turrets=[];paused=false;updateControls();0");
  await p.click('#itemBtn');await p.waitForTimeout(100);ck('magnet: pressing the slot arms it and keeps it',await T("aim===0&&bag.join()==='magnet'&&$('itemBtn').classList.contains('aiming')"));
  await p.click('#itemBtn');await p.waitForTimeout(100);ck('magnet: pressing again puts it back',await T("aim===-1&&bag.join()==='magnet'"));
  await p.click('#itemBtn');await p.waitForTimeout(100);const spot=JSON.parse(await T("JSON.stringify(__at({lane:0,y:250},0))"));await p.touchscreen.tap(spot.x,spot.y);await p.waitForTimeout(1300);
  const mg=await T("JSON.stringify({ys:enemies.map(e=>Math.round(e.y)),bag,aim,lane:drone.lane,mag:[aid.magLane,Math.round(aid.magY)]})").then(JSON.parse);
  ck('magnet: machines of that lane within 150 are dragged to the place; the boss, the far one and the other lane stay',Math.abs(mg.mag[1]-250)<16&&mg.mag[0]===0&&[0,1,2].every(i=>Math.abs(mg.ys[i]-mg.mag[1])<3)&&mg.ys[3]===420&&mg.ys[4]===260&&mg.ys[5]===240&&mg.bag.length===0&&mg.aim===-1&&mg.lane===1,mg);
  // what falls: every item and the field turret alike
  const dist=JSON.parse(await T("paused=true;const n={};for(let i=0;i<22000;i++){drops=[];fieldTurrets=[];dropItem({lane:0,y:300});const k=drops.length?drops[0].item:'field';n[k]=(n[k]||0)+1;}drops=[];fieldTurrets=[];JSON.stringify(n)"));
  const keys=Object.keys(dist);ck('eleven outcomes, each about one in eleven',keys.length===11&&keys.every(k=>Math.abs(dist[k]/2000-1)<.12),dist);
  ck('every item has an icon and a colour',await T("Object.keys(ITEMS).length===10&&Object.keys(ITEMS).every(k=>ICON[k]&&ITEMS[k].col&&ITEMS[k].desc)"));
  // a mid boss drops too; the last boss does not
  await T("enemies=[];op=3;spawn(0,'boss');let e=enemies[0];e.y=300;const n0=drops.length+fieldTurrets.length;damageEnemy(e,1e6,0,0,'turret');window.__mb=drops.length+fieldTurrets.length-n0;drops=[];fieldTurrets=[];enemies=[];op=TOTAL_OPS;spawn(0,'boss');e=enemies[0];e.y=300;e.hops=0;damageEnemy(e,1e7,0,0,'turret');window.__fb=drops.length+fieldTurrets.length;0");
  ck('a mid boss leaves something, the last boss nothing',(await T('window.__mb'))===1&&(await T('window.__fb'))===0);
  // a chapter without a breach pays into the bag
  await T("reset();newStage(1);paused=true;while(phase==='battle'){update(1/30);drops=[];fieldTurrets=[];for(const e of enemies)damageEnemy(e,1e6,0,0,'drone');}0");
  ck('a clean chapter puts one item straight into the bag',await T("phase==='upgrade'&&bag.length===1&&stageGift===bag[0]&&$('overlayContent').textContent.includes('아이템 획득: '+ITEMS[bag[0]].name)"),await T('JSON.stringify({bag,stageGift})'));
  await T("choose(offeredUpgrades[0]);bag=['wall','jam'];paused=true;while(phase==='battle'){update(1/30);drops=[];fieldTurrets=[];for(const e of enemies)damageEnemy(e,1e6,0,0,'drone');}0");
  ck('with a full bag the reward is lost and the screen says so',await T("stageGift==='full'&&bag.length===2&&$('overlayContent').textContent.includes('보관 칸이 가득 차')"));
  // the lesson: the first drop is picked up by hand
  await T("choose(offeredUpgrades[0]);learned.item=false;bag=[];liveRun=true;pattern=[[1e9,0,'runner']];nextSpawn=0;enemies=[];paused=false;lessonQuiet=99;stageTime=3;__drop('charge',0,300);0");
  await p.waitForFunction(()=>window.__relay.hold==='pick',null,{timeout:8000});await p.waitForTimeout(500);
  const life0=await T('drops[0].life');await p.waitForTimeout(600);ck('lesson: the game holds and the drop does not run out meanwhile',(await T('drops[0].life'))===life0&&(await T("$('coachTitle').textContent"))==='아이템이 떨어졌습니다');
  await tapDrop(0);await p.waitForFunction(()=>window.__relay.hold==='tap',null,{timeout:5000});
  ck('lesson: taking it leads to the note on keeping and using',await T("bag.join()==='charge'&&$('coachTitle').textContent.startsWith('아이템 획득')&&$('coachMain').textContent.includes('두 개까지')"),await T("$('coachMain').textContent"));
  await T("releaseHold();0");ck('lesson done once',await T("learned.item===true&&!holdState"));
  // final boss still changes lanes
  await T("paused=true;enemies=[];op=TOTAL_OPS;spawn(0,'boss');0");const fb=await T('JSON.stringify({final:enemies[0].final,hops:enemies[0].hops})');await T('const e=enemies[0];damageEnemy(e,e.maxHp*.4,0,0,"drone");');const l1=await T('enemies[0].lane');await T('const e=enemies[0];damageEnemy(e,e.maxHp*.3,0,0,"drone");');const l2=await T('enemies[0].lane');
  ck('final boss changes lanes at 2/3 and 1/3 hull',l1===1&&l2===0,{fb,l1,l2});
  const sc=await p.evaluate(()=>document.documentElement.scrollWidth+'x'+document.documentElement.scrollHeight);ck('no scroll',sc===w+'x'+h,sc);ck('no errors',!errs.length,errs.slice(0,3));await c.close();}
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
