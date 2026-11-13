// 2.5D 장시간 점검: 봇이 실제 전투를 빠르게 진행시키면서 오류, 자원 누수(geometries/textures), 그리기 부하의 최대값을 본다.
// 사용: node soak3d.js <게임 폴더> [WxH] [초(실시간), 기본 40]
const { chromium } = require('playwright');const {hooked}=require('./lib.js');
const [dir,vp='700x318',secs='40']=process.argv.slice(2);const [w,h]=vp.split('x').map(Number);
const f=hooked(dir,'soak');
// 프레임마다 게임을 여러 단계 진행시키고 간단한 봇으로 이동·과부하·강화 선택을 수행한다.
const BOT=`$('title').hidden=true;mute=true;reset();newStage(1);window.__soak={steps:0,ops:0,maxCalls:0,maxTris:0,frames:0,evs:0};
const _f=G3.renderer.frame;G3.renderer.frame=function(now){
  for(let i=0;i<10;i++){if(phase==='battle'){const o=1-drone.lane;const c=l=>enemies.filter(e=>e.lane===l&&e.hp>0).length;
      if(drone.moveCooldown<=.02&&c(o)>c(drone.lane)+1)switchLane(o);
      if(drone.pulseCooldown<=.02&&enemies.some(e=>e.lane===drone.lane&&Math.abs(e.y-drone.y)<effects.pulseRange))pulse();
      update(1/60);core=Math.max(core,40);window.__soak.steps++;}
    else if(phase==='upgrade'){choose(offeredUpgrades[window.__soak.ops%3]);window.__soak.ops++;}
    else if(phase==='finish'){reset();newStage(1);window.__soak.ops++;}}
  window.__soak.evs+=G3.events.length;_f.call(this,now);const i=window.R3D.api.info();window.__soak.frames++;window.__soak.maxCalls=Math.max(window.__soak.maxCalls,i.calls);window.__soak.maxTris=Math.max(window.__soak.maxTris,i.tris);};`;
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PAGE ERROR: '+e.message));p.on('console',m=>{const t=m.text();if((m.type()==='error'||m.type()==='warning')&&!/deprecated with r150|GPU stall|GL Driver Message/.test(t))errs.push(m.type()+': '+t.slice(0,240));});
 await p.goto('file://'+f+'?q='+(process.env.Q||2));await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:8000});
 await p.evaluate(c=>window.__t(c),BOT);
 const snap=async()=>p.evaluate(()=>Object.assign({},window.__soak,window.R3D.api.info(),{active:window.__relay.active,heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):0,sceneObjs:(()=>{let n=0;window.R3D.ctx.scene.traverse(()=>n++);return n;})()}));
 await p.waitForTimeout(3000);const a=await snap();console.log('start',JSON.stringify(a));
 const n=Math.max(1,Math.round(+secs/10));for(let i=0;i<n;i++){await p.waitForTimeout(10000);const m=await snap();console.log('t+'+(i+1)*10+'s',JSON.stringify(m));}
 const z=await snap();
 console.log(`RESULT active=${z.active} gameSeconds=${Math.round(z.steps/60)} ops=${z.ops} frames=${z.frames} maxCalls=${z.maxCalls} maxTris=${z.maxTris} geoms ${a.geoms}->${z.geoms} tex ${a.tex}->${z.tex} sceneObjs ${a.sceneObjs}->${z.sceneObjs} heapMB ${a.heap}->${z.heap}`);
 for(const e of errs.slice(0,10))console.log('  '+e);console.log(errs.length||!z.active?'FAIL':'PASS');
 await b.close();})();
