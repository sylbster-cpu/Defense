const { chromium } = require('playwright');const out=process.argv[2];
(async()=>{const b=await chromium.launch();let bad=0;const ck=(n,ok,x)=>{console.log((ok?'ok  ':'BAD ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)bad++;};
 for(const [w,h] of [[390,844],[844,390]]){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html?q=0');await p.waitForTimeout(2500);
  const st=()=>p.evaluate(()=>{const t=document.getElementById('title'),v=document.getElementById('titleVid');return{film:t.classList.contains('film'),t:+v.currentTime.toFixed(1),paused:v.paused,loop:v.loop,cap:document.getElementById('titleCap').textContent,menu:getComputedStyle(t.querySelector('.title-body')).display!=='none',skip:getComputedStyle(document.getElementById('skipFilm')).display!=='none'};});
  const a=await st();ck(w+'x'+h+' film plays first, menu hidden, SKIP shown',a.film&&!a.paused&&a.t>1&&!a.menu&&a.skip,a);await p.screenshot({path:out+'/film_'+w+'.png'});
  await p.waitForFunction(()=>!document.getElementById('title').classList.contains('film'),null,{timeout:20000});await p.waitForTimeout(700);
  const e=await st();ck('menu appears when the film ends, film loops behind',!e.film&&e.menu&&!e.skip&&e.loop&&!e.paused,e);await p.screenshot({path:out+'/menu_'+w+'.png'});
  await p.reload();await p.waitForTimeout(1500);await p.click('#skipFilm');await p.waitForTimeout(400);const s2=await st();ck('SKIP goes to the menu',!s2.film&&s2.menu,s2);
  await p.click('#skipBtn');await p.waitForTimeout(600);ck('start works',await p.evaluate(()=>document.getElementById('title').hidden&&window.__relay.phase==='battle'));
  ck('no errors',!errs.length,errs.slice(0,2));await c.close();}
 // 자동 재생이 막힌 경우: play()가 거부되면 재생 단추가 나와야 한다.
 // 막힌 브라우저에서는 autoplay 속성으로도 시작되지 않으므로 속성도 함께 지운다(지우지 않으면 시험용 브라우저가 속성만으로 재생을 시작해 단추가 다시 숨는다).
 const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true});const p=await c.newPage();
 await p.addInitScript(()=>{const real=HTMLMediaElement.prototype.play;let n=0;HTMLMediaElement.prototype.play=function(){if(!window.__gesture)return Promise.reject(new DOMException('blocked','NotAllowedError'));return real.call(this);};window.addEventListener('pointerdown',()=>{window.__gesture=true;},true);new MutationObserver(()=>{const v=document.getElementById('titleVid');if(v&&v.hasAttribute('autoplay'))v.removeAttribute('autoplay');}).observe(document,{childList:true,subtree:true});});
 await p.goto('http://127.0.0.1:8765/index.html?q=0');await p.waitForTimeout(1500);
 ck('blocked autoplay shows the play button and SKIP',await p.isVisible('#filmPlay')&&await p.isVisible('#skipFilm'));await p.screenshot({path:out+'/blocked.png'});
 await p.click('#filmPlay');await p.waitForTimeout(1500);ck('touch starts the film',await p.evaluate(()=>{const v=document.getElementById('titleVid');return !v.paused&&v.currentTime>.5&&document.getElementById('filmPlay').hidden;}));
 await b.close();console.log(bad?`FAIL (${bad})`:'PASS');})();
