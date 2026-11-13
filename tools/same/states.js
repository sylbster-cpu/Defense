// 동일성 확인 도구의 공통 부분: 가짜 시계(시간, 타이머, 애니메이션 프레임을 모두 도구가 넘긴다)를 넣은 채 판을 열고, 이름 붙은 화면 상태로 만든다.
// ui.js, frames.js, touch.js가 쓴다. 상태 목록(STATES)과 화면 크기 목록(VIEWPORTS)이 여기 있다. 화면을 새로 만들면 여기에 그 상태를 더한다.
const path=require('path'),fs=require('fs'),cov=require('./cov.js');
const INIT=`(()=>{let now=10000,tid=1,timers=[];const raf=[];
 const mk=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 window.__mk=mk;Math.random=mk(4242);
 window.__clock={get now(){return now;},step(ms){now+=ms;for(;;){timers.sort((a,b)=>a.t-b.t||a.id-b.id);if(!timers.length||timers[0].t>now)break;timers.shift().f();}const q=raf.splice(0);for(const g of q)g(now);}};
 performance.now=()=>now;Date.now=()=>1700000000000+now;
 window.requestAnimationFrame=g=>{raf.push(g);return raf.length;};window.cancelAnimationFrame=()=>{};
 window.setTimeout=(g,ms)=>{const id=tid++;timers.push({t:now+(+ms||0),f:g,id});return id;};window.clearTimeout=id=>{timers=timers.filter(k=>k.id!==id);};
 try{localStorage.clear();}catch(e){}
})();`;
// helpers living inside the game's scope
const HELP=`window.__ui={
 base(){mute=true;best=0;try{localStorage.clear();}catch(e){}
  Object.assign(learned,{drill:true,pulse:true,item:true,combo:true});MAPS.forEach(m=>learned.maps[m.id]=true);Object.keys(ITEMS).forEach(k=>learned.items[k]=true);
  if(settingsOpen)closeSettings();holdState=null;drill=null;hideCoach();$('coach').classList.remove('hold','done');showOverlay(false);$('toast').classList.remove('show');$('toast').textContent='';
  Object.assign(prefs,{speed:1,vib:true,bright:100,vol:100,bgm:false});applyPrefs();Math.random=__mk(9001);$('titleVid').pause();$('title').hidden=true;$('filmPlay').hidden=true;$('titleCap').textContent='';paused=false;aim=-1;},
 run(n){const a=G3.active;G3.active=false;for(let i=0;i<n;i++)__clock.step(1000/30);G3.active=a;__clock.step(1000/30);},
 battle(ch,frames){leaveTitle();beginRun();if(ch>1){newStage(ch);updateControls();}this.run(frames||240);},
 untilHold(max){for(let i=0;i<(max||900)&&!holdState;i++)this.run(1);return holdState?holdState.need:'';},
 upgrade(ch,o){leaveTitle();reset();newStage(ch);for(let i=0;i<60*18;i++)update(1/60);score=12340;bestCombo=27;Object.assign(upgradeRanks,o.ranks||{});stageHurt=!!o.hurt;bag=o.bag||[];stageGift=stageHurt?'':giftItem();upgradeScreen();this.run(2);},
 finish(win,o){leaveTitle();reset();newStage(win?TOTAL_OPS:4);for(let i=0;i<60*10;i++)update(1/60);stars=win?[3,3,2,3,3,2,3,3,3,2,3]:[3,2,1];score=o.score;best=o.best;bestCombo=41;kills=812;leaks=9;core=win?86:0;finish(win);this.run(70);}
};0`;
// name -> code run inside the game's scope after __ui.base(); `post` runs after a real-time wait (media promises settle)
const STATES={
 title_film:{code:`filmDone=false;learned.drill=false;intro();`,post:`$('titleVid').pause();$('filmPlay').hidden=true;$('titleCap').textContent='두 개의 전선';`},
 title_film_play:{code:`filmDone=false;learned.drill=false;intro();`,post:`$('titleVid').pause();$('filmPlay').hidden=false;$('titleCap').textContent='';`},
 title_menu:{code:`filmDone=true;learned.drill=false;intro();`,post:`$('titleVid').pause();$('filmPlay').hidden=true;`},
 title_menu_learned:{code:`filmDone=true;learned.drill=true;prefs.bgm=true;intro();`,post:`$('titleVid').pause();$('filmPlay').hidden=true;`},
 title_settings:{code:`filmDone=true;learned.drill=true;intro();openSettings();`,post:`$('titleVid').pause();$('filmPlay').hidden=true;`},
 drill_first:{code:`leaveTitle();startDrill();__ui.untilHold();`},
 drill_move:{code:`leaveTitle();startDrill();for(let k=0;k<12;k++){const n=__ui.untilHold();if(!n||n.slice(0,4)==='move')break;__ui.run(20);releaseHold();}`},
 battle:{code:`__ui.battle(1);`},
 battle_ch7:{code:`__ui.battle(7,300);`},
 battle_items:{code:`__ui.battle(3);bag=['chain','orbital'];updateControls();useItem(1);`},
 battle_locked:{code:`__ui.battle(2);learned.item=false;bag=['wall'];updateControls();`},
 battle_danger:{code:`__ui.battle(4);core=18;facilities=[0,35];updateUI();updateControls();showToast('발전소 기능 정지 · 기체 이동 느려짐',1e9);`},
 battle_cooling:{code:`__ui.battle(5,420);drone.pulseCooldown=0;const e=enemies.find(q=>q.hp>0);if(e){drone.lane=e.lane;drone.x=LANES[e.lane];e.y=drone.y-20;}pulse();__ui.run(3);`},
 battle_2x:{code:`prefs.speed=2;applyPrefs();__ui.battle(6);`},
 battle_paused:{code:`__ui.battle(2);paused=true;updateControls();__ui.run(1);`},
 lesson_map:{code:`__ui.battle(8,30);hold('tap','새 지형 · '+map.name,map.rule+'.',null,()=>{});`},
 lesson_pulse:{code:`__ui.battle(1,300);pulseLock=false;drone.pulseCooldown=0;hold('pulse','과부하 방출','적이 한꺼번에 몰려왔습니다. 사격만으로는 막기 어렵습니다. 오른쪽 아래 ✳ 버튼을 눌러 점선 범위 안의 적을 한꺼번에 공격하세요.','✳ 버튼',()=>{});`},
 lesson_move:{code:`__ui.battle(1,300);hold('move1','적 밀집','아래쪽 전선에 적이 한꺼번에 몰렸습니다. 전장의 아래쪽을 터치해 기체를 옮기세요.','전장 아래쪽 터치',()=>{});`},
 lesson_pick:{code:`__ui.battle(3,200);hold('pick','아이템이 떨어졌습니다','부서진 적이 아이템을 남겼습니다. 5초가 지나면 사라집니다. 전장의 아이템을 터치해 주우세요.','아이템 터치',()=>{});`},
 lesson_combo:{code:`__ui.battle(2,200);bag=['magnet'];updateControls();hold('tap','콤보','적을 '+COMBO.t+'초 안에 잇달아 부수면 콤보가 이어집니다. 콤보가 높을수록 격파 점수가 커지고(최대 3배), '+COMBO.every+'콤보마다 과부하 재충전이 '+COMBO.refund+'초 줄어듭니다. '+COMBO.t+'초 동안 부수지 못하거나 적이 방어선을 넘으면 끊깁니다.',null,()=>{});showToast('15 콤보 · 과부하 2초 충전',1e9);`},
 coach_done:{code:`__ui.battle(1,60);setCoach('훈련 2 · 전선 이동','잘 막았습니다.','',true);`},
 settings:{code:`__ui.battle(2);openSettings();`},
 settings_alt:{code:`__ui.battle(2);prefs.speed=2;prefs.vib=false;prefs.bright=130;prefs.vol=40;openSettings();`},
 upgrade_gift:{code:`__ui.upgrade(3,{ranks:{stable:2}});`},
 upgrade_full:{code:`__ui.upgrade(5,{ranks:{stable:1,precision:1,emergency:1,rubble:1},bag:['wall','jam']});`},
 upgrade_hurt:{code:`__ui.upgrade(9,{ranks:{stable:4,precision:3,emergency:1},hurt:true});`},
 upgrade_cap:{code:`__ui.upgrade(11,{ranks:{stable:4,precision:4,emergency:4,rubble:4}});`},
 finish_win:{code:`__ui.finish(true,{score:48210,best:60000});`},
 finish_record:{code:`__ui.finish(true,{score:48210,best:100});`},
 finish_lose:{code:`__ui.finish(false,{score:5210,best:60000});`},
};
const VIEWPORTS=['320x568','360x640','390x844','430x932','540x720','768x1024','480x320','568x320','560x250','667x375','700x318','844x390','932x430','1024x500','1024x768','1280x720','1440x900'];
function hooked(dir,tag){let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
 if(!s.includes('__t'))throw new Error('hook line not found in index.html');const f=path.join(dir,'_same_'+tag+'_'+process.pid+'.html');fs.writeFileSync(f,s);process.on('exit',()=>{try{fs.unlinkSync(f);}catch(e){}});return f;}
