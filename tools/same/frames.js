// 2.5D 화면 동일성 기록: 난수를 고정한 판을 실제 렌더러로 그리며(가짜 시계) 그린 프레임마다 WebGL 픽셀과 HUD 캔버스 픽셀의 해시를 적는다.
// 규칙과 그리기는 난수를 따로 쓴다. 그래서 그리기만 고친 수정은 규칙 쪽 결과를 건드리지 않는다. 두 판을 각각 기록한 뒤 cmp.js로 비교한다.
// 모든 장을 가로·세로로 도는 진행 둘과 화질 0·1, 작은 화면, 지는 판이 들어 있다. 전체는 15분쯤 걸린다(소프트웨어 렌더링).
// node tools/same/frames.js <게임 폴더 절대 경로> <결과.json> [진행 이름들]      SHOTS=<폴더>면 중간 화면 사진을 남긴다
// PRE=<코드>면 진행을 시작하기 전에 그 코드를 게임 안에서 돌린다. 일부러 바꾼 것 하나를 예전 방식으로 되돌려 놓고 나머지 그림이 이전 판과 같은지 볼 때 쓴다(인계 문서 19.3절의 예).
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const U=require('./states.js'),cov=require('./cov.js');
const dir=path.resolve(process.argv[2]),outFile=path.resolve(process.argv[3]),ONLY=process.argv[4]?process.argv[4].split(','):null,SHOTS=process.env.SHOTS,PRE=process.env.PRE||'';
const RUN=`window.__frames=function*(o){
 const gr=__mk(o.seed),fr=__mk(o.seed+7);Math.random=gr;mute=true;best=0;
 Object.assign(learned,{drill:false,pulse:false,item:false,maps:{},items:{},combo:false});if(!o.live)Object.assign(learned,{drill:true,pulse:true,item:true,combo:true}),MAPS.forEach(m=>learned.maps[m.id]=true),Object.keys(ITEMS).forEach(k=>learned.items[k]=true);
 const R=window.R3D.ctx.renderer,gl=R.getContext(),hud=document.getElementById('hud3d'),hx=hud.getContext('2d');
 let hg=2166136261,hh=2166136261,hs=2166136261,drawn=0,want=true,buf=null;const marks=[];
 const F=(x,s)=>{for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619);}return x>>>0;};
 const d0=draw;draw=function(ts){if(!want)return;Math.random=fr;d0(ts);Math.random=gr;drawn++;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;if(!buf||buf.length!==w*h*4)buf=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  let x=hg;for(let i=0;i<buf.length;i+=5){x^=buf[i];x=Math.imul(x,16777619);}hg=x>>>0;
  const d=hx.getImageData(0,0,hud.width,hud.height).data;x=hh;for(let i=0;i<d.length;i+=5){x^=d[i];x=Math.imul(x,16777619);}hh=x>>>0;
  if(drawn%40===0)marks.push(drawn+':'+hg+':'+hh+':'+hs);};
 const tick=o.bot==='weak'?60:24,react=o.bot==='weak'?2:1,pulseAt=o.bot==='weak'?3:2,ids=Object.keys(ITEMS);
 let fr2=0,n=0,pick=0,lastOp=0,shots=0;
 const act=()=>{
  if(holdState){const need=holdState.need;if(performance.now()-holdState.t0<500)return;
   if(need==='tap')releaseHold();else if(need==='pulse')pulse();else if(need.slice(0,4)==='move')switchLane(+need.slice(4));else if(need==='pick'){if(drops.length&&takeDrop(drops[0]))releaseHold();}else throw new Error('unknown hold '+need);return;}
  if(phase==='upgrade'){const c=offeredUpgrades;choose(c[(pick++)%c.length]);return;}
  if(phase!=='battle'||paused||drill)return;
  if(op!==lastOp){lastOp=op;if(o.chapters&&!o.chapters.includes(op)){const k=o.chapters.find(c=>c>op);if(!k){phase='finish';return;}newStage(k);updateControls();lastOp=op;}
   bag=[ids[(op*2-2+(o.rot||0))%ids.length],ids[(op*2-1+(o.rot||0))%ids.length]];updateControls();}
  fr2++;if(o.bot==='none')return;
  if(fr2%500===120){const e=enemies.find(q=>q.hp>0&&q.type!=='boss');if(e){e.rare=true;placeField(e);}}   // a rare machine and a field turret in every stretch
  for(const d of drops.slice())if(DROP_LIFE-d.life>=react+2&&bag.length<BAG_MAX)takeDrop(d);
  if(fr2%tick===0){const c=[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-190&&!map.cover(e.lane,e.y)).reduce((a,e)=>a+TYPES[e.type].value,0));
   if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane])switchLane(1-drone.lane);
   const inR=enemies.filter(e=>e.hp>0&&(e.lane===drone.lane||map.near(e.y))&&!map.cover(e.lane,e.y)&&Math.abs(e.y-drone.y)<effects.pulseRange).length;
   if(drone.pulseCooldown<=.01&&inR>=pulseAt)pulse();
   if(bag.length&&fr2%(tick*5)===0){const id=bag[0];
    if((typeof AIMED!=='undefined'?AIMED.includes(id):!!ITEMS[id].aim)){if(aim!==0)useItem(0);else{if(id==='magnet')useAim(drone.lane,DRONE_Y-30);else{const l=c[1]>c[0]?1:0;let lead=null;for(const e of enemies)if(e.hp>0&&e.lane===l&&(!lead||e.y>lead.y))lead=e;useAim(l,lead?lead.y-20:DRONE_Y);}}}
    else useItem(0);}}
 };
 const state=()=>phase+'|'+op+'|'+core.toFixed(3)+'|'+score+'|'+kills+'|'+leaks+'|'+enemies.length+'|'+drone.lane+'|'+bag.join(',')+'|'+stageTime.toFixed(3);
 for(let i=0;i<30;i++)__clock.step(1000/30);   // the title screen: the scene idles behind it
 if(o.pre)eval(o.pre);
 if(o.drill){leaveTitle();startDrill();}else{leaveTitle();beginRun();if(!o.live){liveRun=false;lesson=null;pulseLock=false;updateControls();}}
 const limit=o.limit||30*60*40,EV=o.every||16;
 while(phase!=='finish'&&n<limit){
  act();n++;want=n%EV===0||n%600<8;__clock.step(1000/30);hs=F(hs,state());
  if(n%1200===604){shots++;yield 'shot';}
  else if(n%150===0)yield null;}
 want=true;for(let i=0;i<45;i++)__clock.step(1000/30);   // the finish screen
 return JSON.stringify({steps:n,drawn,phase,op,score,kills,leaks,hg,hh,hs,active:G3.active,marks,q:window.R3D.api.info().q,mode:window.R3D.api.info().mode});};0`;
