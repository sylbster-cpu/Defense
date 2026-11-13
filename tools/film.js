// 시작 화면용 게임 영상의 프레임을 찍는다. node film.js <게임 폴더> <출력 폴더> <p|l> [프레임 수]
const { chromium } = require('playwright');const {hooked}=require('./lib.js');const path=require('path'),fs=require('fs');
const [dir,out,ori,nf]=process.argv.slice(2);const N=+nf||360;
const f=hooked(dir,'film');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const vp=ori==='p'?{width:405,height:720}:{width:720,height:405};
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:vp,deviceScaleFactor:4/3});const p=await c.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+f+'?q=2');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
 await p.addStyleTag({content:'#title,#gearBtn,#itemBtn,#itemBtn2,#pulseBtn,#hubChip,#toast,#coach,#hud3d,.overlay{display:none!important}.field{left:0!important;top:0!important;right:0!important;bottom:0!important;border:0!important;border-radius:0!important}'});
 await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});await p.waitForTimeout(400);
 await p.evaluate(()=>{window.dispatchEvent(new Event('resize'));window.__t(`mute=true;reset();
  upgradeRanks.stable=3;Object.assign(effects,BAL.card.stable(3));upgradeRanks.emergency=2;Object.assign(effects,BAL.card.emergency(2));upgradeRanks.precision=1;Object.assign(effects,BAL.card.precision(1));
  newStage(5);window.__now=1000;window.__n=0;
  window.__step=function(draw){update(1/30);core=100;facilities=[100,100];window.__n++;
   const c=[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-170).length);
   const inR=enemies.filter(e=>e.hp>0&&e.lane===drone.lane&&Math.abs(e.y-drone.y)<effects.pulseRange).length;
   if(drone.pulseCooldown<=.01&&inR>=3)pulse();
   if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane]+1)switchLane(1-drone.lane);
   if(draw){window.__now+=1000/30;G3.renderer.frame(window.__now);}
  };for(let i=0;i<30*24;i++)window.__step(i%6===0);`);});
 for(let i=0;i<N;i++){await p.evaluate(()=>window.__step(true));await p.screenshot({path:path.join(out,'f'+String(i).padStart(4,'0')+'.jpg'),type:'jpeg',quality:93});if(i%60===0)console.log('frame',i,await p.evaluate(()=>window.__t('JSON.stringify({t:+stageTime.toFixed(1),n:enemies.length,phase})')));}
 await b.close();console.log('done');})();
