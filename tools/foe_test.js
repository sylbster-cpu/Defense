// 변종 적 시험(판 2026.11.13-6, 23장): 일정표의 변종 배정, 방패형(과부하 감소·감전은 그대로·다리에서 안 떨어짐), 분열형(조각 둘, 장갑, 떨어지면 안 갈라짐,
// 조각이 다 부서져야 장이 끝남), 수리형(같은 전선·범위·거대 병기 제외·자기 제외), 첫 등장 안내와 기억, 정찰 글, 2.5D·2D 그리기 오류 없음.
// node tools/foe_test.js <게임 폴더 절대 경로> [출력 폴더(화면 사진, 생략 가능)]
const { chromium } = require('playwright');const {hooked,inGame,checks}=require('./lib.js');const path=require('path'),fs=require('fs');
const dir=path.resolve(process.argv[2]),out=process.argv[3]?path.resolve(process.argv[3]):null;if(out)fs.mkdirSync(out,{recursive:true});
const f=hooked(dir,'foe');
const PUT="const put=(lane,type,y,o)=>{const m=TYPES[type];const e=Object.assign({id:Math.random(),lane,type,x:LANES[lane],y,py:y,hp:m.hp,maxHp:m.hp,speed:0,slow:0,stun:0,flash:0,wiggle:0,wv:1},o||{});enemies.push(e);return e;};";
const START=ch=>`reset();liveRun=true;newStage(${ch});phase='battle';pattern=[[1e9,0,'runner']];nextSpawn=0;enemies=[];drone.y=DRONE_Y;holdState=null;hideCoach();`;
const LEARN="mute=true;$('title').hidden=true;$('titleVid').pause();learned.drill=learned.item=learned.pulse=learned.combo=true;for(const m of MAPS)learned.maps[m.id]=true;for(const k in ITEMS)learned.items[k]=true;";
(async()=>{const b=await chromium.launch();const {ck,end}=checks();
 {const p=await b.newPage({viewport:{width:844,height:390}});const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(400);
  const T=inGame(p);await T(LEARN+"learned.foes={shield:true,split:true,medic:true};0");
  // the schedule: which chapters carry which variants
  const cnt=JSON.parse(await T("JSON.stringify(Array.from({length:TOTAL_OPS},(_,i)=>{const c={shield:0,split:0,medic:0};for(const ev of stages[i+1])if(ev[3])c[ev[3]]++;return c;}))"));
  const first=k=>cnt.findIndex(c=>c[k]>0)+1;
  ck('variants start at chapter 4 (shield), 6 (split), 9 (medic) and stay after',first('shield')===4&&first('split')===6&&first('medic')===9&&cnt.slice(3).every(c=>c.shield>0)&&cnt.slice(5).every(c=>c.split>0)&&cnt.slice(8).every(c=>c.medic>0),cnt.map((c,i)=>(i+1)+':'+c.shield+'/'+c.split+'/'+c.medic).join(' '));
  const kinds=JSON.parse(await T("JSON.stringify(Object.values(stages).flat().filter(ev=>ev[3]).map(ev=>ev[2]+':'+ev[3]).filter((v,i,a)=>a.indexOf(v)===i))"));
  ck('shields and medics are medium machines, split machines large',kinds.sort().join()==='brute:split,grunt:medic,grunt:shield',kinds);
  // shield
  const sh=JSON.parse(await T(`(()=>{${PUT}${START(5)}const a=put(drone.lane,'grunt',DRONE_Y-30,{hp:900,maxHp:900,kind:'shield'}),n=put(drone.lane,'grunt',DRONE_Y-20,{hp:900,maxHp:900});
   drone.pulseCooldown=0;pulse();const ps=[900-a.hp,900-n.hp];const h0=a.hp;damageEnemy(a,19,0,0,'drone');const dr=h0-a.hp;const h1=a.hp;damageEnemy(a,15,0,0,'shock');return JSON.stringify({ps,dr,shock:h1-a.hp,p:FOE.shield.pulse});})()`));
  ck('shield: the overload does a quarter, shots and the water shock do full damage',Math.abs(sh.ps[0]-sh.ps[1]*sh.p)<.01&&sh.dr===19&&sh.shock===15,sh);
  const br=JSON.parse(await T(`(()=>{${PUT}const ch=MAP_OF.findIndex(i=>MAPS[i].id==='bridge');${START('ch')}const y=(BRIDGE[0]+BRIDGE[1])/2;const a=put(drone.lane,'grunt',Math.max(y,DRONE_Y-60),{kind:'shield',hp:900,maxHp:900}),n=put(drone.lane,'grunt',Math.max(y,DRONE_Y-60)+5,{hp:900,maxHp:900});
   drone.pulseCooldown=0;pulse();return JSON.stringify({shieldFell:!!a.fell,shieldHp:a.hp,plainFell:!!n.fell,inZone:map.fall(a.lane,a.y)});})()`));
  ck('shield: the overload does not knock it off a bridge (an ordinary medium machine falls)',br.inZone&&!br.shieldFell&&br.shieldHp>0&&br.plainFell,br);
  // split
  const sp=JSON.parse(await T(`(()=>{${PUT}${START(7)}nextSpawn=pattern.length;const e=put(0,'brute',300,{kind:'split',hp:5,maxHp:500,wv:2});damageEnemy(e,99,0,0,'drone');const before=enemies.filter(q=>q.hp>0).length;
   update(1/60);const kids=enemies.filter(q=>q.hp>0&&q.type==='runner');const full=Math.round(TYPES.runner.hp*OP_HP[7]*HP_SCALE);
   return JSON.stringify({before,kids:kids.length,ys:kids.map(q=>Math.round(q.y)),hp:kids.map(q=>q.maxHp),expect:Math.round(full*FOE.split.hp),wv:kids.map(q=>q.wv),rare:kids.some(q=>q.rare),phase});})()`));
  ck('split: destroyed, it breaks into two small machines where it stood, with 60% hull, same attack, never rare',sp.before===0&&sp.kids===2&&sp.ys.every(y=>Math.abs(y-300)<=8)&&sp.hp.every(h=>h===sp.expect)&&sp.wv.every(w=>w===2)&&!sp.rare,sp);
  ck('split: the chapter is not over while the pieces are on the field',sp.phase==='battle',sp.phase);
  const sf=JSON.parse(await T(`(()=>{${PUT}${START(7)}const e=put(0,'brute',300,{kind:'split',hp:5,maxHp:500});e.fell=true;damageEnemy(e,99,0,0,'fall');update(1/60);return JSON.stringify({kids:enemies.filter(q=>q.hp>0).length});})()`));
  ck('split: a machine that fell off a bridge does not break apart',sf.kids===0,sf);
  // medic
  const md=JSON.parse(await T(`(()=>{${PUT}${START(4)}turrets=[];drone.shotCooldown=1e9;const m=put(1,'grunt',300,{kind:'medic',hp:50,maxHp:100}),near=put(1,'grunt',300+FOE.medic.r-5,{hp:50,maxHp:100}),far=put(1,'grunt',300+FOE.medic.r+10,{hp:50,maxHp:100}),
   other=put(0,'grunt',300,{hp:50,maxHp:100}),boss=put(1,'boss',290,{hp:50,maxHp:100});for(const e of enemies)e.speed=0;for(let i=0;i<30;i++)update(1/30);
   return JSON.stringify({self:m.hp,near:+near.hp.toFixed(1),far:far.hp,other:other.hp,boss:boss.hp,expect:50+100*FOE.medic.rate*1});})()`));
  ck('medic: repairs its lane within reach (10% a second), not itself, not the other lane, not beyond reach, not a boss',Math.abs(md.near-md.expect)<1.5&&md.self===50&&md.far===50&&md.other===50&&md.boss===50,md);
  // lesson and scouting
  const ls=JSON.parse(await T(`(()=>{${PUT}learned.foes={};${START(4)}lessonQuiet=99;stageTime=5;const e=put(0,'grunt',200,{kind:'shield'});lessonTick(1/30);const a={hold:holdState&&holdState.need,title:$('coachTitle').textContent,main:$('coachMain').textContent};
   releaseHold();lessonQuiet=99;lessonTick(1/30);return JSON.stringify({a,again:!!holdState,learned:learned.foes});})()`));
  ck('a variant is explained the first time it is in view, once',ls.a.hold==='tap'&&ls.a.title==='새 적 · 방패형'&&ls.a.main.includes('75%')&&!ls.again&&ls.learned.shield===true,ls);
  const sc=await T(`(()=>{${START(8)}enemies=[];nextSpawn=pattern.length;stageHurt=true;update(1/30);return document.querySelector('.scout').textContent;})()`);
  ck('scouting names the variants of the next chapter',/변종 · 방패형 \d+ · 분열형 \d+ · 수리형 \d+/.test(sc),sc);
  // the 2D canvases draw every variant
  await T(`(()=>{${PUT}showOverlay(false);${START(10)}put(0,'grunt',250,{kind:'shield'});put(0,'brute',300,{kind:'split'});put(1,'grunt',260,{kind:'medic'});put(1,'grunt',300,{healT:.2});})()`);
  await p.waitForTimeout(400);if(out)await p.screenshot({path:path.join(out,'foe_2d.png')});
  ck('no page errors (2D)',!errs.length,errs.slice(0,3));await p.close();}
 // 2.5D: every variant and a repair glow draw without errors, landscape and portrait
 for(const [w,h] of [[844,390],[390,844]]){const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning'&&/units\.js|hud\.js/.test(m.text()))errs.push(m.text());});
  await p.goto('file://'+f+'?q=2');try{await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay&&window.__relay.active,null,{timeout:10000});}catch(e){errs.push('2.5D did not start');}
  const T=inGame(p);await T(LEARN+`learned.foes={shield:true,split:true,medic:true};${START(10)}spawn(0,'grunt','shield');enemies[0].y=220;spawn(0,'brute','split');enemies[1].y=280;spawn(1,'grunt','medic');enemies[2].y=240;spawn(1,'grunt');enemies[3].y=270;enemies[3].hp=30;for(const e of enemies)e.speed=3;0`);
  await p.waitForTimeout(1200);if(out)await p.screenshot({path:path.join(out,'foe_3d_'+w+'x'+h+'.png')});
  const st=JSON.parse(await T("JSON.stringify({active:G3.active,heal:enemies.some(e=>e.healT>0)})"));
  ck(`2.5D ${w}x${h}: variants and the repair glow draw without errors`,st.active&&st.heal&&!errs.length,{st,errs:errs.slice(0,2)});await c.close();}
 await b.close();end();})();
