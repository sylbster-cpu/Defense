/* hud.js — 3D 장면 위에 겹쳐 그리는 2D 표시: 적 체력 막대, 다음 적 예고와 동시 돌격 경고, 작전·공격 표시,
   시설 이름표, 협동 조준 수치, 일시정지, 연습 안내. 게임 상태(G)는 읽기만 한다. */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('hud',ctx=>{
const c=ctx.hud&&ctx.hud.ctx;if(!c)return {};
const L=ctx.L,A=ctx.A,ENEMY=ctx.ENEMY,clamp=ctx.util.clamp,TAU=Math.PI*2;
// projection scratch (reused every frame)
const v=new THREE.Vector3(),p={x:0,y:0,z:0},p2={x:0,y:0,z:0};
let Q=ctx.quality;

/* ---------- colours (carried over from the 2D drawing code) ---------- */
const INK='rgba(5,13,16,.9)',BACK='rgba(7,16,20,.86)',PANEL='rgba(8,19,23,.76)';
const AMBER='#f1c37c',FLASH='#fff6d8',RED='#f17c6f',WARN='#ff5a48',CREAM='#e8ddd0',HOT='#ffe1ae',WAVE_HI='#ffc45e',TRACK='rgba(150,176,172,.3)';
const LANE_COL=['#f0c47b','#8dd7d0'],LANE_EDGE=['rgba(240,196,123,.42)','rgba(141,215,208,.42)'];
const FAC_FILL=['#f3c67d','#8bd9cb'],FAC_NAME=['발전소','정비소'],FAC_OFF='기능 정지',OFF_COL='#f0998c';
const FAM='system-ui,-apple-system,sans-serif';

/* ---------- metrics: rebuilt on layout, never per frame ---------- */
let s=1,ui=1,M=4,FS=11,FSS=10,OLW=3,BD=1,curFont='';
let fNum='',fSmall='',fPause='';
let wFac=[34,34],wOff=46;
let CW=16,IH=13,TP=4,TBW=11,TBH=3,IR=4.5,GW=44,gradSide=null,gradTop=null;
// cached strings and their measured widths (rebuilt only when the number they show changes)
let opKey=-1,opA='',opB='',opC='',opD='',opW=140,opBottom=18,fbKey=-1,fbStr='',fbStrP='',fbW=30;
function metrics(){
 s=L.hudScale>0?L.hudScale:1;
 ui=clamp(Math.sqrt(Math.min(L.w,L.h)/300),1,1.4);
 M=Math.round(4*ui);FS=Math.round(11*ui);FSS=Math.max(10,Math.round(10*ui));OLW=Math.max(2.5,FS*.27);
 // outline of the health bars: one device pixel on 1x/2x screens, two on 3x
 BD=Math.max(1,Math.round(s*.6))/s;
 fNum='800 '+FS+'px '+FAM;fSmall='800 '+FSS+'px '+FAM;fPause='800 '+Math.round(26*ui)+'px '+FAM;
 CW=Math.round(18*ui);IH=Math.round(14*ui);TP=Math.round(4*ui);TBW=Math.round(12*ui);TBH=ui>1.2?4:3;IR=Math.round(10*ui)/2;
 GW=Math.round(clamp(Math.min(L.w,L.h)*.2,48,110));
 curFont='';opKey=-1;fbKey=-1;   // widths depend on the font: measure again
 try{
  c.font=fNum;wFac[0]=c.measureText(FAC_NAME[0]).width;wFac[1]=c.measureText(FAC_NAME[1]).width;wOff=c.measureText(FAC_OFF).width;
  gradSide=c.createLinearGradient(0,0,GW,0);gradSide.addColorStop(0,'rgba(255,64,48,.9)');gradSide.addColorStop(.35,'rgba(255,64,48,.34)');gradSide.addColorStop(1,'rgba(255,64,48,0)');
  gradTop=c.createLinearGradient(0,0,0,GW);gradTop.addColorStop(0,'rgba(255,64,48,.9)');gradTop.addColorStop(.35,'rgba(255,64,48,.34)');gradTop.addColorStop(1,'rgba(255,64,48,0)');
 }catch(err){gradSide=gradTop=null;}
}
metrics();

/* ---------- small drawing helpers (no allocations) ---------- */
function snap(x){return Math.round(x*s)/s;}
function text(str,x,y,font,fill,align){
 if(curFont!==font){c.font=font;curFont=font;}
 c.textAlign=align;
 // dark outline at every quality level: small text over the bright dusk haze is unreadable without it
 c.strokeStyle=INK;c.lineWidth=OLW;c.strokeText(str,x,y);
 c.fillStyle=fill;c.fillText(str,x,y);
}
function oval(x,y,rx,ry){c.beginPath();if(c.ellipse)c.ellipse(x,y,rx,ry,0,0,TAU);else c.arc(x,y,rx,0,TAU);}
function rr(x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
const typeCol={};
function tcol(G,type){let k=typeCol[type];if(!k){const m=G.TYPES&&G.TYPES[type];k=typeCol[type]=(m&&m.color)||'#dc876f';}return k;}

/* ---------- 1. enemy health bars ---------- */
const MINW={runner:12,grunt:15,brute:19,boss:27};
const pool=[],rows=[[],[]],cnt=[0,0];
function enemyBars(G,side){
 const list=G.enemies;cnt[0]=cnt[1]=0;if(!list)return;
 const n=list.length;if(!n)return;
 let used=0;
 for(let i=0;i<n;i++){
  const e=list[i];if(!e||!(e.hp>0))continue;
  const ln=e.lane;if(ln!==0&&ln!==1)continue;
  const d=ENEMY[e.type]||ENEMY.grunt;
  v.set(ctx.wx(e.y),d.h+.5,L.laneZ[ln]);ctx.project(v,p);
  if(!(p.z>-1&&p.z<1))continue;                                   // behind the camera or not a number
  const w=Math.round(Math.max(MINW[e.type]||15,1.85*d.r*ctx.pxPerUnit(v))),hw=w*.5;
  if(!(p.x+hw>0&&p.x-hw<L.w&&p.y>0&&p.y<L.h))continue;            // outside the box
  const b=pool[used]||(pool[used]={x:0,y:0,w:0,h:0,k:0,f:false,key:0});used++;
  b.w=w;b.h=e.type==='boss'?3:2;b.x=p.x-hw;b.y=p.y-b.h;b.k=e.maxHp>0?clamp(e.hp/e.maxHp,0,1):1;b.f=e.flash>0;b.key=e.y;
  // a machine that has just appeared at the far end: keep its bar below the OP / WAVE line and inside the box
  if(b.y<opBottom&&!side&&b.x+w>L.w-M-8-opW)b.y=opBottom;else if(b.y<2)b.y=2;
  rows[ln][cnt[ln]++]=b;
 }
 // per lane: order along the lane, then lift a bar that would touch a neighbour so bunched enemies never merge into one blob
 for(let ln=0;ln<2;ln++){
  const a=rows[ln],m=cnt[ln];
  for(let i=1;i<m;i++){const b=a[i];let j=i-1;while(j>=0&&a[j].key<b.key){a[j+1]=a[j];j--;}a[j+1]=b;}
  for(let i=0;i<m;i++){
   const b=a[i],bh=b.h+2*BD+1;
   for(let tries=0;tries<3;tries++){
    let hit=null;
    for(let j=i-1;j>=0&&j>=i-6;j--){const o=a[j];if(b.x<o.x+o.w+2&&b.x+b.w+2>o.x&&b.y<o.y+o.h+2*BD+1&&b.y+bh>o.y){hit=o;break;}}
    if(!hit)break;
    b.y=hit.y-bh;
   }
   b.x=snap(b.x);b.y=snap(b.y);
  }
 }
 c.fillStyle=BACK;
 for(let ln=0;ln<2;ln++){const a=rows[ln],m=cnt[ln];for(let i=0;i<m;i++){const b=a[i];c.fillRect(b.x-BD,b.y-BD,b.w+2*BD,b.h+2*BD);}}
 c.fillStyle=AMBER;
 for(let ln=0;ln<2;ln++){const a=rows[ln],m=cnt[ln];for(let i=0;i<m;i++){const b=a[i];if(b.k>0&&!(b.f&&Q>0))c.fillRect(b.x,b.y,Math.max(1/s,snap(b.w*b.k)),b.h);}}
 if(Q>0){c.fillStyle=FLASH;
  for(let ln=0;ln<2;ln++){const a=rows[ln],m=cnt[ln];for(let i=0;i<m;i++){const b=a[i];if(b.k>0&&b.f)c.fillRect(b.x,b.y,Math.max(1/s,snap(b.w*b.k)),b.h);}}}
}

/* ---------- 2. incoming preview + 3. surge warning ---------- */
const inD=new Float32Array(8),inT=['','','','','','','',''],inN=[0,0];let pvLen=5;
function scanIncoming(G){
 inN[0]=inN[1]=0;const pat=G.pattern;if(!pat||!pat.length)return;
 const st=+G.stageTime||0;pvLen=(G.BAL&&G.BAL.preview>0)?G.BAL.preview:5;
 for(let i=Math.max(0,G.nextSpawn|0);i<pat.length;i++){
  const ev=pat[i];if(!ev)continue;
  const d=ev[0]-st;if(d>pvLen)break;
  const ln=ev[1];if(ln!==0&&ln!==1)continue;
  const k=inN[ln];
  if(k<4){inD[ln*4+k]=d;inT[ln*4+k]=ev[2];inN[ln]=k+1;}else if(inN[1-ln]>=4)break;
 }
}
function surgeNow(G){
 const a=G.surges;if(!a)return false;const st=+G.stageTime||0;
 for(let i=0;i<a.length;i++){const sg=a[i];if(!sg)continue;const d=sg.t-st;if(d>=-.3&&d<=3.5)return true;}
 return false;
}
function icon(G,type,cx,cy,down){
 const col=tcol(G,type);
 if(type==='runner'){
  const r=IR+.5;c.beginPath();
  if(down){c.moveTo(cx,cy+r);c.lineTo(cx-r*.9,cy-r*.8);c.lineTo(cx,cy-r*.3);c.lineTo(cx+r*.9,cy-r*.8);}
  else{c.moveTo(cx+r,cy);c.lineTo(cx-r*.8,cy-r*.9);c.lineTo(cx-r*.3,cy);c.lineTo(cx-r*.8,cy+r*.9);}
  c.closePath();c.fillStyle=col;c.fill();
 }else if(type==='grunt'){
  const r=IR;c.fillStyle='#6b423a';c.fillRect(cx-r,cy-r,r*2,r*2);c.fillStyle=col;c.fillRect(cx-r+1,cy-r+1,r*2-2,r*2-2);
  if(Q>0){c.fillStyle='#6b423a';c.fillRect(cx-r*.5,cy-r*.45,r,Math.max(1,r*.35));}
 }else{
  const boss=type==='boss',r=IR+(boss?2:1);
  c.fillStyle='#e7a58f';c.fillRect(cx-r,cy-r,r*2,r*2);c.fillStyle='#5d383b';c.fillRect(cx-r+1,cy-r+1,r*2-2,r*2-2);
  c.fillStyle=col;c.fillRect(cx-r+2.5,cy-r+2.5,r*2-5,r*2-5);
  if(boss){c.fillStyle='#5d383b';c.beginPath();c.arc(cx,cy,r*.5,0,TAU);c.fill();c.fillStyle='#ffd39a';c.beginPath();c.arc(cx,cy,r*.3,0,TAU);c.fill();}
  else{c.fillStyle='#5d383b';c.fillRect(cx-r+3.5,cy-.75,r*2-7,1.5);}
 }
}
function tray(G,ln,side,warn,pu){
 const n=inN[ln];if(!n&&!warn)return;
 const cells=n>0?n:1,w=TP*2+cells*CW,h=TP+IH+2+TBH+TP-1;
 const lz=L.laneZ[ln],sg=lz<0?-1:1;
 // outer edge of the lane at its spawn end; the tray sits just outside it so the lane itself stays clear
 v.set(A.spawnX+1,0,lz+sg*(A.laneW*.5+(side&&sg>0?1.9:1.1)));ctx.project(v,p);
 if(!(p.z>-1&&p.z<1))return;
 let x,y,mirror=false;
 if(side){x=sg>0?M+1:M+64;y=sg>0?p.y-2-h:p.y+2;}   // the near lane's tray clears the item button in the corner
 else{mirror=sg<0;x=mirror?p.x-3-w:p.x+3;y=p.y-h+2;}
 x=Math.round(clamp(x,M,L.w-M-w));y=Math.round(clamp(y,side?M:M+FS+5,L.h-M-h));
 rr(x+.5,y+.5,w-1,h-1,4);
 c.fillStyle=PANEL;c.fill();
 if(warn){
  c.strokeStyle=WARN;
  if(Q>0){c.globalAlpha=.3*pu;c.lineWidth=6;c.stroke();}
  c.globalAlpha=.55+.45*pu;c.lineWidth=2;c.stroke();c.globalAlpha=1;
 }else{c.strokeStyle=LANE_EDGE[ln];c.lineWidth=1;c.stroke();}
 // lane identity tab on the edge that faces the lane
 c.fillStyle=warn?WARN:LANE_COL[ln];
 if(side)c.fillRect(x+5,sg>0?y+h-1.5:y-.5,w-10,2);else c.fillRect(mirror?x+w-1.5:x-.5,y+5,2,h-10);
 for(let i=0;i<n;i++){
  const d=inD[ln*4+i],type=inT[ln*4+i],k=clamp(1-d/pvLen,0,1);
  const cx=snap(x+TP+CW*((mirror?n-1-i:i)+.5)),cy=snap(y+TP+IH*.5);
  c.globalAlpha=.5+.5*k;icon(G,type,cx,cy,!side);c.globalAlpha=1;
  const bx=snap(cx-TBW*.5),by=y+TP+IH+2;
  c.fillStyle=TRACK;c.fillRect(bx,by,TBW,TBH);
  if(k>0){c.fillStyle=(type==='boss'||type==='brute')?RED:'#edbf76';c.fillRect(bx,by,Math.max(1/s,snap(TBW*k)),TBH);}
 }
}
function surgeGlow(side,pu){
 // red glow along the edge the machines come from (it spans both lanes) and a thin alert frame around the whole box
 if(Q>0&&gradSide&&gradTop){c.globalAlpha=.5+.5*pu;if(side){c.fillStyle=gradSide;c.fillRect(0,0,GW,L.h);}else{c.fillStyle=gradTop;c.fillRect(0,0,L.w,GW);}}
 c.globalAlpha=.4+.5*pu;c.strokeStyle=WARN;c.lineWidth=3;c.strokeRect(1.5,1.5,L.w-3,L.h-3);
 c.globalAlpha=.6+.4*pu;c.fillStyle=WARN;if(side)c.fillRect(0,0,4,L.h);else c.fillRect(0,0,L.w,4);
 c.globalAlpha=1;
}

/* ---------- 4. operation and wave text ---------- */
let waveFx=0;
function opText(G,side){
 const op=G.op|0,wv=G.noWave()?-1:(G.wave|0),key=op*64+wv+1;
 if(key!==opKey){opKey=key;const o=(op<10?'0':'')+op,w=wv<0?'—':''+wv;opA='작전 '+o+' / 05';opB='공격 '+w+' / 03';opC='OP '+o+' / 05 · WAVE '+w+' / 03';opD=opA+' · '+opB;if(curFont!==fNum){c.font=fNum;curFont=fNum;}opW=c.measureText(opC).width;}
 const y=M+2+FS*.5,col=waveFx>0?WAVE_HI:CREAM;opBottom=M+FS+5;
 text(opD,M+5,y,fNum,col,'left');   // one line on the left: the gear button owns the top-right corner
}

/* ---------- 5. facility labels ---------- */
const facFx=[0,0];
function facility(G,ln,side,practice){
 const f=G.facilities,hp=f?+f[ln]||0:0,alive=hp>0;
 const lz=L.laneZ[ln],sg=lz<0?-1:1;
 const bw=Math.round(36*ui),bh=3,tw=alive?wFac[ln]:wOff,wide=Math.max(bw,tw),blockH=FS+3+bh;
 let x,y,align;                                          // x = anchor of the text, y = top of the block
 if(side){
  // above the far building, below the near one: the outer side, away from the lanes and the median
  if(sg>0){v.set(A.facX,6,lz+3.5);ctx.project(v,p);y=p.y-4-blockH;}
  else{v.set(A.facX-.9,0,lz-4);ctx.project(v,p);y=p.y+4;}
  x=clamp(p.x,M+wide*.5,L.w-M-wide*.5);align='center';
 }else{
  // beside the building on its outer side
  v.set(A.facX,2.2,lz+sg*3.9);ctx.project(v,p);
  if(sg<0){x=clamp(p.x-5,M+wide,L.w-M);align='right';}else{x=clamp(p.x+5,M,L.w-M-wide);align='left';}
  y=p.y-blockH*.5;
 }
 if(!(p.z>-1&&p.z<1))return;
 y=clamp(y,M+FS+4,L.h-M-blockH);
 // the tutorial coach box owns the bottom centre of the box while practising
 if(practice&&y+blockH>L.h-(50+30*ui)){
  const half=side?158:Math.min(L.w*.47,170),x0=align==='center'?x-wide*.5:align==='right'?x-wide:x;
  if(x0<L.w*.5+half&&x0+wide>L.w*.5-half)return;
 }
 x=snap(x);y=snap(y);
 // no name text: the tutorial explains the bars
 const bx=snap(align==='center'?x-bw*.5:align==='right'?x-bw:x),by=snap(y+FS+3);
 c.fillStyle=BACK;c.fillRect(bx-BD,by-BD,bw+2*BD,bh+2*BD);
 if(alive){c.fillStyle=hp<28?RED:FAC_FILL[ln];c.fillRect(bx,by,Math.max(1/s,snap(bw*clamp(hp/100,0,1))),bh);}
 else{c.fillStyle='#a35751';c.fillRect(bx,by+1,bw,1);}
 if(facFx[ln]>0){c.globalAlpha=clamp(facFx[ln],0,1);c.fillStyle=FLASH;c.fillRect(bx,by,bw,bh);c.globalAlpha=1;}
}

/* ---------- 6. turret bonus (협동 조준) ---------- */
function turretBonus(G,side){
 const fb=+G.focusBonus();if(!(fb>0))return;
 const ef=G.effects,cap=ef&&ef.focusCap>0?ef.focusCap:fb,k=clamp(fb/cap,0,1),pierce=!!G.pierceOn();
 const pct=Math.round(fb*100);
 if(pct!==fbKey){fbKey=pct;fbStr='+'+pct+'%';fbStrP=fbStr+' 관통';if(curFont!==fSmall){c.font=fSmall;curFont=fSmall;}fbW=c.measureText(fbStr).width;}
 // gauge: a shallow arc over the number, filled to bonus / cap
 const HA=.6,r=Math.max(12,fbW*.5/Math.sin(HA)),sag=r*(1-Math.cos(HA)),col=pierce?HOT:AMBER;
 for(let ln=0;ln<2;ln++){
  ctx.turretPos(ln,v);
  let cx,ty;                                             // centre of the number, middle of its line
  if(side){const far=v.z>0;v.x-=3;v.y=1;ctx.project(v,p);cx=p.x+fbW*.5;ty=p.y+(far?3:4);}
  else{const sg=v.z<0?-1:1;v.x-=2.6;v.y=0;ctx.project(v,p);cx=p.x+sg*3;ty=p.y+sag+3+FSS*.5;}
  if(!(p.z>-1&&p.z<1))continue;
  cx=snap(cx);ty=snap(ty);
  const ay=ty-FSS*.5-2-sag+r,a0=-Math.PI/2-HA;
  c.lineCap='butt';c.strokeStyle=BACK;c.lineWidth=4.5;c.beginPath();c.arc(cx,ay,r,a0-.03,a0+2*HA+.03);c.stroke();
  c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.arc(cx,ay,r,a0,a0+2*HA*Math.max(.05,k));c.stroke();
  if(side)text(pierce?fbStrP:fbStr,cx-fbW*.5,ty,fSmall,col,'left');
  else{text(fbStr,cx,ty,fSmall,col,'center');if(pierce)text('관통',cx,ty+FSS+1,fSmall,col,'center');}
 }
}

/* ---------- 7. pause / 8. tutorial practice hints ---------- */
function pauseVeil(){
 c.fillStyle='rgba(8,18,22,.64)';c.fillRect(0,0,L.w+1,L.h+1);
 text('일시정지',L.w*.5,L.h*.5,fPause,HOT,'center');
}
function practiceHint(G,t){
 const pr=G.practice;if(!pr||pr.done||!pr.task)return;
 ctx.dronePos(v);ctx.project(v,p);if(!(p.z>-1&&p.z<1))return;
 const ph=t-Math.floor(t);
 c.lineCap='round';
 if(pr.task==='move'){
  // chevrons flowing from the drone toward lane 1 (정비소), the lane the player has to move to
  v.set(A.droneX,A.droneH,L.laneZ[1]);ctx.project(v,p2);
  let dx=p2.x-p.x,dy=p2.y-p.y;const dist=Math.sqrt(dx*dx+dy*dy);if(!(dist>24))return;
  dx/=dist;dy/=dist;
  const r0=17*ui,gap=clamp((dist-r0-6*ui)/3,9,26*ui),hw=7*ui;
  for(let pass=Q>0?0:1;pass<2;pass++){
   c.strokeStyle=pass?'#f0c47b':'rgba(5,13,16,.7)';c.lineWidth=(pass?3:5.5)*ui;
   for(let i=0;i<3;i++){
    const u=(i+ph)/3,dd=r0+(i+ph)*gap,cx=p.x+dx*dd,cy=p.y+dy*dd;
    c.globalAlpha=(.12+.88*Math.sin(u*Math.PI))*(pass?1:.75);
    c.beginPath();c.moveTo(cx-dx*hw*.5-dy*hw,cy-dy*hw*.5+dx*hw);c.lineTo(cx+dx*hw*.5,cy+dy*hw*.5);c.lineTo(cx-dx*hw*.5+dy*hw,cy-dy*hw*.5-dx*hw);c.stroke();
   }
  }
 }else if(pr.task==='pulse'){
  const nr=Q>0?2:1;
  for(let i=0;i<nr;i++){
   const k=(ph+i*.5)%1,rx=(13+k*30)*ui,ry=rx*.8;
   if(Q>0){c.globalAlpha=.5*(1-k);c.strokeStyle='rgba(5,13,16,.8)';c.lineWidth=4.5*ui;oval(p.x,p.y,rx,ry);c.stroke();}
   c.globalAlpha=.85*(1-k);c.strokeStyle='#f6db9b';c.lineWidth=2.5*ui;oval(p.x,p.y,rx,ry);c.stroke();
  }
 }
 c.globalAlpha=1;
}

function frame(dt,t,G){
 if(L.hudScale>0&&L.hudScale!==s)metrics();
 c.setTransform(s,0,0,s,0,0);c.clearRect(0,0,L.w+1,L.h+1);
 // the context state is set again every frame: a resized or restored canvas forgets it
 c.globalAlpha=1;c.textBaseline='middle';c.lineJoin='round';c.lineCap='butt';curFont='';
 const phase=G.phase,battle=phase==='battle',practice=phase==='practice',side=L.mode==='side';
 if(facFx[0]>0)facFx[0]-=dt*2.5;if(facFx[1]>0)facFx[1]-=dt*2.5;if(waveFx>0)waveFx-=dt;
 let warn=false,pu=0;
 if(battle){scanIncoming(G);warn=surgeNow(G);if(warn){pu=.5+.5*Math.sin(t*9.5);surgeGlow(side,pu);}}
 facility(G,0,side,practice);facility(G,1,side,practice);
 enemyBars(G,side);
 if(battle){tray(G,0,side,warn,pu);tray(G,1,side,warn,pu);turretBonus(G,side);}
 opText(G,side);
 if(practice)practiceHint(G,t);
 if(battle&&G.paused)pauseVeil();
}

let bad=0,warned=false;
return{
 layout(){metrics();},
 quality(q){Q=q|0;},
 event(ev){
  if(!ev)return;
  if(ev.t==='leak'){if(ev.lane===0||ev.lane===1)facFx[ev.lane]=1;}
  else if(ev.t==='wave')waveFx=1.6;
  else if(ev.t==='stage'){facFx[0]=facFx[1]=0;waveFx=0;}
 },
 // One odd frame must not cost the player the whole 2.5D view: it is skipped. Only a hud that keeps failing
 // passes the error on, so that core falls back to the complete 2D drawing.
 update(dt,t,G){
  try{frame(dt,t,G);bad=0;}
  catch(err){
   c.globalAlpha=1;
   if(!warned){warned=true;if(window.console)console.warn('hud.js: frame skipped',err);}
   if(++bad>30)throw err;
  }
 }
};
});})();
