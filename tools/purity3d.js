// 2.5D 화면이 게임 규칙에 영향을 주지 않는지 확인. node purity3d.js <게임 폴더> [WxH]
// 같은 난수·같은 조작으로 (가) 그리지 않고 (나) 2.5D로 매 프레임 그리며 5개 작전을 돌린 뒤 게임 상태를 비교한다.
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
const [dir,vp]=process.argv.slice(2);const [w,h]=(vp||'700x318').split('x').map(Number);
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook');const f=path.join(dir,'_pure_'+process.pid+'.html');fs.writeFileSync(f,s);
const RUN=`window.__mk=function*(draw3d){
 const mk=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 const real=Math.random,gr=mk(12345),fr=mk(999);Math.random=gr;mute=true;const out=[];let now=1000;
 reset();
 for(let o=1;o<=5;o++){
  if(o===2){upgradeRanks.stable=3;Object.assign(effects,BAL.card.stable(3));}
  if(o===3){upgradeRanks.precision=3;Object.assign(effects,BAL.card.precision(3));}
  if(o===4){upgradeRanks.emergency=2;Object.assign(effects,BAL.card.emergency(2));}
  if(o===5){upgradeRanks.rubble=2;Object.assign(effects,BAL.card.rubble(2));}
  newStage(o);core=100;facilities=[100,100];let n=0;
  while(phase==='battle'&&n<60*150){update(1/60);n++;
   if(n%170===0)switchLane(1-drone.lane);if(n%430===0)pulse();
   if(draw3d&&n%8===0){now+=133;Math.random=fr;G3.renderer.frame(now);Math.random=gr;}
   if(n%240===0){Math.random=real;yield null;Math.random=gr;}}
  out.push(JSON.stringify({o,n,phase,core,facilities,kills,leaks,switches,st:+stageTime.toFixed(4),dr:[drone.lane,+drone.x.toFixed(3),+drone.pulseCooldown.toFixed(4),+drone.moveCooldown.toFixed(4),+drone.shotCooldown.toFixed(4),+drone.stay.toFixed(4),+drone.burst.toFixed(4),drone.echoLane,+drone.echoCool.toFixed(4)],tu:JSON.stringify(turrets),ef:JSON.stringify(effects),
    en:enemies.map(e=>[e.type,e.lane,+e.y.toFixed(3),+e.hp.toFixed(3)])}));
  if(phase==='finish')break;}
 Math.random=real;return out;};0`;
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||(m.type()==='warning'&&/2\.5D/.test(m.text())))errs.push(m.text().slice(0,200));});
 await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:20000});
 await p.evaluate(r=>window.__t(r),RUN);
 await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});await p.waitForTimeout(400); // 게임의 화면 루프를 세운다
 // 실제 화면 루프가 게임을 진행시키지 않게 멈춘 채, 묶음 단위로 직접 진행한다
 const run=async(draw)=>{await p.evaluate(d=>{window.__t('paused=true;G3.active='+d+';');window.__it=window.__mk(d);},draw);
  for(;;){const r=await p.evaluate(()=>{const x=window.__it.next();return x.done?x.value:null;});if(r)return r;}};
 const a1=await run(false),a2=await run(false);
 await p.evaluate(()=>window.__t("G3.active=true;$('field').classList.add('r3d-on');"));
 const b1=await run(true);
 const still=await p.evaluate(()=>window.__relay.active);
 const same=(x,y)=>x.length===y.length&&x.every((v,i)=>v===y[i]);
 console.log('ops run:',a1.length,'| last:',a1[a1.length-1].slice(0,160));
 console.log('harness deterministic (no draw twice):',same(a1,a2));
 console.log('3D drawing leaves game state identical:',same(a1,b1),'| 3D still active:',still,'| errors:',errs.length?errs.slice(0,3):'none');
 if(!same(a1,b1)){for(let i=0;i<a1.length;i++)if(a1[i]!==b1[i]){console.log('first difference in op',i+1);console.log(' A',a1[i].slice(0,500));console.log(' B',(b1[i]||'').slice(0,500));break;}}
 await b.close();fs.unlinkSync(f);})();
