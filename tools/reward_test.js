// 장 단위 아이템 보상 판정과 안내 간격 확인. node reward_test.js <게임 폴더>
// 화면을 그리지 않고 규칙만 돌린다(2D 비상 화면, 시계는 시험이 직접 돌림).
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]||'.');
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');
const f=path.join(dir,'_rw_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));let bad=0;
 const ck=(n,ok,x)=>{console.log((ok?'ok  ':'BAD ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)bad++;};
 const T=x=>p.evaluate(x=>window.__t(x),x);
 await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 // 난수를 고정해 레어 적이 나오지 않게 한다. 지급을 센다. play(sec): 실제 진행처럼 안내와 규칙을 번갈아 돌린다.
 await T(`mute=true;$('title').hidden=true;$('titleVid').pause();Math.random=()=>.5;window.__g=[];const g0=giftItem;giftItem=function(){const r=g0();window.__g.push([op,wave,+stageTime.toFixed(2),r]);return r;};
  window.__play=function(sec){for(let i=0;i<Math.round(sec*30);i++){if(holdState)return i/30;lessonTick(1/30);if(holdState)return i/30;update(1/30);}return -1;};0`);

 // 1. 한 장(공격 세 번)을 돌파 없이 끝내면 장 끝에 한 번 보관 칸으로 지급한다. 공격이 넘어가는 순간이나 한 공격을 다 막은 순간에는 지급하지 않는다.
 await T('learned.item=true;learned.pulse=true;reset();newStage(1);window.__g.length=0;while(phase==="battle"){update(1/30);for(const e of enemies)damageEnemy(e,1e6,0,0,"drone");}0');
 ck('돌파 없는 장: 장 끝에 한 번만 지급',await T('phase==="upgrade"&&window.__g.length===1&&bag.length===1&&stageGift===bag[0]'),await T('JSON.stringify({grants:window.__g,bag,stageGift})'));
 ck('강화 화면에 받은 아이템이 나온다',await T('$("overlayContent").textContent.includes("돌파 없이 방어 · 아이템 획득: "+ITEMS[bag[0]].name)'));
 // 2. 한 번이라도 넘어가면 그 장의 보상은 없다.
 await T('reset();newStage(1);window.__g.length=0;let hit=false;while(phase==="battle"){update(1/30);for(const e of enemies){if(!hit){hit=true;e.y=LEAK_Y-1;}else damageEnemy(e,1e6,0,0,"drone");}}0');
 ck('돌파가 있었던 장은 지급하지 않는다',await T('phase==="upgrade"&&leaks===1&&window.__g.length===0&&bag.length===0&&stageGift===""'),await T('JSON.stringify({leaks,grants:window.__g,stageGift})'));
 ck('그때는 강화 화면에 보상 줄이 없다',await T('!$("overlayContent").textContent.includes("돌파 없이 방어")'));
 // 3. 보관 칸 둘이 다 차 있으면 받지 못하고, 강화 화면이 그 사실을 알린다.
 await T('reset();newStage(1);bag=["wall","jam"];window.__g.length=0;while(phase==="battle"){update(1/30);for(const e of enemies)damageEnemy(e,1e6,0,0,"drone");}0');
 ck('보관 칸이 가득 차 있으면 받지 못한다',await T('phase==="upgrade"&&bag.join()==="wall,jam"&&stageGift==="full"&&$("overlayContent").textContent.includes("보관 칸이 가득 차 보상을 받지 못했습니다")'),await T('JSON.stringify({bag,stageGift})'));
 // 4. 다음 장은 새로 판정한다. 보관한 아이템은 다음 장으로 넘어간다. 마지막 장 끝에는 지급하지 않는다.
 await T('choose(offeredUpgrades[0]);0');ck('다음 장은 새로 판정하고 보관한 아이템은 남는다',await T('op===2&&stageHurt===false&&bag.length===2'));
 await T('reset();newStage(TOTAL_OPS);window.__g.length=0;while(phase==="battle"){update(1/30);for(const e of enemies)damageEnemy(e,1e6,0,0,"drone");}0');
 ck('마지막 장 끝에는 지급하지 않는다',await T('phase==="finish"&&window.__g.length===0&&bag.length===0'),await T('JSON.stringify({phase,grants:window.__g})'));
 ck('레어 비율',await T('RARE_P===.015'),await T('RARE_P'));

 // 5. 안내는 한 번에 하나, 사이에 LESSON_GAP초의 진행을 둔다. 보관 칸은 안내 전까지 잠긴다.
 await T('learned.maps={};learned.item=false;learned.pulse=true;beginRun();newStage(2);liveRun=true;bag=["wall"];pattern=[[1e9,0,"runner"]];nextSpawn=0;updateControls();0');
 const t1=await T('__play(3)');
 ck('장 시작: 새 지형 안내가 먼저',await T('!!holdState&&$("coachTitle").textContent.startsWith("새 지형")'),{after:t1,title:await T('$("coachTitle").textContent')});
 await T('releaseHold();0');const t2=await T('__play(3.8)');
 ck('지형 안내 직후에는 아이템 안내가 나오지 않는다',t2===-1&&await T('!holdState'),{t2});
 await T('useItem(0);updateControls();0');
 ck('안내 전에는 보관 칸이 잠겨 있다',await T('bag.join()==="wall"&&$("itemBtn").disabled===true'));
 const t3=await T('__play(1)');
 ck('간격이 지나면 아이템 안내',t3>=0&&await T('!!holdState&&$("coachTitle").textContent.startsWith("아이템 획득")'),{gap:+(3.8+t3).toFixed(2),need:await T('LESSON_GAP')});
 await T('releaseHold();updateControls();0');
 ck('안내 뒤에는 아이템을 쓸 수 있다',await T('learned.item===true&&$("itemBtn").disabled===false')&&await T('useItem(0);bag.length===0&&aid.wall>0'));

 // 6. 과부하 안내와 아이템 안내가 겹칠 때: 과부하가 먼저, 아이템은 간격 뒤.
 await T('learned.maps={};learned.item=false;learned.pulse=false;beginRun();pattern=[[1e9,0,"runner"]];nextSpawn=0;__play(8.2);bag=["jam"];for(let i=0;i<3;i++){spawn(0,"brute");enemies[i].y=DRONE_Y-60+i*30;enemies[i].hp=enemies[i].maxHp=1e6;}0');
 await T('__play(1)');
 ck('둘이 겹치면 과부하 안내가 먼저',await T('!!holdState&&holdState.need==="pulse"'),await T('holdState&&holdState.need'));
 await p.waitForTimeout(450);await T('pulse();0');const t4=await T('__play(3.8)');   // 안내가 뜬 직후 0.35초는 입력을 받지 않는다
 ck('과부하 안내 직후에는 아이템 안내가 나오지 않는다',t4===-1&&await T('learned.pulse===true&&!holdState'),{t4});
 await T('__play(1)');
 ck('간격 뒤에 아이템 안내',await T('!!holdState&&$("coachTitle").textContent.startsWith("아이템 획득")'),await T('$("coachTitle").textContent'));
 ck('no errors',!errs.length,errs.slice(0,2));
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
