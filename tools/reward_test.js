// 공격별 아이템 보상 판정과 안내 간격 확인. node reward_test.js <게임 폴더>
// 화면을 그리지 않고 규칙만 돌린다(2D 비상 화면, 시계는 시험이 직접 돌림).
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]||'.');
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');
const f=path.join(dir,'_rw_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));let bad=0;
 const ck=(n,ok,x)=>{console.log((ok?'ok  ':'BAD ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)bad++;};
 const T=x=>p.evaluate(x=>window.__t(x),x);
 await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 // 난수를 고정해 레어 적이 나오지 않게 한다. 지급을 센다. hold(sec): 적을 죽지도 넘지도 못하게 붙잡은 채 시간을 보낸다. play(sec): 실제 진행처럼 안내와 규칙을 번갈아 돌린다.
 await T(`mute=true;$('title').hidden=true;$('titleVid').pause();Math.random=()=>.5;window.__g=[];const g0=grantItem;grantItem=function(now){window.__g.push([op,wave,+stageTime.toFixed(2)]);g0(now);};
  window.__hold=function(until){while(stageTime<until){update(1/30);for(const e of enemies){e.hp=e.maxHp;e.y=Math.min(e.y,200);}}};
  window.__kill=function(w){for(const e of enemies)if(e.w===w)damageEnemy(e,1e6,0,0,'drone');update(1/30);};
  window.__play=function(sec){for(let i=0;i<Math.round(sec*30);i++){if(holdState)return i/30;lessonTick(1/30);if(holdState)return i/30;update(1/30);}return -1;};0`);

 // 1. 공격 번호가 시간으로 넘어가도 앞 공격의 적이 남아 있으면 지급하지 않는다. 그 적을 모두 막은 순간 지급한다.
 await T('learned.item=true;learned.pulse=true;reset();newStage(1);window.__g.length=0;__hold(20);0');
 ck('1-2로 넘어간 뒤에도 1-1의 적이 남아 있으면 아직 지급하지 않는다',await T('wave===2&&enemies.some(e=>e.w===1)&&window.__g.length===0&&item===null'),await T('JSON.stringify({wave,left:enemies.filter(e=>e.w===1).length,grants:window.__g})'));
 await T('__kill(1);0');
 ck('1-1의 적을 모두 막으면 그때 지급한다',await T('window.__g.length===1&&item!==null&&waveDone[1]===true'),await T('JSON.stringify(window.__g)'));

 // 2. 그 공격의 적이 하나라도 넘어가면 지급하지 않는다. 다음 공격의 보상에는 영향이 없다.
 await T('reset();newStage(1);window.__g.length=0;__hold(20);const e=enemies.find(e=>e.w===1);e.y=LEAK_Y-1;e.hp=e.maxHp;update(1/30);0');
 ck('1-1의 적이 방어선을 넘었다',await T('leaks===1&&waveHurt[1]===true&&waveHurt[2]===false'));
 await T('__kill(1);0');
 ck('돌파가 있었던 공격은 지급하지 않는다',await T('waveDone[1]===true&&window.__g.length===0&&item===null'),await T('JSON.stringify(window.__g)'));
 await T('while(stageTime<34.5||enemies.some(e=>e.w===2)){update(1/30);for(const e of enemies)if(e.w===2)damageEnemy(e,1e6,0,0,"drone");else{e.hp=e.maxHp;e.y=Math.min(e.y,200);}}0');
 ck('앞 공격의 돌파는 다음 공격의 보상을 막지 않는다',await T('window.__g.length===1&&waveDone[2]===true&&waveHurt[2]===false&&item!==null'),await T('JSON.stringify(window.__g)'));

 // 3. 돌파 없이 한 장을 끝내면 공격마다 한 번, 모두 세 번 지급한다(칸을 비워 가며 확인).
 await T('reset();newStage(1);window.__g.length=0;while(phase==="battle"){update(1/30);item=null;for(const e of enemies)damageEnemy(e,1e6,0,0,"drone");}0');
 ck('돌파 없는 한 장에서 지급 세 번',await T('phase==="upgrade"&&window.__g.length===3'),await T('JSON.stringify(window.__g)'));
 // 4. 돌파가 있는 채로 끝나면 마지막 공격의 보상도 없다.
 await T('reset();newStage(1);window.__g.length=0;let hit=false;while(phase==="battle"){update(1/30);item=null;for(const e of enemies){if(e.w===3&&!hit){hit=true;e.y=LEAK_Y-1;}else damageEnemy(e,1e6,0,0,"drone");}}0');
 ck('마지막 공격에 돌파가 있으면 장 끝 보상이 없다',await T('phase==="upgrade"&&leaks===1&&window.__g.length===2'),await T('JSON.stringify(window.__g)'));

 // 5. 안내는 한 번에 하나, 사이에 LESSON_GAP초의 진행을 둔다. 아이템 칸은 안내 전까지 잠긴다.
 await T('learned.maps={};learned.item=false;learned.pulse=true;beginRun();newStage(2);liveRun=true;item="wall";pattern=[[1e9,0,"runner"]];nextSpawn=0;updateControls();0');
 const t1=await T('__play(3)');
 ck('장 시작: 새 지형 안내가 먼저',await T('!!holdState&&$("coachTitle").textContent.startsWith("새 지형")'),{after:t1,title:await T('$("coachTitle").textContent')});
 await T('releaseHold();0');const t2=await T('__play(3.8)');
 ck('지형 안내 직후에는 아이템 안내가 나오지 않는다',t2===-1&&await T('!holdState'),{t2});
 await T('useItem();updateControls();0');
 ck('안내 전에는 아이템 칸이 잠겨 있다',await T('item==="wall"&&$("itemBtn").disabled===true'));
 const t3=await T('__play(1)');
 ck('간격이 지나면 아이템 안내',t3>=0&&await T('!!holdState&&$("coachTitle").textContent.startsWith("아이템 획득")'),{gap:+(3.8+t3).toFixed(2),need:await T('LESSON_GAP')});
 await T('releaseHold();updateControls();0');
 ck('안내 뒤에는 아이템을 쓸 수 있다',await T('learned.item===true&&$("itemBtn").disabled===false')&&await T('useItem();item===null&&aid.wall>0'));

 // 6. 과부하 안내와 아이템 안내가 겹칠 때: 과부하가 먼저, 아이템은 간격 뒤.
 await T('learned.maps={};learned.item=false;learned.pulse=false;beginRun();pattern=[[1e9,0,"runner"]];nextSpawn=0;__play(8.2);item="jam";for(let i=0;i<3;i++){spawn(0,"brute");enemies[i].y=DRONE_Y-60+i*30;enemies[i].hp=enemies[i].maxHp=1e6;}0');
 await T('__play(1)');
 ck('둘이 겹치면 과부하 안내가 먼저',await T('!!holdState&&holdState.need==="pulse"'),await T('holdState&&holdState.need'));
 await p.waitForTimeout(450);await T('pulse();0');const t4=await T('__play(3.8)');   // 안내가 뜬 직후 0.35초는 입력을 받지 않는다
 ck('과부하 안내 직후에는 아이템 안내가 나오지 않는다',t4===-1&&await T('learned.pulse===true&&!holdState'),{t4});
 await T('__play(1)');
 ck('간격 뒤에 아이템 안내',await T('!!holdState&&$("coachTitle").textContent.startsWith("아이템 획득")'),await T('$("coachTitle").textContent'));
 ck('no errors',!errs.length,errs.slice(0,2));
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
