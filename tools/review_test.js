// 점검 수정 회귀 시험(판 2026.11.12-6): 궤도 포격과 터널, 장 끝 다중 격파 정산, 침수로 감전 표시, 터널 안 격파 그림, 강화 화면 톱니바퀴와 꼬리표.
// 판 2026.11.13-2: 전투 단추의 상태 표시(아이템 색, 조준 중인 칸, 과부하 단추의 준비·재충전·잠금·안내)와 이동 대기 고리(스팀팩, 발전소 정지).
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
 // the battle buttons show their state in the signal look, and the move-wait ring starts full whatever the wait is (build 2026.11.13-2)
 for(const [w,h] of [[844,390],[390,844]]){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});const T=inGame(p),J=async code=>JSON.parse(await T(code));
  await T(`$('title').hidden=true;mute=true;Object.assign(learned,{drill:true,pulse:true,item:true,combo:true});for(const m of MAPS)learned.maps[m.id]=true;for(const k in ITEMS)learned.items[k]=true;beginRun();pattern=[[1e9,0,'runner']];nextSpawn=0;enemies=[];
   window.__css=id=>{const s=getComputedStyle($(id));return {color:s.color,border:s.borderTopColor,bw:s.borderTopWidth,anim:s.animationName,op:s.opacity};};
   window.__rgb=hex=>{const n=parseInt(hex.slice(1),16);return 'rgb('+(n>>16)+', '+((n>>8)&255)+', '+(n&255)+')';};0`);
  const it=await J(`(()=>{const bad=[];for(const id in ITEMS){bag=[id];updateControls();const s=__css('itemBtn'),want=__rgb(ITEMS[id].col);if(s.color!==want||s.border!==want||s.op!=='1'||s.anim!=='none')bad.push(id+' '+s.color+' '+s.border);}
   learned.items.wall=false;bag=['wall'];updateControls();const locked=__css('itemBtn'),lockWant=__rgb(ITEMS.wall.col);learned.items.wall=true;bag=[];updateControls();return JSON.stringify({bad,locked,lockWant,empty:__css('itemBtn'),gear:__css('gearBtn')});})()`);
  ck(w+'x'+h+' a held item shows in its own colour, icon and border',!it.bad.length,it.bad.join(' | '));
  ck('an item that is still locked keeps its colour, dimmed',it.locked.color===it.lockWant&&it.locked.op==='0.6',JSON.stringify(it.locked));
  ck('an empty slot stays plain',it.empty.color===it.gear.color&&it.empty.anim==='none'&&it.empty.bw==='1px',JSON.stringify(it.empty));
  const am=await J(`(()=>{bag=['magnet','chain'];updateControls();useItem(0);const a=__css('itemBtn'),o=__css('itemBtn2'),on=aim;aim=-1;bag=[];updateControls();return JSON.stringify({a,o,on,after:__css('itemBtn')});})()`);
  ck('the slot being aimed sends out rings in its colour, the other slot does not',am.on===0&&am.a.anim==='pingc'&&am.a.bw==='2px'&&am.o.anim==='none'&&am.o.bw==='1px'&&am.after.anim==='none',JSON.stringify(am));
  const pb=await J(`(()=>{const o={};drone.pulseCooldown=0;pulseLock=false;updateControls();o.ready=__css('pulseBtn');drone.pulseCooldown=5;updateControls();o.cooling=__css('pulseBtn');drone.pulseCooldown=0;
   pulseLock=true;updateControls();o.locked=__css('pulseBtn');pulseLock=false;hold('pulse','t','m','h',()=>{});o.asked=__css('pulseBtn');releaseHold();o.after=__css('pulseBtn');return JSON.stringify(o);})()`);
  const red='rgb(226, 70, 47)';
  ck('the overload border is red only while it is ready',pb.ready.border===red&&pb.after.border===red&&pb.cooling.border!==red&&pb.locked.border===pb.cooling.border,JSON.stringify({ready:pb.ready.border,cooling:pb.cooling.border,locked:pb.locked.border,after:pb.after.border}));
  ck('the overload button sends out rings while a lesson asks for it',pb.asked.anim==='ping'&&pb.asked.border===red&&pb.ready.anim==='none'&&pb.after.anim==='none',JSON.stringify({asked:pb.asked.anim,ready:pb.ready.anim}));
  // the ring: record what the HUD draws and read the share of the arc that is centred on the drone
  await T(`window.__arcs=[];{const c2=window.R3D.ctx.hud.canvas.getContext('2d'),a0=c2.arc;c2.arc=function(x,y,r,s,e){window.__arcs.push([x,y,r,s,e]);return a0.apply(this,arguments);};}
   window.__ring=()=>{const C=window.R3D.ctx,v=new C.THREE.Vector3(),q=new C.THREE.Vector3();C.dronePos(v);C.project(v,q);let k=-1;for(const a of window.__arcs)if(Math.abs(a[0]-q.x)<.6&&Math.abs(a[1]-q.y)<.6&&Math.abs(a[3]+1.5708)<1e-3)k=(a[4]-a[3])/6.2832;return +k.toFixed(3);};0`);
  const ring=async code=>{await T(code+';window.__arcs.length=0;0');await p.waitForFunction(()=>window.__arcs.length>0&&window.__ring()>=0,null,{timeout:15000});return +(await T('__ring()'));};
  const go="paused=false;drone.moveCooldown=0;switchLane(1-drone.lane);paused=true";
  const base=+(await T('effects.moveBase'));
  const k1=await ring("aid.stim=0;facilities[0]=100;"+go),w1=+(await T('drone.moveCooldown'));
  const k2=await ring("drone.moveCooldown=drone.moveWait/2");
  const k3=await ring("aid.stim=8;"+go),w3=+(await T('drone.moveCooldown'));
  const k4=await ring("aid.stim=0;"+go+";paused=false;bag=['stim'];updateControls();useItem(0);paused=true"),w4=+(await T('drone.moveCooldown'));
  const k5=await ring("aid.stim=0;bag=[];facilities[0]=0;"+go),w5=+(await T('drone.moveCooldown'));
  const k6=await ring("facilities[0]=30");
  await T("aid.stim=0;facilities[0]=100;drone.moveCooldown=0;paused=false;0");
  ck('the wait ring starts full and is half at half the wait',k1>.99&&Math.abs(w1-base)<1e-9&&Math.abs(k2-.5)<.01,JSON.stringify({k1,k2,wait:w1}));
  ck('under stimpack the wait is half and the ring still starts full',k3>.99&&Math.abs(w3-base*.5)<1e-9,JSON.stringify({k3,wait:w3}));
  ck('a stimpack used during the wait halves what is left of the ring',Math.abs(k4-.5)<.01&&Math.abs(w4-base*.5)<1e-9,JSON.stringify({k4,wait:w4}));
  ck('with the power plant down the wait is longer and the ring starts full; a repair during the wait does not move it',k5>.99&&w5>base*1.4&&k6>.99,JSON.stringify({k5,k6,wait:w5}));
  ck('no page errors '+w+'x'+h,!errs.length,errs.slice(0,2).join(' | '));await c.close();}
 await b.close();end();})();
