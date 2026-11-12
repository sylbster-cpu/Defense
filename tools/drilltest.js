// 훈련(튜토리얼)과 과부하 실전 안내를 실제 터치로 끝까지 진행. node drilltest.js <게임 폴더> <출력 폴더>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
const [dir,out]=process.argv.slice(2);
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^applyPrefs\(\);\nreset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\napplyPrefs();\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook');const f=path.join(dir,'_drill_'+process.pid+'.html');fs.writeFileSync(f,s);fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch();let bad=0;
 for(const [w,h,mode] of [[844,390,''],[390,844,''],[390,844,'2d']]){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/media\//.test(m.text())&&!/ERR_FILE_NOT_FOUND/.test(m.text()))errs.push(m.text().slice(0,160));});
  const T=x=>p.evaluate(x=>window.__t(x),x);const log=[];const tag=w+'x'+h+(mode?'-2d':'');
  await p.goto('file://'+f+(mode?'?2d=1':'?q=1'));if(!mode)await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});else await p.waitForTimeout(600);
  await T('mute=true');await p.screenshot({path:path.join(out,`title_${tag}.png`)});
  const fb={x:4,y:4,width:w-8,height:h-8};const tapLane=l=>w>h?p.touchscreen.tap(fb.x+fb.width/2,fb.y+fb.height*(l?.75:.25)):p.touchscreen.tap(fb.x+fb.width*(l?.75:.25),fb.y+fb.height/2);
  const waitHold=async(need,ms=120000)=>{await p.waitForFunction(n=>window.__relay.hold===n,need,{timeout:ms,polling:150});await p.waitForTimeout(600);return (await T("$('coachTitle').textContent+' | '+$('coachMain').textContent")).slice(0,60);};
  const shot=n=>p.screenshot({path:path.join(out,`${n}_${tag}.png`)});
  try{
   const film=await p.evaluate(()=>document.getElementById('title').classList.contains('film')&&getComputedStyle(document.getElementById('tutorialBtn').parentNode.parentNode).display==='none');log.push('film first: '+film);await p.click('#skipFilm');
   await p.click('#tutorialBtn');log.push(await waitHold('tap'));await shot('d1');await tapLane(0);
   log.push(await waitHold('tap'));await shot('d2');log.push('fac '+await T('JSON.stringify([facilities,core,+stageTime.toFixed(1)])'));
   // 잠긴 조작: 과부하 버튼과 이동이 막혀 있어야 한다
   await tapLane(0);log.push(await waitHold('tap'));await shot('d3');log.push('core '+await T('JSON.stringify([facilities,core,+stageTime.toFixed(1)])'));
   await tapLane(0);log.push(await waitHold('tap'));await tapLane(0);
   log.push(await waitHold('move1'));await shot('d4');const dis=await p.isDisabled('#pulseBtn');if(!dis){bad++;log.push('BAD pulse enabled in drill');}
   await tapLane(0);await p.waitForTimeout(500);if(await T('drone.lane')!==0){bad++;log.push('BAD wrong-lane tap moved');}
   await tapLane(1);await p.waitForTimeout(400);if(await T('drone.lane')!==1){bad++;log.push('BAD move1 failed');}
   log.push(await waitHold('move0'));await shot('d5');await tapLane(0);
   log.push(await waitHold('tap'));log.push('end '+await T('JSON.stringify([facilities,core,+stageTime.toFixed(1)])'));await shot('d6');await tapLane(0);
   await p.waitForFunction(()=>window.__relay.phase==='battle'&&!window.__relay.drill,null,{timeout:20000});log.push('run '+await T('JSON.stringify({op,lesson:lesson&&lesson.st,pulseLock,learned})'));
   // 실전 안내: 과부하
   for(let i=0;i<700;i++){const hh=await p.evaluate(()=>window.__relay.hold);if(/^(move|pulse)/.test(hh))break;
    if(hh==='pick'){await p.waitForTimeout(500);log.push('pick lesson: '+(await T("$('coachTitle').textContent")));await T('takeDrop(drops[0])&&releaseHold();0');}   // 떨어진 아이템을 줍는 안내
    if(hh==='tap'){await p.waitForTimeout(600);log.push('item lesson: '+(await T("$('coachTitle').textContent")));await shot('item');await tapLane(await T('drone.lane'));}   // 아이템 안내가 먼저 나오면 넘긴다
    await p.waitForTimeout(200);}
   await p.waitForTimeout(600);
   const hd=await p.evaluate(()=>window.__relay.hold);log.push('lesson asks '+hd+' at '+await T('stageTime.toFixed(1)')+'s, enemies total '+await T('enemies.length'));
   if(hd.startsWith('move')){await shot('l0');await tapLane(+hd.slice(4));log.push(await waitHold('pulse',20000));}
   await shot('l1');const inR="enemies.filter(e=>e.hp>0&&e.lane===drone.lane&&Math.abs(e.y-DRONE_Y)<effects.pulseRange).length";const n0=await T(inR);
   await p.click('#pulseBtn');await p.waitForTimeout(500);log.push('lesson '+await T('JSON.stringify({inRangeBefore:'+n0+',pc:+drone.pulseCooldown.toFixed(1),learned,pulseLock,lesson})'));
   if(!(await T('learned.pulse&&learned.drill&&!pulseLock&&drone.pulseCooldown>1')))bad++;
   const sc=await p.evaluate(()=>document.documentElement.scrollWidth+'x'+document.documentElement.scrollHeight);if(sc!==w+'x'+h){bad++;log.push('BAD scroll '+sc);}
  }catch(e){bad++;log.push('BAD '+e.message.split('\n')[0]+' | state '+await T('JSON.stringify({phase,hold:holdState&&holdState.need,drill:drill&&drill.step,facilities,core,n:enemies.length,st:+stageTime.toFixed(1)})'));await shot('fail');}
  if(errs.length){bad++;log.push('ERRORS '+errs.slice(0,3).join(' | '));}
  console.log('== '+tag);for(const l of log)console.log('  '+l);await c.close();}
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