// opens one page of a build at a viewport; mode '3d' (?q=1) or '2d' (?2d=1)
async function open(browser,file,vp,mode){const [w,h]=vp.split('x').map(Number);const c=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:1});await c.addInitScript(INIT);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await cov.start(p);{const close=c.close.bind(c);c.close=async(...a)=>{await cov.stop(p);return close(...a);};}   // COVRAW: which code ran (cov.js)
 await p.goto('file://'+file+(mode==='3d'?'?q=1':'?2d=1'),{timeout:180000,waitUntil:'domcontentloaded'});
 if(mode==='3d'){let ok=false;for(let i=0;i<900&&!ok;i++){await p.waitForTimeout(100);ok=await p.evaluate(()=>!!(window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active));}if(!ok)throw new Error('2.5D view did not start at '+vp);}
 else await p.waitForTimeout(250);
 await p.evaluate(()=>Promise.all(['BHS','TDISP','TMONO'].map(f=>document.fonts.load('16px "'+f+'"','가A1'))));
 await p.evaluate(h=>window.__t(h),HELP);p.__errs=errs;return p;}
async function enter(p,name){const st=STATES[name];if(!st)throw new Error('no state '+name);
 await p.evaluate(c=>window.__t('__ui.base();'+c+';0'),st.code);
 if(st.post){await p.waitForTimeout(250);await p.evaluate(c=>window.__t(c+';0'),st.post);}
 await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>{window.__t('fitDialog()');for(const a of document.getAnimations()){try{a.finish();}catch(e){try{a.pause();a.currentTime=0;}catch(e2){}}}});}
module.exports={INIT,STATES,VIEWPORTS,hooked,open,enter};
