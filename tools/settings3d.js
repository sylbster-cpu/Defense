// 설정 창 확인: 열면 게임이 멈추는지, 속도·화면 전환·밝기·뒤로가기·저장이 되는지. node settings3d.js <게임 폴더>
const { chromium } = require('playwright');const {hooked,checks,inGame}=require('./lib.js');const path=require('path');
const dir=process.argv[2];
const f=hooked(dir,'set');
(async()=>{const b=await chromium.launch();const {ck,end}=checks();
 for(const [w,h] of [[844,390],[390,844]]){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const T=inGame(p);
  await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
  await T('$("title").hidden=true;mute=true;reset();newStage(2);showOverlay(false);phase="battle";');await p.waitForTimeout(600);
  await p.click('#gearBtn');const t0=await T('stageTime');await p.waitForTimeout(900);const t1=await T('stageTime');
  ck(w+'x'+h+' game holds while open',t0===t1&&await p.isVisible('#settings'),{t0,t1});
  const box=await p.locator('#settings').boundingBox();ck('panel inside screen',box.x>=0&&box.y>=0&&box.x+box.width<=w&&box.y+box.height<=h,box);
  await p.click('#setSpeed button[data-v="2"]');ck('speed x2',await T('speed')===2);
  ck('no view switch',await p.locator('#setView').count()===0);
  await p.locator('#setBright').fill('130');ck('brightness',(await p.evaluate(()=>document.getElementById('game3d').style.filter))==='brightness(1.3)');
  await p.locator('#setVol').fill('0');ck('volume 0',await T('prefs.vol')===0);
  await p.screenshot({path:path.join(dir,'..','_set_'+w+'.png')});
  await p.click('#setClose');await p.waitForTimeout(700);const t2=await T('stageTime');ck('resumes after close',t2>t1&&!(await p.isVisible('#settings')),{t1,t2});
  await p.goBack();await p.waitForTimeout(300);ck('back button opens settings',await p.isVisible('#settings'));
  await p.goBack();await p.waitForTimeout(300);ck('back again closes',!(await p.isVisible('#settings')));
  await p.keyboard.press('Escape');ck('Esc opens',await p.isVisible('#settings'));await p.keyboard.press('p');ck('P closes',!(await p.isVisible('#settings')));
  const l0=await T('drone.moveCooldown=0;drone.lane');const fb=await p.locator('#field').boundingBox();
  if(w>h)await p.touchscreen.tap(fb.x+fb.width/2,fb.y+fb.height*(l0?.25:.75));else await p.touchscreen.tap(fb.x+fb.width*(l0?.25:.75),fb.y+fb.height/2);await p.waitForTimeout(200);ck('field tap moves',await T('drone.lane')!==l0);
  await T('drone.pulseCooldown=0;enemies.push({id:9,lane:drone.lane,type:"brute",x:drone.x,y:drone.y-20,hp:9999,maxHp:9999,speed:0,flash:0,wiggle:1,stun:0})');await p.waitForTimeout(250);await p.click('#pulseBtn');await p.waitForTimeout(250);ck('pulse button fires and shows cooldown',await T('drone.pulseCooldown')>1&&await p.evaluate(()=>document.getElementById('pulseBtn').classList.contains('cooling')));
  await p.reload();await p.waitForTimeout(800);ck('settings kept after reload',await T('prefs.speed===2&&prefs.vol===0&&prefs.bright===130'));
  ck('no page errors',!errs.length,errs.slice(0,2));ck('no scroll',await p.evaluate(()=>document.documentElement.scrollWidth+'x'+document.documentElement.scrollHeight)===w+'x'+h);await c.close();}
 await b.close();end();})();
