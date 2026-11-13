// 2.5D 화면 확인 도구. 게임을 원하는 상태로 만든 뒤 화면을 찍는다.
// 사용: node shot3d.js <게임 폴더(index.html과 r3d/가 있는 곳)> <출력 폴더> <이름표> <장면> [화면크기 ...]
//   화면크기 예: 700x318 390x844 1280x800 (뒤에 @2 를 붙이면 2배 밀도). 기본 700x318 390x844
//   장면: intro idle battle boss lineup echo pierce pulse kill leak facdown move rubble surge paused
// 환경변수: WAIT=ms(장면 적용 뒤 기다리는 시간) CAM="x,y,z,tx,ty,tz,fov"(카메라를 직접 놓고 가까이서 보기) Q=0|1|2(품질, 기본 2) CODE='추가로 실행할 게임 코드'
//           MODE2D=1 (2D 대체 화면으로 찍기)
const { chromium } = require('playwright');const {hooked}=require('./lib.js');const path=require('path'),fs=require('fs');
const [dir,out,tag,scn,...vps]=process.argv.slice(2);
if(!scn){console.log('usage: node shot3d.js <gameDir> <outDir> <tag> <scene> [WxH ...]');process.exit(1);}
const page=hooked(dir,'shot');fs.mkdirSync(out,{recursive:true});
const put=`const put=(lane,type,y,o)=>{const m=TYPES[type];const e=Object.assign({id:Math.random(),lane,type,x:LANES[lane],y,hp:m.hp,maxHp:m.hp,speed:m.speed,flash:0,wiggle:1,stun:0},o||{});enemies.push(e);ev3({t:'spawn',e});return e;};`;
const freeze=`speed=0;`;
const SC={
 intro:[``,400],
 idle:[`mute=true;reset();newStage(1);enemies=[];pattern=[[1e9,0,'runner']];nextSpawn=0;${freeze}`,500],   // 올 적을 하나 남겨 둔다. 일정이 비면 곧바로 강화 선택으로 넘어간다
 battle:[`mute=true;reset();newStage(3);for(let i=0;i<60*9;i++)update(1/60);${freeze}`,500],
 boss:[`mute=true;reset();upgradeRanks.stable=2;Object.assign(effects,BAL.card.stable(2));newStage(TOTAL_OPS);for(let i=0;i<60*49;i++){update(1/60);core=100;facilities=[100,100];}${freeze}`,500],
 lineup:[`mute=true;reset();newStage(2);enemies=[];nextSpawn=pattern.length;${put}
   put(0,'runner',150);put(0,'grunt',215);put(0,'brute',290);put(0,'boss',400);put(0,'runner',470,{slow:2});put(0,'grunt',530,{hp:30});
   put(1,'boss',170,{hp:150});put(1,'brute',255,{stun:.5});put(1,'grunt',325,{slow:2});put(1,'runner',385);put(1,'grunt',450);put(1,'runner',545,{hp:12});effects.rubble=1;effects.rubbleFactor=.5;${freeze}`,500],
 echo:[`mute=true;reset();upgradeRanks.stable=3;Object.assign(effects,BAL.card.stable(3));newStage(4);for(let i=0;i<60*7;i++)update(1/60);switchLane(1);for(let i=0;i<30;i++)update(1/60);`,260],
 pierce:[`mute=true;reset();upgradeRanks.precision=3;Object.assign(effects,BAL.card.precision(3));newStage(4);for(let i=0;i<60*8;i++)update(1/60);`,300],
 pulse:[`mute=true;reset();upgradeRanks.emergency=1;Object.assign(effects,BAL.card.emergency(1));newStage(2);enemies=[];nextSpawn=pattern.length;${put}put(0,'grunt',300);put(0,'grunt',335);put(0,'brute',370);put(0,'runner',410);put(1,'grunt',330);pulse();`,170],
 kill:[`mute=true;reset();newStage(2);enemies=[];nextSpawn=pattern.length;${put}const a=[put(0,'runner',260),put(0,'grunt',330),put(1,'brute',300),put(1,'boss',380)];for(const e of a)damageEnemy(e,9999,drone.x,drone.y,'drone');`,180],
 leak:[`mute=true;reset();newStage(2);enemies=[];nextSpawn=pattern.length;${put}put(0,'brute',LEAK_Y-2);put(1,'grunt',LEAK_Y-2);update(1/20);`,200],
 facdown:[`mute=true;reset();newStage(3);for(let i=0;i<60*6;i++)update(1/60);facilities=[0,38];core=27;${freeze}`,600],
 move:[`mute=true;reset();upgradeRanks.rubble=1;Object.assign(effects,BAL.card.rubble(1));effects.rubble=1;newStage(3);for(let i=0;i<60*8;i++)update(1/60);switchLane(1);`,160],
 rubble:[`mute=true;reset();upgradeRanks.rubble=2;Object.assign(effects,BAL.card.rubble(2));effects.rubble=1;newStage(3);for(let i=0;i<60*9;i++)update(1/60);switchLane(1);for(let i=0;i<20;i++)update(1/60);${freeze}`,400],
 surge:[`mute=true;reset();newStage(3);for(let i=0;i<60*1;i++)update(1/60);${freeze}`,400],
 paused:[`mute=true;reset();newStage(3);for(let i=0;i<60*9;i++)update(1/60);paused=true;`,400],
};
if(!SC[scn]){console.log('unknown scene. scenes: '+Object.keys(SC).join(' '));process.exit(1);}
const list=(vps.length?vps:['700x318','390x844']).map(v=>{const [a,d]=v.split('@');const [w,h]=a.split('x').map(Number);return{w,h,d:+d||1};});
(async()=>{const b=await chromium.launch();let bad=0;
 for(const v of list){const c=await b.newContext({viewport:{width:v.w,height:v.h},deviceScaleFactor:v.d,hasTouch:true});const p=await c.newPage();const logs=[];
  p.on('pageerror',e=>logs.push('PAGE ERROR: '+e.message));p.on('console',m=>{const t=m.text();if((m.type()==='error'||m.type()==='warning')&&!/deprecated with r150|GPU stall|GL Driver Message/.test(t))logs.push(m.type().toUpperCase()+': '+t.slice(0,300));});
  await p.goto('file://'+path.resolve(page)+(process.env.MODE2D?'?2d=1':'?q='+(process.env.Q||2)));
  if(!process.env.MODE2D){try{await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:8000});}catch(e){logs.push('2.5D DID NOT START (fell back to 2D)');}}
  await p.waitForTimeout(250);
  if(scn!=='intro')await p.evaluate(()=>window.__t("$('title').hidden=true;$('titleVid').pause();"));
  try{await p.evaluate(c=>window.__t(c),SC[scn][0]+(process.env.CODE||''));}catch(e){logs.push('SCENE ERROR: '+e.message);}
  if(process.env.CAM){const a=process.env.CAM.split(',').map(Number);await p.evaluate(a=>{const x=window.R3D.ctx,c=x.camera;x.L.camPos.set(a[0],a[1],a[2]);c.position.set(a[0],a[1],a[2]);if(a[6]){c.fov=a[6];c.updateProjectionMatrix();}c.lookAt(a[3],a[4],a[5]);},a);}
  await p.waitForTimeout(+(process.env.WAIT||SC[scn][1]));
  const name=`${tag}_${scn}_${v.w}x${v.h}${v.d>1?'@'+v.d:''}.png`;await p.screenshot({path:path.join(out,name)});
  const info=await p.evaluate(()=>({active:!!(window.__relay&&window.__relay.active),r:window.R3D&&window.R3D.api?window.R3D.api.info():null,scroll:document.documentElement.scrollWidth+'x'+document.documentElement.scrollHeight}));
  console.log(name,JSON.stringify(info));for(const l of logs.slice(0,8)){console.log('   '+l);bad++;}
  await c.close();}
 await b.close();if(bad)console.log(`!! ${bad} message(s) above need attention`);})();
