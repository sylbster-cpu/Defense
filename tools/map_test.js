// 맵 규칙과 새 지형 안내 확인. node map_test.js <게임 폴더>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=process.argv[2];
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
const f=path.join(dir,'_map_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));let bad=0;const ck=(n,ok,x)=>{console.log((ok?'ok  ':'BAD ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)bad++;};
 const T=x=>p.evaluate(x=>window.__t(x),x);await p.goto('file://'+f+'?q=0');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
 await T("$('title').hidden=true;mute=true;learned.item=true;learned.pulse=true;beginRun();newStage(2);liveRun=true;");
 await p.waitForFunction(()=>window.__relay.hold==='tap',null,{timeout:15000});ck('first visit explains the map',(await T("$('coachTitle').textContent"))==='새 지형 · 협곡',await T("$('coachMain').textContent"));
 await p.waitForTimeout(600);await p.touchscreen?0:0;await T('releaseHold()');ck('explained once',await T('learned.maps.pinch===true'));
 // 협곡: 과부하가 반대 전선의 협곡 안 적도 친다
 await T('enemies=[];nextSpawn=pattern.length-1;spawn(0,"grunt");spawn(1,"grunt");spawn(1,"grunt");enemies[0].y=DRONE_Y-30;enemies[1].y=DRONE_Y+20;enemies[2].y=DRONE_Y-100;drone.lane=0;drone.x=LANES[0];drone.pulseCooldown=0;paused=true;');
 const h0=await T('enemies.map(e=>e.hp).join()');await T('paused=false;pulse();paused=true;');const h1=await T('enemies.map(e=>Math.round(e.hp)).join()');
 ck('pinch: overload hits the other lane inside the gorge only',await T('enemies[0].hp<enemies[0].maxHp&&enemies[1].hp<enemies[1].maxHp&&enemies[2].hp===enemies[2].maxHp'),{h0,h1});
 // 우회로: 구간 안에서 40% 느려진다
 await T('paused=false;newStage(3);learned.maps.detour=true;enemies=[];pattern=[[1e9,0,"runner"]];nextSpawn=0;spawn(0,"brute");spawn(0,"brute");enemies[0].y=200;enemies[1].y=280;enemies[0].hp=enemies[1].hp=1e6;turrets=[];drone.lane=1;drone.x=LANES[1];');
 const a=await T('const y=[enemies[0].y,enemies[1].y];for(let i=0;i<30;i++)update(1/60);JSON.stringify([enemies[0].y-y[0],enemies[1].y-y[1]])');const d=JSON.parse(a);
 ck('detour: 40% slower inside the stretch',Math.abs(d[0]/d[1]-.6)<.03,d);
 ck('maps per chapter',await T('[1,2,3,4,5].map(i=>MAPS[MAP_OF[i]].id).join()')==='straight,pinch,detour,wave,pinch');ck('no errors',!errs.length,errs.slice(0,2));
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
