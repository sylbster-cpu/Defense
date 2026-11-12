// 아이템 밸런스 시험. 봇이 전체 게임을 돌려, 아이템이 한 판에 몇 번 떨어지고 주워지고 쓰이는지와 아이템마다의 효과를 잰다.
// node tools/item_bal.js <게임 폴더 절대 경로> [판 수, 기본 24] [잴 구성만 쉼표로, 예: magnet,turret]
//   none  = 아무것도 떨어지지 않음(기준)        all = 실제 규칙대로(11가지가 같은 확률)
//   <아이템> = 떨어지는 것과 장 끝 보상이 모두 그 아이템      field = 떨어지는 것이 모두 현장 포탑
// 봇: casual은 0.8초마다 판단하고 떨어진 아이템을 1초 뒤에 줍는다. weak는 2초마다 판단하고 2초 뒤에 줍고, 과부하를 3기 이상에만 쓴다.
// 아이템은 쓸모가 있을 때만 쓴다(수리는 시설 70 이하, 자석은 앞선 적이 기체를 50 지나쳤을 때 그 뒤로 범위의 0.8배 지점에, 끌릴 적 2기 이상 등). 값 = 기준 대비 줄어든 돌파 수 ÷ 사용 횟수.
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]),N=+process.argv[3]||24,ONLY=process.argv[4]?process.argv[4].split(','):null;
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');const f=path.join(dir,'_ib_'+process.pid+'.html');fs.writeFileSync(f,s);
const BOT=(force,tick,react,pulseAt)=>`(function(){mute=true;const N=${N},tick=${tick},react=${react},force=${JSON.stringify(force)},st={wins:0,leaks:0,l2:0,core:0,drops:0,field:0,picked:0,expired:0,gifts:0,used:0,held:0};
 const d0=dropItem,g0=giftItem,p0=placeField;
 placeField=function(e){st.field++;p0(e);};
 dropItem=function(e){if(force==='none')return;if(force==='field'){placeField(e);return;}
  if(force!=='all'){drops.push({id:Math.random(),item:force,lane:e.lane,y:Math.max(LANE_TOP+25,Math.min(LEAK_Y-50,e.y)),life:DROP_LIFE});st.drops++;return;}
  const n=drops.length;d0(e);if(drops.length>n)st.drops++;};
 giftItem=function(){if(force==='none'||force==='field')return'';if(force!=='all'){if(bag.length>=BAG_MAX)return'full';bag.push(force);st.gifts++;return force;}const r=g0();if(r&&r!=='full')st.gifts++;return r;};
 function useBag(c,inR){for(let i=0;i<bag.length;i++){const id=bag[i],o=1-drone.lane;let go=false;
   if(id==='repair')go=Math.min(facilities[0],facilities[1])<=70;
   else if(id==='charge')go=drone.pulseCooldown>3&&inR>=2;
   else if(id==='wall'||id==='turret'||id==='clone')go=c[o]>=3;
   else if(id==='jam')go=c[0]+c[1]>=6;
   else if(id==='stim'||id==='pierce'||id==='splash')go=c[drone.lane]>=4;
   else if(id==='chain')go=c[0]+c[1]>=5;
   else if(id==='orbital'){const l=c[1]>c[0]?1:0;if(c[l]>=4){let lead=null;for(const e of enemies)if(e.hp>0&&e.lane===l&&(!lead||e.y>lead.y))lead=e;aim=i;useAim(l,lead?lead.y-20:DRONE_Y);st.used++;return;}}
   else if(id==='magnet'){   // drag the leading group back: the lane whose foremost machine has passed the drone, a place 0.8 of the magnet's reach behind it, at least two machines to move
    let lead=null;for(const e of enemies)if(e.hp>0&&e.type!=='boss'&&e.y>DRONE_Y+50&&(!lead||e.y>lead.y))lead=e;
    if(lead){const y0=lead.y-MAG.range*.8;let n=0;for(const e of enemies)if(e.hp>0&&e.lane===lead.lane&&e.type!=='boss'&&Math.abs(e.y-y0)<=MAG.range)n++;if(n>=2){aim=i;useMagnet(lead.lane,y0);st.used++;return;}}}
   if(go){bag.splice(i,1);applyItem(id);st.used++;return;}}}
 for(let run=0;run<N;run++){reset();newStage(1);let fr=0,guard=0;
  while(phase!=='finish'&&guard++<30*1200){
   if(phase==='upgrade'){const o=offeredUpgrades;choose(o[(run+upgradeHistory.length)%o.length]);continue;}
   for(const d of drops)if(d.life<=1/30)st.expired++;
   update(1/30);fr++;
   for(const d of drops.slice())if(DROP_LIFE-d.life>=react&&bag.length<BAG_MAX&&takeDrop(d))st.picked++;
   if(fr%tick===0){const c=[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-190&&!map.cover(e.lane,e.y)).reduce((a,e)=>a+TYPES[e.type].value,0));
    if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane])switchLane(1-drone.lane);
    const inR=enemies.filter(e=>e.hp>0&&(e.lane===drone.lane||map.near(e.y))&&!map.cover(e.lane,e.y)&&Math.abs(e.y-drone.y)<effects.pulseRange).length;
    useBag(c,inR);if(drone.pulseCooldown<=.01&&inR>=${pulseAt})pulse();}
  }
  st.leaks+=leaks;st.l2+=leaks*leaks;st.core+=core;st.held+=bag.length;if(core>0&&op===TOTAL_OPS)st.wins++;}
 dropItem=d0;giftItem=g0;placeField=p0;st.se=Math.sqrt(Math.max(0,st.l2/N-(st.leaks/N)*(st.leaks/N))/N);for(const k in st)if(k!=='wins'&&k!=='se')st[k]=st[k]/N;return JSON.stringify(st);})()`;
