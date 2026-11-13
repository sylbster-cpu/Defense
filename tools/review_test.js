// 점검 수정 회귀 시험(판 2026.11.12-6): 궤도 포격과 터널, 장 끝 다중 격파 정산, 침수로 감전 표시, 터널 안 격파 그림, 강화 화면 톱니바퀴와 꼬리표.
// node tools/review_test.js <게임 폴더 절대 경로>
const { chromium } = require('playwright');const {hooked,inGame,checks}=require('./lib.js');const path=require('path');
const dir=path.resolve(process.argv[2]);
const f=hooked(dir,'rv');
(async()=>{const b=await chromium.launch();const {ck,end}=checks();
 // rules (2D page)
 {const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);
  const T=inGame(p);
  await T("$('title').hidden=true;mute=true;learned.item=learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=true;0");
  // 1. orbital strike on the tunnel map: the machine inside the tunnel keeps its health, the one outside is hit
  const r1=JSON.parse(await T(`(()=>{reset();liveRun=true;const ch=MAP_OF.findIndex(i=>MAPS[i].id==='tunnel');newStage(ch);phase='battle';pattern=[];nextSpawn=0;enemies=[];
   const mk=(y)=>{const e={id:Math.random(),type:'grunt',lane:0,x:LANES[0],y,py:y,hp:300,maxHp:300,speed:0,slow:0,stun:0,flash:0,wiggle:0};enemies.push(e);return e;};
   const a=mk(TUNNEL[0]+20),o=mk(TUNNEL[0]-30);bag=['orbital'];aim=0;useAim(0,TUNNEL[0]);for(let i=0;i<40;i++)update(1/30);return JSON.stringify({inside:a.hp,outside:o.hp,cover:map.cover(0,a.y)});})()`));
  ck('orbital spares the machine inside the tunnel',r1.cover&&r1.inside===300&&r1.outside<300,JSON.stringify(r1));
  // 2. multi-kill that clears the chapter is paid
  const r2=JSON.parse(await T(`(()=>{reset();liveRun=true;newStage(2);phase='battle';nextSpawn=pattern.length;enemies=[];const evs=[];const e0=ev3;ev3=o=>{evs.push(o.t);e0(o);};
   for(let i=0;i<4;i++)enemies.push({id:Math.random(),type:'runner',lane:0,x:LANES[0],y:300+i*5,py:300,hp:1,maxHp:50,speed:0,slow:0,stun:0,flash:0,wiggle:0});
   const s0=score;for(const e of enemies)damageEnemy(e,99,0,0,'pulse');update(1/30);ev3=e0;return JSON.stringify({phase,gain:score-s0,multi:evs.includes('multi')});})()`));
  ck('multi-kill on the last machines is paid before the upgrade screen',r2.phase==='upgrade'&&r2.multi,JSON.stringify(r2));
  // 3. flood: an overload with nobody in the water sends no shock cue; with a machine in the water it does
  const r3=JSON.parse(await T(`(()=>{showOverlay(false);reset();liveRun=true;const ch=MAP_OF.findIndex(i=>MAPS[i].id==='flood');newStage(ch);phase='battle';pattern=[];nextSpawn=0;enemies=[];
   const evs=[];const e0=ev3;ev3=o=>{evs.push(o.t);e0(o);};const out=FLOOD[0]-40;drone.y=DRONE_Y;
   enemies.push({id:Math.random(),type:'brute',lane:drone.lane,x:LANES[drone.lane],y:drone.y-20,py:0,hp:900,maxHp:900,speed:0,slow:0,stun:0,flash:0,wiggle:0});
   drone.pulseCooldown=0;pulse();const dry=evs.filter(t=>t==='shock').length;
   enemies.push({id:Math.random(),type:'brute',lane:1-drone.lane,x:LANES[1-drone.lane],y:(FLOOD[0]+FLOOD[1])/2,py:0,hp:900,maxHp:900,speed:0,slow:0,stun:0,flash:0,wiggle:0});
   drone.pulseCooldown=0;pulse();const wet=evs.filter(t=>t==='shock').length-dry;ev3=e0;return JSON.stringify({dry,wet,inWater:inZ(drone.y-20,FLOOD)});})()`));
  ck('flood shock cue only when the water carried the overload',r3.dry===0&&r3.wet===1,JSON.stringify(r3));
  ck('no page errors (2D)',!errs.length,errs.slice(0,2).join(' | '));await p.close();}
 // renderer (2.5D page)
 {const c=await b.newContext({viewport:{width:844,height:390}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:8000});
  const T=inGame(p);
  await T(`$('title').hidden=true;mute=true;learned.item=learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=true;reset();liveRun=true;newStage(MAP_OF.findIndex(i=>MAPS[i].id==='tunnel'));phase='battle';pattern=[];nextSpawn=0;enemies=[];paused=true;
   window.__inst=()=>{let n=0;window.R3D.ctx.scene.traverse(o=>{if(o.isInstancedMesh&&o.visible)n+=o.count;});return n;};
   window.__hid={id:Math.random(),type:'brute',lane:0,x:LANES[0],y:(TUNNEL[0]+TUNNEL[1])/2,py:0,hp:900,maxHp:900,speed:0,slow:0,stun:0,flash:0,wiggle:0};0`);
  await p.waitForTimeout(400);const n0=await T('__inst()');
  await T('enemies.push(__hid);0');await p.waitForTimeout(400);const n1=await T('__inst()');
  await T("damageEnemy(__hid,5000,0,0,'pulse');paused=false;update(1/60);paused=true;0");await p.waitForTimeout(150);const n2=await T('__inst()');
  ck('a machine hidden in the tunnel adds nothing to the scene',n1===n0,n0+' -> '+n1);
  ck('its collapse when killed there is not drawn',n2<=n0,n0+' -> '+n2);
  ck('no page errors (2.5D)',!errs.length,errs.slice(0,2).join(' | '));await c.close();}
 // the settings gear never covers a card tag of the upgrade screen (568x320 landscape, after the web fonts arrive)
 for(const [w,h] of [[568,320],[667,375],[844,390],[390,844]]){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();await p.goto('file://'+f+'?q=1');await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__t(`$('title').hidden=true;mute=true;learned.item=learned.pulse=true;reset();newStage(3);upgradeScreen();0`));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(900);
  const r=JSON.parse(await p.evaluate(()=>window.__t(`(()=>{const g=$('gearBtn').getBoundingClientRect();let hit=0;for(const t of document.querySelectorAll('.choice .ctag')){const r=t.getBoundingClientRect();if(g.bottom>r.top&&g.top<r.bottom&&g.left<r.right&&g.right>r.left)hit++;}return JSON.stringify({hit,scroll:document.documentElement.scrollHeight>innerHeight+1});})()`)));
  ck('gear clear of the card tags '+w+'x'+h,!r.hit&&!r.scroll,JSON.stringify(r));await c.close();}
 await b.close();end();})();
