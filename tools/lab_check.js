// 소리를 켠 채 점검한다: 소리가 요청되는지, 타격 정지가 걸리는지, 화면이 실제로 흔들리는지(px), 화면 번쩍임이 그려지는지. node tools/lab_check.js <게임 폴더 절대 경로> <출력 폴더>
const { chromium } = require('playwright');const {hooked,checks,inGame}=require('./lib.js');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const f=hooked(dir,'lc');
(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const {ck,end}=checks();
 for(const [w,h] of [[844,390],[390,844]]){const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/intro\.mp3|ERR_FILE_NOT_FOUND|scheme/.test(m.text()))errs.push(m.text().slice(0,200));});
  const T=inGame(p);await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
  await p.waitForFunction(()=>window.__t('SFX.ready'),null,{timeout:30000});
  await T("$('title').hidden=true;$('titleVid').pause();learned.item=learned.pulse=true;for(const m of MAPS)learned.maps[m.id]=1;window.__n={};window.__req=0;window.__st=0;{const f=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){window.__st++;return f.apply(this,a);};}const s0=sfx;sfx=function(n,...a){window.__n[n]=(window.__n[n]||0)+1;if(!mute&&prefs.vol>0&&SFX.ready&&SFX.raw[n])window.__req++;s0(n,...a);};beginRun();pattern=[[1e9,0,'runner']];nextSpawn=0;0");
  ck(w+'x'+h+' ambience starts with the battle',await T('SFX.ambOn===true'));
  await p.evaluate(()=>{const c=window.R3D.ctx,raw=c.fxScreen;window.__w=0;c.fxScreen=new Proxy(raw,{set(o,k,v){if(k==='white'&&v>=.5)window.__w++;o[k]=v;return true;}});});   // the white flash lasts a frame or two at the test machine's frame rate: count the times it is set
  await T("for(let i=0;i<3;i++){spawn(0,'grunt');enemies[i].y=DRONE_Y-40+i*30;enemies[i].hp=enemies[i].maxHp=400;}spawn(1,'brute');enemies[3].y=TURRET_Y-60;enemies[3].hp=enemies[3].maxHp=2000;0");await p.waitForTimeout(1500);
  const n1=JSON.parse(await T('JSON.stringify(window.__n)'));ck('fire and impact sounds are requested',n1.drone>=1&&n1.hit_light>=1&&n1.turret>=1&&n1.hit_heavy>=1,n1);
  ck('audio context runs',await T("audio&&audio.state")==='running',await T('audio&&audio.state'));
  // overload: hit-stop, shake in pixels, white flash
  // watch inside the page, frame by frame: how far the camera is moved (in screen pixels), how strong the flashes get, whether the edge pixel turns red
  const watch=(ms)=>p.evaluate(ms=>new Promise(res=>{const c=window.R3D.ctx,t0=performance.now(),o={px:0,white:0,red:0,edge:0,frames:0};(function f(){const d=Math.hypot(c.camera.position.x-c.L.camPos.x,c.camera.position.y-c.L.camPos.y,c.camera.position.z-c.L.camPos.z)*c.pxPerUnit(c.L.camTarget);o.px=Math.max(o.px,d);if(c.fxScreen){o.white=Math.max(o.white,c.fxScreen.white);o.red=Math.max(o.red,c.fxScreen.red);}
    const cv=c.hud.canvas,px=cv.getContext('2d').getImageData(2,Math.floor(cv.height/2),1,1).data;if(px[0]>150&&px[3]>40)o.edge=1;o.frames++;if(performance.now()-t0<ms)requestAnimationFrame(f);else res(o);})();}),ms);
  await T("drone.pulseCooldown=0;const a=stageTime;pulse();window.__held=typeof stopT==='number'?stopT:0;a");const wp=await watch(700);
  ck('overload holds the battle for a moment',(await T('window.__held'))>=.06,{stop:await T('window.__held')});ck('overload shakes the picture and flashes white',wp.px>1&&wp.px<12&&(await p.evaluate(()=>window.__w))>=1,{px:+wp.px.toFixed(1),frames:wp.frames,note:'about 7 px at 60 frames a second; this machine draws about 10'});
  ck('overload sound and kills',(await T('window.__n.pulse'))>=1,await T('JSON.stringify(window.__n)'));
  await T('drone.pulseCooldown=0;pulse();0');await p.waitForTimeout(40);await p.screenshot({path:path.join(out,`pulse_${w}x${h}.png`)});
  // breach: red edge, sound; then the plant goes down
  await p.waitForTimeout(700);await T("spawn(0,'runner');enemies[enemies.length-1].y=LEAK_Y-1;0");const wl=await watch(600);await p.screenshot({path:path.join(out,`leak_${w}x${h}.png`)});
  ck('a breach reddens the edge of the screen and shakes',wl.red>.3&&wl.edge===1&&wl.px>.4,{px:+wl.px.toFixed(1),red:+wl.red.toFixed(2),edge:wl.edge});ck('breach sound',(await T('window.__n.leak'))>=1);
  await T("facilities[0]=5;spawn(0,'brute');enemies[enemies.length-1].y=LEAK_Y-1;0");await p.waitForTimeout(200);ck('collapse sound',(await T('window.__n.facdown'))===1);await p.screenshot({path:path.join(out,`facdown_${w}x${h}.png`)});
  await T("op=3;spawn(1,'boss');const e=enemies[enemies.length-1];e.y=DRONE_Y;damageEnemy(e,1e6,0,0,'turret');0");await p.waitForTimeout(700);ck('boss kill sound',(await T('window.__n.kill_boss'))===1);
  await T("enemies=[];nextSpawn=pattern.length;0");await p.waitForTimeout(400);ck('ambience stops at the upgrade screen',await T("phase==='upgrade'&&SFX.ambOn===false"));
  ck('every requested sound reaches the audio device',await T('window.__req>20&&window.__st===window.__req+1'),await T("window.__st+' starts for '+window.__req+' requests and the ambience'"));   // sfx() swallows its errors: count what really started
  const sc=await p.evaluate(()=>document.documentElement.scrollWidth+'x'+document.documentElement.scrollHeight);ck('no scroll',sc===w+'x'+h,sc);ck('no errors',!errs.length,errs.slice(0,3));await p.close();}
 await b.close();end();})();
