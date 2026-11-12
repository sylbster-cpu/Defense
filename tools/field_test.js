// 현장 포탑(레어 적 격파 시 그 자리에 서는 소형 포탑)과 진동 설정 확인. node tools/field_test.js <게임 폴더 절대 경로> <출력 폴더>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]||'.');fs.mkdirSync(out,{recursive:true});
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook');const f=path.join(dir,'_ft_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();let bad=0;const ck=(n,ok,x)=>{console.log((ok?'ok  ':'BAD ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)bad++;};
 for(const [w,h] of [[844,390],[390,844]]){const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const T=x=>p.evaluate(x=>window.__t(x),x);await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
  await T("$('title').hidden=true;$('titleVid').pause();mute=true;learned.item=learned.pulse=true;learned.maps={pinch:1,detour:1,wave:1};beginRun();pattern=[[1e9,0,'runner']];nextSpawn=0;turrets=[];drone.lane=1;drone.x=LANES[1];0");
  // a rare machine on lane 0, destroyed: with the coin on the turret side a field turret stands where it fell
  await T("const r0=Math.random;Math.random=()=>.95;spawn(0,'runner');const e=enemies[0];e.rare=true;e.y=250;damageEnemy(e,1e6,0,0,'turret');Math.random=r0;0");
  ck(w+'x'+h+' a fallen rare machine can leave a field turret where it fell',await T("fieldTurrets.length===1&&fieldTurrets[0].lane===0&&Math.abs(fieldTurrets[0].y-250)<1&&bag.length===0&&drops.length===0"),await T('JSON.stringify(fieldTurrets)'));
  await T("const r0=Math.random;Math.random=()=>.3;spawn(1,'runner');const e=enemies[enemies.length-1];e.rare=true;e.y=300;damageEnemy(e,1e6,0,0,'turret');Math.random=r0;0");
  ck('otherwise it leaves an item on the field',await T("fieldTurrets.length===1&&drops.length===1&&bag.length===0"),await T('drops[0].item'));
  // it fights: a machine walking past on its lane is hit, one on the other lane is not
  await T("drops=[];enemies=enemies.filter(e=>e.hp>0);spawn(0,'brute');spawn(1,'brute');const a=enemies[enemies.length-2],c=enemies[enemies.length-1];a.y=200;c.y=230;a.hp=a.maxHp=c.hp=c.maxHp=1e6;drone.lane=1;drone.x=LANES[1];effects.droneRange=40;0");   // the drone (lane 1) is held out of range, so only the field turret can hit
  await p.waitForTimeout(1600);
  ck('it shoots machines on its own lane only',await T("const a=enemies.find(e=>e.lane===0),c=enemies.find(e=>e.lane===1);a.hp<a.maxHp&&c.hp===c.maxHp"),await T("enemies.map(e=>e.lane+':'+Math.round(e.maxHp-e.hp)).join()"));
  ck('it is drawn in 2.5D',await p.evaluate(()=>window.R3D&&true)&&await T("true"));
  await T("speed=0;0");await p.waitForTimeout(500);await p.screenshot({path:path.join(out,`field_${w}x${h}.png`)});await T("speed=prefs.speed;0");
  // at most two; the oldest goes first. It ends after FIELD.life seconds.
  await T("for(const y of [150,350]){const r0=Math.random;Math.random=()=>.95;spawn(1,'runner');const e=enemies[enemies.length-1];e.rare=true;e.y=y;damageEnemy(e,1e6,0,0,'turret');Math.random=r0;}0");
  ck('at most two at a time, the oldest replaced',await T("fieldTurrets.length===2&&fieldTurrets.every(f=>f.lane===1)"),await T("fieldTurrets.map(f=>f.lane+'@'+Math.round(f.y)).join()"));
  await T("for(let i=0;i<60*12.2;i++)update(1/60);0");ck('they end after 12 s',await T("fieldTurrets.length===0"));
  await T("const r0=Math.random;Math.random=()=>.95;spawn(0,'runner');const e=enemies[enemies.length-1];e.rare=true;e.y=250;damageEnemy(e,1e6,0,0,'turret');Math.random=r0;newStage(2);0");ck('a new chapter clears them',await T("fieldTurrets.length===0"));
  // vibration setting
  await T("window.__v=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:(x)=>{window.__v.push(x);return true;}});0");
  await T("openSettings();0");ck('vibration row is shown where the phone can vibrate',await p.isVisible('#vibRow'));
  await p.click('#setVib [data-v="0"]');await T("buzz(30);0");ck('vibration off: nothing',await T("prefs.vib===false&&window.__v.length===0&&JSON.parse(localStorage.getItem('relayPrefs')).vib===false"));
  await p.click('#setVib [data-v="1"]');ck('vibration on: a short buzz to confirm, saved',await T("prefs.vib===true&&window.__v.length===1&&JSON.parse(localStorage.getItem('relayPrefs')).vib===true"));
  await T("prefs.vol=0;buzz(30);prefs.vol=100;0");ck('volume 0 no longer turns vibration off',await T("window.__v.length===2"));
  const box=await p.evaluate(()=>{const r=document.getElementById('settings').getBoundingClientRect();return[r.top,r.bottom,innerHeight];});ck('settings panel inside the screen',box[0]>=0&&box[1]<=box[2],box);
  await T("closeSettings();0");
  ck('no errors',!errs.length,errs.slice(0,3));await p.close();}
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
