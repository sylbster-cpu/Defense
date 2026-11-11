const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const dir=process.argv[2];   // node grant_scan.js <게임 폴더> : 아이템이 한 판에 몇 번, 어떤 경로로 주어지는지 센다
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
const f=path.join(dir,'_gs.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+f+'?2d=1');await p.waitForTimeout(500);await p.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 const r=await p.evaluate(()=>window.__t(`mute=true;const N=12,st={wave:0,waveAlive:0,waveAliveLeakedLater:0,end:0,rare:0,rareFull:0,boss:0,wins:0,rareSeen:0,waste:{}};const g0=grantItem;let src='';
 grantItem=function(now){ if(now){st.rare++;if(item){st.rareFull++;}} else if(src==='boss')st.boss++; g0(now);};
 for(let run=0;run<N;run++){reset();newStage(1);let fr=0,guard=0,pw=1,pending=null;
  while(phase!=='finish'&&guard++<30*900){
   if(phase==='upgrade'){const o=offeredUpgrades;choose(o[(run+upgradeHistory.length)%o.length]);pw=1;pending=null;continue;}
   const had=item,hurt=waveHurt,alive=enemies.filter(e=>e.hp>0).length,lk=leaks,bossAlive=enemies.some(e=>e.type==='boss'&&e.hp>0&&!e.final);src=bossAlive?'boss':'';
   update(1/30);fr++;
   if(phase==='battle'&&wave!==pw){ if(!hurt){st.wave++;if(alive>0){st.waveAlive++;pending={ids:new Set(enemies.map(e=>e.id)),lk:leaks};}} pw=wave; }
   if(pending&&leaks>pending.lk){st.waveAliveLeakedLater++;pending=null;}
   if(phase!=='battle'&&!hurt&&alive<=1)st.end++;
   if(fr%24===0){const c=[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-190).reduce((a,e)=>a+TYPES[e.type].value,0));if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane])switchLane(1-drone.lane);
    const inR=enemies.filter(e=>e.hp>0&&e.lane===drone.lane&&Math.abs(e.y-drone.y)<effects.pulseRange).length;if(drone.pulseCooldown<=.01&&inR>=2)pulse();}
  }
  if(core>0)st.wins++;}
 for(const k in st)if(typeof st[k]==='number'&&k!=='wins')st[k]=+(st[k]/N).toFixed(2);JSON.stringify(st)`));
 console.log(r);await b.close();fs.unlinkSync(f);})();