const ITEMS=['wall','repair','charge','turret','jam','clone','stim','pierce','splash','magnet','chain','orbital'];
const CONF=['none','all','field',...ITEMS].filter(c=>c==='none'||!ONLY||ONLY.includes(c));const JOBS=[];for(const [bot,tick,react,pulseAt] of [['casual',24,1,2],['weak',60,2,3]])for(const force of CONF)JOBS.push({bot,tick,react,pulseAt,force});
(async()=>{const b=await chromium.launch();const res={};let next=0;
 const worker=async()=>{const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  while(next<JOBS.length){const j=JOBS[next++];res[j.bot+'/'+j.force]=JSON.parse(await p.evaluate(c=>window.__t(c),BOT(j.force,j.tick,j.react,j.pulseAt)));}await p.close();};
 await Promise.all([worker(),worker(),worker(),worker()]);await b.close();fs.unlinkSync(f);
 for(const bot of ['casual','weak']){const base=res[bot+'/none'];console.log(`\n봇 ${bot} · ${N}판 평균`);
  console.log('구성      승      돌파 (±)  송신소  떨어짐 현장포탑 주움  놓침  장끝  사용  남김   돌파 차  사용당   (돌파 차의 오차 ±'+(Math.SQRT2*base.se).toFixed(2)+')');
  for(const force of CONF){const r=res[bot+'/'+force],d=base.leaks-r.leaks,per=r.used>0?d/r.used:(force==='field'&&r.field>0?d/r.field:NaN);
   console.log(force.padEnd(8),String(r.wins).padStart(3)+'/'+N,r.leaks.toFixed(2).padStart(6),('±'+r.se.toFixed(2)).padStart(6),r.core.toFixed(0).padStart(6),r.drops.toFixed(1).padStart(7),r.field.toFixed(1).padStart(7),r.picked.toFixed(1).padStart(6),r.expired.toFixed(1).padStart(5),r.gifts.toFixed(1).padStart(5),r.used.toFixed(1).padStart(5),r.held.toFixed(1).padStart(5),(d>=0?'+':'')+d.toFixed(2).padStart(7),isNaN(per)?'      -':per.toFixed(2).padStart(7));}}
 fs.writeFileSync(path.join(process.cwd(),'item_bal.json'),JSON.stringify({N,res},null,1));})();
