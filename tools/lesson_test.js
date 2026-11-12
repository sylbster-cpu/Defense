// 안내 시험(판 2026.11.12-7): 아이템마다 처음 가졌을 때의 안내, 콤보 안내, 안내 사이 간격, 다음 판에서 다시 나오지 않음. 실제 터치로 안내를 넘긴다.
// node tools/lesson_test.js <게임 폴더 절대 경로>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
const dir=path.resolve(process.argv[2]);
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');
const f=path.join(dir,'_ls_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();let bad=0;const ok=(name,v,info)=>{console.log((v?'ok   ':'FAIL ')+name+(info!==undefined?'  '+info:''));if(!v)bad++;};
 for(const [w,h] of [[844,390],[390,844]]){console.log('== '+w+'x'+h);
  const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+f+'?q=1');await p.waitForTimeout(1200);
  const T=x=>p.evaluate(x=>window.__t(x),x);
  const coach=()=>T("holdState?($('coach').textContent||''):''");
  // waits are in game time: the headless software renderer runs the page well below real time
  const waitHold=async(sec)=>{const s0=+await T('stageTime'),t0=Date.now();while(Date.now()-t0<90000){const c=await coach();if(c)return c;if(+await T('stageTime')-s0>sec)return '';await p.waitForTimeout(100);}return '';};
  const tap=async()=>{const r=await p.evaluate(()=>{const e=document.getElementById('field').getBoundingClientRect();return [e.left+e.width*.3,e.top+e.height*.45];});await p.waitForTimeout(500);await p.touchscreen.tap(r[0],r[1]);await p.waitForTimeout(200);};
  const start=`$('title').hidden=true;mute=true;Object.assign(learned,{drill:true,pulse:true,item:true,items:{},combo:false});for(const m of MAPS)learned.maps[m.id]=true;saveLearned();beginRun();core=100;0`;
  await T(start);
  // 1. an item held for the first time is locked, then explained, then usable
  await T("bag=['chain'];updateControls();useItem(0);0");
  ok('unexplained item cannot be used',await T("bag.length===1&&$('itemBtn').disabled"));
  let t=await waitHold(3);ok('new item lesson comes',t.includes('새 아이템 · 연쇄 번개')&&t.includes('번개'),t.slice(0,60));
  await tap();
  ok('after the lesson the item is usable and remembered',await T("!holdState&&learned.items.chain===true&&!$('itemBtn').disabled&&JSON.parse(localStorage.getItem('relayLearn')).items.chain===true"));
  // 2. the combo lesson at the first refund, LESSON_GAP after the last lesson
  const st0=+await T("stageTime");await T("core=100;for(let i=0;i<COMBO.every;i++)onKill({type:'runner'});0");
  ok('first refund asks for the combo lesson',await T("comboLesson===true"));
  t=await waitHold(8);const st1=+await T("stageTime");
  ok('combo lesson comes',t.startsWith('콤보')&&t.includes('과부하 재충전'),t.slice(0,80));
  ok('it keeps the lesson gap',st1-st0>=3.5,(st1-st0).toFixed(2)+'s');
  await tap();ok('combo learned',await T("learned.combo===true&&comboLesson===false&&!holdState"));
  // 3. two new items at once: one lesson each, one after the other
  await T("bag=['wall','jam'];updateControls();0");
  const a=await waitHold(6);await tap();const b2=await waitHold(6);await tap();
  ok('two new items explained in turn',a.includes('차단벽')&&b2.includes('전파 교란'),a.slice(0,20)+' / '+b2.slice(0,20));
  // 4. a new run: the combo lesson does not come again
  await T("showOverlay(false);beginRun();core=100;bag=[];updateControls();for(let i=0;i<COMBO.every;i++)onKill({type:'runner'});0");
  ok('combo lesson not repeated',await T("comboLesson===false"));
  // 5. the first item lesson of a new player also marks that item
  await T("Object.assign(learned,{item:false,items:{}});bag=['orbital'];updateControls();lessonQuiet=99;0");
  t=await waitHold(4);ok('first item lesson',t.includes('아이템 획득 · 궤도 포격'),t.slice(0,40));await tap();
  const again=await waitHold(5.5);ok('no second lesson for the same item',!again&&await T("learned.item&&learned.items.orbital===true"),again.slice(0,30));
  ok('no page errors',!errs.length,errs.slice(0,2).join(' | '));
  await c.close();}
 await b.close();fs.unlinkSync(f);console.log(bad?'FAIL '+bad:'PASS');})();
