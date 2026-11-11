// node grant_scan.js <게임 폴더> [판 수] : 아이템이 한 판에 몇 번, 어떤 경로로 주어지는지 센다 (판당 평균)
//   chapter = 한 장을 돌파 없이 끝내 생긴 지급 기회(마지막 장 제외), boss = 중간 보스 격파, rare = 레어 적 격파
//   got = 실제로 칸에 들어온 횟수, fired = 칸이 찬 채 레어 적을 잡아 즉시 발동한 횟수, lost = 칸이 차 있어 받지 못한 횟수
// 봇 셋으로 잰다. keep은 아이템을 쓰지 않아 칸이 계속 차 있고, use는 받자마자 써서 칸이 늘 비어 있다. need는 적이 몰리거나 시설이 60 아래일 때 쓴다(bal_scan의 아이템 봇과 같다).
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=path.resolve(process.argv[2]||'.'),N=+process.argv[3]||12;
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');
const f=path.join(dir,'_gs_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 for(const mode of ['keep','need','use']){
  const r=await p.evaluate(c=>window.__t(c),`(function(){mute=true;const N=${N},mode='${mode}',st={chapter:0,boss:0,rare:0,got:0,fired:0,lost:0,used:0,leaks:0,wins:0};
  const g0=grantItem,d0=damageEnemy;let inDmg=0;
  damageEnemy=function(){inDmg++;try{return d0.apply(this,arguments);}finally{inDmg--;}};
  grantItem=function(now){const had=item;if(now)st.rare++;else if(inDmg)st.boss++;else st.chapter++;g0(now);if(!had&&item)st.got++;else if(had&&now)st.fired++;else if(had)st.lost++;};
  for(let run=0;run<N;run++){reset();newStage(1);let fr=0,guard=0;
   while(phase!=='finish'&&guard++<30*900){
    if(phase==='upgrade'){const o=offeredUpgrades;choose(o[(run+upgradeHistory.length)%o.length]);continue;}
    update(1/30);fr++;if(mode==='use'&&item){const id=item;item=null;applyItem(id);st.used++;}
    if(fr%24===0){const c=[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-190).reduce((a,e)=>a+TYPES[e.type].value,0));if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane])switchLane(1-drone.lane);
     const inR=enemies.filter(e=>e.hp>0&&e.lane===drone.lane&&Math.abs(e.y-drone.y)<effects.pulseRange).length;if(drone.pulseCooldown<=.01&&inR>=2)pulse();
     if(mode==='need'&&item&&(c[0]+c[1]>=5||facilities[0]<60||facilities[1]<60)){const id=item;item=null;applyItem(id);st.used++;}}
   }
   st.leaks+=leaks;if(core>0)st.wins++;}
  grantItem=g0;damageEnemy=d0;
  for(const k in st)if(k!=='wins')st[k]=+(st[k]/N).toFixed(2);st.chances=+(st.chapter+st.boss+st.rare).toFixed(2);return JSON.stringify(st);})()`);
  console.log(mode.padEnd(5),r);}
 await b.close();fs.unlinkSync(f);})();