const VARIANTS={
 drill_p:  {vp:'390x844',q:2,drill:true,live:true,bot:'casual',seed:101},
 full_l:   {vp:'844x390',q:2,bot:'weak',seed:202,rot:4},
 low_l:    {vp:'700x318',q:0,bot:'casual',seed:303,rot:2,chapters:[1,2,5,6,7,9,10,12],limit:30*60*9,every:12},
 mid_p:    {vp:'360x640',q:1,bot:'casual',seed:404,rot:6,chapters:[3,4,8,11,12],limit:30*60*6,every:12},
 lose_l:   {vp:'844x390',q:2,bot:'none',seed:505,every:6},
 small_l:  {vp:'568x320',q:2,bot:'casual',seed:606,rot:8,chapters:[2,4,6,8,10,11],limit:30*60*6,every:12},
};
(async()=>{const b=await chromium.launch();const file=U.hooked(dir,'fr');const out={};const names=Object.keys(VARIANTS).filter(k=>!ONLY||ONLY.includes(k));let next=0;
 const worker=async()=>{while(next<names.length){const name=names[next++],v=VARIANTS[name];const t0=Date.now();
  const [w,h]=v.vp.split('x').map(Number);const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:1});await c.addInitScript(U.INIT);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning'&&/2\.5D/.test(m.text()))errs.push(m.text().slice(0,200));});
  await cov.start(p);await p.goto('file://'+file+'?q='+v.q);let ok=false;for(let i=0;i<200&&!ok;i++){await p.waitForTimeout(100);ok=await p.evaluate(()=>!!(window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active));}
  if(!ok){out[name]={error:'2.5D view did not start'};console.log(name,'did not start');await c.close();continue;}
  await p.evaluate(()=>Promise.all(['BHS','TDISP','TMONO'].map(f=>document.fonts.load('16px "'+f+'"','가A1'))));
  await p.evaluate(r=>window.__t(r),RUN);await p.evaluate(o=>{window.__it=window.__frames(o);},Object.assign({pre:PRE},v));
  let r=null,shot=0;for(;;){const x=await p.evaluate(()=>{const x=window.__it.next();return x.done?{done:x.value}:{y:x.value};});if(x.done){r=x.done;break;}
   if(x.y==='shot'&&SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await p.screenshot({path:path.join(SHOTS,name+'_'+String(shot++).padStart(2,'0')+'.png')});}}
  out[name]=JSON.parse(r);out[name].errors=errs;await cov.stop(p);
  console.log(name.padEnd(8),'steps',out[name].steps,'drawn',out[name].drawn,'end',out[name].phase,'op',out[name].op,'gl',out[name].hg,'hud',out[name].hh,'state',out[name].hs,'active',out[name].active,Math.round((Date.now()-t0)/1000)+'s',errs.length?'ERRORS '+errs[0]:'');
  await c.close();}};
 await Promise.all([worker(),worker(),worker(),worker()]);await b.close();
 const sorted={};for(const k of Object.keys(VARIANTS))if(out[k])sorted[k]=out[k];fs.writeFileSync(outFile,JSON.stringify(sorted,null,1));})();
