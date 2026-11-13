/* maps.js — 맵마다 붙는 지형물: 고압선, 관문, 다리, 터널, 샛길, 지뢰밭, 침수로, 가속로, 화염로. 게임 상태를 읽기만 한다. */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('maps',ctx=>{
const {scene,util}=ctx,G=ctx.G,{mat,merge,box:B,hash,rock}=util,PI=Math.PI;
const propMat=util.stdMat();
// merged mesh with per-facet tone jitter and a darker foot (the hand-painted look of env.js)
function solid(P,seed,jit,foot){const g=merge(P),p=g.attributes.position.array,c=g.attributes.color.array;let r=seed*7919+17;const R=()=>(r=(r*16807)%2147483647)/2147483647;
 for(let i=0;i<p.length;i+=9){const k=1+(R()-.5)*(jit||.16);for(let j=0;j<9;j+=3){const f=foot===0?1:.62+.38*Math.min(1,Math.max(0,p[i+j+1]/(foot||1.1)));c[i+j]*=k*f;c[i+j+1]*=k*f;c[i+j+2]*=k*f;}}
 const m=new THREE.Mesh(g,propMat);m.castShadow=true;m.receiveShadow=true;return m;}
function clear(g){for(let i=g.children.length-1;i>=0;i--){const o=g.children[i];g.remove(o);o.traverse(q=>{if(q.geometry&&!q.geometry.userData.keep)q.geometry.dispose();if(q.material&&q.material.userData.own)q.material.dispose();});}}   // own: a material made for this one build (lamps)
const root={gate:new THREE.Group(),bridge:new THREE.Group(),tunnel:new THREE.Group(),cross:new THREE.Group(),pylon:new THREE.Group(),mine:new THREE.Group(),flood:new THREE.Group(),boost:new THREE.Group(),vent:new THREE.Group()},built={};
// an additive strip lying on the road (glows, arrows), scrolled by its texture offset
const stripMat=(tex,col,op)=>new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:col,opacity:op,fog:false});
function flat(g,mat,w,d,x,y,z,order){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);m.rotation.x=-PI/2;m.position.set(x,y,z);m.renderOrder=order;g.add(m);return m;}   // a sheet lying on the ground, w along the lanes and d across
function strip(g,mat,x0,x1,z,w,y){return flat(g,mat,Math.abs(x1-x0),w,(x0+x1)/2,y||.07,z,2);}
for(const k in root){root[k].visible=false;scene.add(root[k]);}

/* ---------- 관문: a gate on each lane. The arm drops while the gate is shut; the lamps are red, blinking in its last second. ---------- */
const gates=[],lampGeo=new THREE.BoxGeometry(.06,.34,9.6),barGeo=new THREE.BoxGeometry(.5,.08,9.8);lampGeo.userData.keep=barGeo.userData.keep=true;
const RED=0xff3b2a,GREEN=0x3fe08a,AMBER=0xffb13a,DARK=0x2a1210;
function buildGate(L){
 const g=root.gate;clear(g);gates.length=0;const x=ctx.wx(G.GATE.y);
 for(let i=0;i<2;i++){
  const z0=ctx.laneZAt(i,x),sg=Math.sign(L.laneZ[i])||1,zp=z0+sg*5.3,P=[];   // sg: towards the outer side of the lane; the arm hinges on the outer post
  for(const s of [-1,1]){const z=z0+s*5.3;B(P,1.2,.5,1.2,x,.25,z,0x4a5153);B(P,.7,3.4,.7,x,1.95,z,0x5d6461);}
  B(P,.9,.6,11.3,x,3.75,z0,0x3c4a4e);B(P,1.0,.12,11.5,x,3.42,z0,0x2a3236);                     // overhead beam carrying the signal bar
  B(P,.5,.6,.5,x,1.25,zp,0x2c3436);                                                              // hinge block
  B(P,.26,.05,8.6,x+.9,.055,z0,0xb85a3f);                                                        // stop line on the enemy side
  g.add(solid(P,41+i,.12,1));
  const piv=new THREE.Group();piv.position.set(x,1.55,zp);
  const AP=[];for(let k=0;k<7;k++)B(AP,.36,.36,1.5,0,0,-sg*(.75+k*1.5),k%2?0x2b2b2b:0xf0b54e);B(AP,.46,.46,.5,0,0,0,0x33393b);
  piv.add(solid(AP,60+i,.06,0));g.add(piv);
  const lm=new THREE.MeshBasicMaterial({color:RED,fog:false});lm.userData.own=true;
  const bar=new THREE.Mesh(barGeo,lm);bar.position.set(x,4.08,z0);g.add(bar);                    // the signal bar: red shut, green open, seen from any camera
  for(const s of [-1,1]){const m=new THREE.Mesh(lampGeo,lm);m.position.set(x+s*.47,3.75,z0);g.add(m);}
  gates.push({piv,lm,sg,ang:0});
 }
}
function updGate(dt,t){
 const C=G.GATE.cycle,S=G.GATE.shut,live=G.phase==='battle';
 for(let i=0;i<gates.length;i++){const q=gates[i],shut=live&&G.gateShut(i),ph=G.gatePhase(i),rem=shut?S-ph:C-ph;
  q.ang=util.damp(q.ang,shut?0:1.3,shut?9:5,dt);q.piv.rotation.x=q.sg*q.ang;
  const blink=live&&rem<1&&Math.sin(t*26)>0;q.lm.color.setHex(shut?(blink?DARK:RED):(blink?AMBER:GREEN));}   // open: amber blinks in the last second before it shuts
}

/* ---------- 다리: a chasm across the field; each lane crosses it on a railed deck ---------- */
const pitMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,map:util.canvasTex(256,8,(c,w,h)=>{
 const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(3,4,5,0)');g.addColorStop(.09,'rgba(3,4,5,.88)');g.addColorStop(.2,'rgba(2,3,4,.97)');g.addColorStop(.8,'rgba(2,3,4,.97)');g.addColorStop(.91,'rgba(3,4,5,.88)');g.addColorStop(1,'rgba(3,4,5,0)');c.fillStyle=g;c.fillRect(0,0,w,h);})});
function buildBridge(){
 const g=root.bridge;clear(g);const x0=ctx.wx(G.BRIDGE[1]),x1=ctx.wx(G.BRIDGE[0]),xc=(x0+x1)/2,len=x1-x0,zs=[ctx.laneZAt(0,xc),ctx.laneZAt(1,xc)];
 flat(g,pitMat,len+1.8,96,xc,.014,0,1);
 const P=[],onRoad=z=>zs.some(lz=>Math.abs(z-lz)<4.7);
 for(const ex of [x0,x1])for(let z=-36;z<36;z+=1.15){if(onRoad(z))continue;const k=hash(ex*3.1,z*1.7),sd=ex===x0?-1:1;
  rock(P,ex+sd*(.35+(k-.5)*.3),.1,z,.6+k*.35,.28+k*.3,.55+hash(z,ex)*.3,k>.5?0x4b4741:0x3c3a37,Math.round(z*10+ex*7));}
 for(const lz of zs)for(const s of [-1,1]){const z=lz+s*4.45;
  B(P,len+.7,.4,.36,xc,-.12,z,0x283034);                                                       // deck edge girder
  for(let x=x0-.2;x<=x1+.21;x+=1.5)B(P,.22,1.0,.22,x,.52,z,0x6d8790);
  B(P,len+.6,.16,.2,xc,1.0,z,0xb9c8c6);B(P,len+.5,.1,.14,xc,.55,z,0x6d8790);
  for(const ex of [x0-.55,x1+.55]){B(P,.5,1.3,.5,ex,.65,z,0x2b2b2b);B(P,.52,.32,.52,ex,1.0,z,0xf0b54e);B(P,.52,.32,.52,ex,.4,z,0xf0b54e);}}
 g.add(solid(P,51,.12,.9));
}

/* ---------- 터널: a rock mass over both lanes; machines inside are hidden (units.js and hud.js skip them) ---------- */
const darkMat=new THREE.MeshBasicMaterial({color:0x040405}),H=3.1;
function buildTunnel(L){
 const g=root.tunnel;clear(g);const xa=ctx.wx(G.TUNNEL[1]),xb=ctx.wx(G.TUNNEL[0]),xc=(xa+xb)/2,len=xb-xa,zs=[L.laneZ[0],L.laneZ[1]],P=[];
 for(const lz of zs){
  for(const s of [-1,1])B(P,len,H,.9,xc,H/2,lz+s*4.55,0x596060);                               // tube walls
  B(P,len,.55,10.2,xc,H+.27,lz,0x6a706c);                                                        // roof slab
  for(let x=xa+1;x<xb-.5;x+=1.6)B(P,.12,.08,10.2,x,H+.58,lz,0x4b5150);                            // panel joints on the roof
  B(P,len-.8,.1,1.2,xc,H+.6,lz,0xd99b54);                                                        // painted strip along the middle
 }
 const zm=(zs[0]+zs[1])/2,gap=Math.abs(zs[0]-zs[1])-10.2;
 B(P,len,H*.82,gap,xc,H*.41,zm,0x3f3c38);                                                         // earth between the tubes
 for(let i=0;i<16;i++){const u=hash(i,3);rock(P,xa+.6+u*(len-1.2),H*.8+hash(i,9)*.3,zm+(hash(i,7)-.5)*(gap-1),.9+hash(i,11)*.8,.5+hash(i,13)*.5,.9+hash(i,17)*.8,i%3?0x4e4944:0x46433f,i*13+5);}
 for(const s of [-1,1]){const zc=s*(L.LZ+5.1+1.7);B(P,len,H*.8,3.4,xc,H*.4,zc,0x3f3c38);   // earth banked against the outer walls
  for(let i=0;i<7;i++)rock(P,xa+.5+i*(len-1)/6,H*.75+hash(i,s)*.4,zc+s*(hash(i,s+5)-.3)*1.6,1.2,1.0+hash(i,s+2)*.6,1.3,i%2?0x46433f:0x3b3b3c,i*31+(s>0?1:2));}
 for(const px of [xa,xb]){const d=px===xa?-1:1;for(const lz of zs){
  for(const s of [-1,1])B(P,.8,H+.5,1.1,px+d*.15,(H+.5)/2,lz+s*4.6,0x767a74);
  B(P,.9,.75,11,px+d*.15,H+.35,lz,0x6a6e68);B(P,.06,.14,9.4,px+d*.62,H+.2,lz,0xf0b54e);}}
 g.add(solid(P,77,.12,1.2));
 for(const px of [xa,xb]){const d=px===xa?-1:1;for(const lz of zs){const m=new THREE.Mesh(new THREE.BoxGeometry(.04,H-.15,8.4),darkMat);m.position.set(px+d*.03,(H-.15)/2,lz);g.add(m);}}
}

/* ---------- 샛길: a deck between the lanes along the crossover stretch. Chevrons show which way machines cross: towards the drone's lane. ---------- */
const chevTex=util.canvasTex(64,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(255,236,190,1)';c.lineWidth=12;c.lineCap='round';c.lineJoin='round';
 for(let k=0;k<2;k++){const y=18+k*64;c.beginPath();c.moveTo(10,y+26);c.lineTo(w/2,y);c.lineTo(w-10,y+26);c.stroke();}},{repeat:[1,1]});
chevTex.wrapT=THREE.RepeatWrapping;
const chevMat=new THREE.MeshBasicMaterial({map:chevTex,transparent:true,depthWrite:false,color:0xffd48a,opacity:.85,fog:false});
let chev=null,cz=[0,0],flash=0;
function buildCross(){
 const g=root.cross;clear(g);const xa=ctx.wx(G.CROSS[1]-14),xb=ctx.wx(G.CROSS[0]+14),x=(xa+xb)/2,dx=xb-xa,z0=ctx.laneZAt(0,x),z1=ctx.laneZAt(1,x),sg=Math.sign(z1-z0)||1;
 const a=z0+sg*3.6,b=z1-sg*3.6,len=Math.abs(b-a),zc=(a+b)/2,P=[];cz=[z0,z1];
 B(P,dx,.08,len,x,.04,zc,0x4a5153);
 for(const s of [-1,1]){B(P,.28,.3,len-1.2,x+s*(dx/2-.15),.15,zc,0x646660);for(const e of [a,b])B(P,.4,.5,.4,x+s*(dx/2-.15),.25,e+(e===a?sg:-sg)*.6,0x33393b);}
 for(let k=1;k<4;k++)B(P,.12,.09,len-.4,xa+k*dx/4,.085,zc,0x5e6563);
 g.add(solid(P,91,.1,.4));
 chev=flat(g,chevMat,dx-1.2,Math.max(1.2,len-.6),x,.1,zc,2);
 chevTex.repeat.set(Math.max(1,Math.round((dx-1.2)/3.2)),Math.max(1,(len-.6)/2.6));
}
function updCross(dt,t){
 if(!chev)return;const d=G.drone,to=d?d.lane:0,dir=Math.sign(cz[to]-cz[1-to]);   // machines come over to the drone's lane
 chev.rotation.z=dir<0?0:PI;chevTex.offset.y=(chevTex.offset.y-dt*1.1)%1;
 flash=Math.max(0,flash-dt*2.5);chevMat.opacity=Math.min(1,.62+.18*Math.sin(t*4)+.4*flash);
}

/* ---------- 고압선: steel pylons and sagging lines over both lanes; the road under them crackles ---------- */
const zapTex=util.canvasTex(128,32,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(255,255,255,1)';c.lineWidth=2;for(let k=0;k<5;k++){c.beginPath();let y=h/2;c.moveTo(0,y);for(let x=0;x<=w;x+=8){y=h/2+(Math.sin(x*.37+k*2.1)+Math.sin(x*.11+k))*h*.18;c.lineTo(x,y);}c.globalAlpha=.25+.15*k;c.stroke();}},{repeat:[4,1]});
const zapMat=stripMat(zapTex,0x7fd8ff,.5);
function buildPylon(L){
 const g=root.pylon;clear(g);const x0=ctx.wx(G.PYLON[1]),x1=ctx.wx(G.PYLON[0]),P=[];
 for(const lz of [L.laneZ[0],L.laneZ[1]]){const sg=Math.sign(lz)||1,zo=lz+sg*6.2;
  for(const x of [x0,x1]){B(P,1.0,.4,1.0,x,.2,zo,0x3c4a4e);for(const dz of [-.32,.32])B(P,.12,6.2,.12,x,3.3,zo+dz,0x8fa6a8);for(let h=1.2;h<6;h+=1.2)B(P,.1,.1,.76,x,h,zo,0x6d8790);B(P,.2,.14,10.6,x,6.1,lz,0x6d8790);}
  for(const dz of [-3.2,0,3.2]){/* cables sag between the two pylons */for(let k=0;k<10;k++){const u0=k/10,u1=(k+1)/10,xa=x0+(x1-x0)*u0,xb=x0+(x1-x0)*u1,ya=5.95-2.2*4*u0*(1-u0),yb=5.95-2.2*4*u1*(1-u1),l=Math.hypot(xb-xa,yb-ya);P.push({g:new THREE.BoxGeometry(l,.07,.07),m:mat((xa+xb)/2,(ya+yb)/2,lz+dz,0,0,Math.atan2(yb-ya,xb-xa)),c:0x2a2f31});}}
  strip(g,zapMat,x0,x1,lz,7.6,.07);}
 g.add(solid(P,121,.08,1.2));
}
/* ---------- 지뢰밭: mines on both lanes, at G.MINE.ys (G.mines holds them lane by lane in that order): a red lamp blinks while armed; a spent mine leaves a dark crater ---------- */
const mineGeo=new THREE.CylinderGeometry(.62,.72,.18,10),mineMat=new THREE.MeshStandardMaterial({color:0x3a3f40,roughness:.7,metalness:.3}),lampG=new THREE.SphereGeometry(.2,8,6);mineGeo.userData.keep=lampG.userData.keep=true;
const craterTex=util.canvasTex(64,64,(c,w)=>{const gr=c.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);gr.addColorStop(0,'rgba(0,0,0,.85)');gr.addColorStop(.6,'rgba(0,0,0,.5)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(0,0,w,w);});
const craterMat=new THREE.MeshBasicMaterial({map:craterTex,transparent:true,depthWrite:false});
let mineObjs=[];
function buildMine(L){
 const g=root.mine;clear(g);mineObjs=[];const M=G.MINE;
 for(let l=0;l<2;l++)for(let i=0;i<M.n;i++){const y=M.ys[i],x=ctx.wx(y),z=ctx.laneZAt(l,x);
  const body=new THREE.Mesh(mineGeo,mineMat);body.position.set(x,.1,z);body.castShadow=true;g.add(body);
  const lm=new THREE.MeshBasicMaterial({color:0xff3020,fog:false}),lamp=new THREE.Mesh(lampG,lm);lm.userData.own=true;lamp.position.set(x,.26,z);g.add(lamp);
  mineObjs.push({k:l*M.n+i,y,body,lamp,cr:flat(g,craterMat,2.6,2.6,x,.06,z,1)});}
 const P=[];for(const lz of [L.laneZ[0],L.laneZ[1]])for(const s of [-1,1])for(const x of [ctx.wx(M.a),ctx.wx(M.b)]){B(P,.14,.9,.14,x,.45,lz+s*4.9,0x6d8790);B(P,.5,.32,.06,x,.8,lz+s*4.9,0xf0b54e);}   // warning signs at both ends
 g.add(solid(P,131,.08,.8));
}
function updMine(dt,t){const ms=G.mines;
 for(const o of mineObjs){const m=ms[o.k],armed=!m||m.arm<=0;o.body.visible=armed;o.lamp.visible=armed&&Math.sin(t*7+o.y)>-.2;o.cr.visible=!armed;}}
/* ---------- 침수로: a sheet of water across both lanes; it flashes when the overload electrifies it ---------- */
const waterTex=util.canvasTex(128,128,(c,w,h)=>{c.fillStyle='rgba(40,110,140,1)';c.fillRect(0,0,w,h);c.strokeStyle='rgba(170,230,255,.55)';c.lineWidth=1.5;for(let k=0;k<14;k++){const y=(k+.5)*h/14;c.beginPath();for(let x=0;x<=w;x+=4)c.lineTo(x,y+Math.sin(x*.12+k*1.7)*2.5);c.stroke();}},{repeat:[3,6]});
const waterMat=new THREE.MeshStandardMaterial({map:waterTex,transparent:true,opacity:.62,roughness:.15,metalness:.2,depthWrite:false,emissive:0x0a2a3a});
let water=null,wFlash=0;
function buildFlood(L){
 const g=root.flood;clear(g);const x0=ctx.wx(G.FLOOD[1]),x1=ctx.wx(G.FLOOD[0]),w=2*(L.LZ+5.4),P=[];
 water=flat(g,waterMat,x1-x0,w,(x0+x1)/2,.09,0,1);
 for(const s of [-1,1])for(let z=-w/2;z<w/2;z+=1.1){B(P,.9,.42,.95,x0-.35,.21,z+.5,s>0?0x6b6450:0x5d5747);B(P,.9,.42,.95,x1+.35,.21,z+.5,s>0?0x5d5747:0x6b6450);}   // sandbags along both edges
 g.add(solid(P,141,.12,.5));
}
function updFlood(dt){if(!water)return;waterTex.offset.x=(waterTex.offset.x+dt*.05)%1;waterTex.offset.y=(waterTex.offset.y+dt*.03)%1;wFlash=Math.max(0,wFlash-dt*2.2);waterMat.emissive.setRGB(.04+.5*wFlash,.16+.75*wFlash,.23+.9*wFlash);}
/* ---------- 가속로: glowing arrow rails on the workshop lane that push machines on ---------- */
const boostTex=util.canvasTex(64,64,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(255,255,255,1)';c.lineWidth=9;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(w*.75,8);c.lineTo(w*.3,h/2);c.lineTo(w*.75,h-8);c.stroke();},{repeat:[1,1]});
boostTex.wrapS=THREE.RepeatWrapping;const boostMat=stripMat(boostTex,0xff8a3a,.75);
function buildBoost(){
 const g=root.boost;clear(g);const Z=G.map.z,P=[];   // built when the boost map is laid out: its stretch
 for(let l=0;l<2;l++)for(const z of Z[l]){const x0=ctx.wx(z[1]),x1=ctx.wx(z[0]),lz=ctx.laneZAt(l,(x0+x1)/2);
  for(const dz of [-2.3,2.3])strip(g,boostMat,x0,x1,lz+dz,1.6,.075);
  for(const s of [-1,1])B(P,x1-x0,.16,.3,(x0+x1)/2,.1,lz+s*3.9,0x8a4a2a);}
 boostTex.repeat.set(Math.max(1,Math.round((ctx.wx(Z[1][0]?Z[1][0][0]:0)-ctx.wx(Z[1][0]?Z[1][0][1]:0))/1.6)),1);
 if(P.length)g.add(solid(P,151,.08,.4));
}
function updBoost(dt){boostTex.offset.x=(boostTex.offset.x+dt*2.2)%1;}
/* ---------- 화염로: vent grates on both lanes; they glow before they fire (fx.js draws the flames) ---------- */
const grateMat=new THREE.MeshStandardMaterial({color:0x2c2f30,emissive:0x000000,roughness:.6,metalness:.4});
function buildVent(){
 const g=root.vent;clear(g);const P=[];
 for(let l=0;l<2;l++)for(let i=0;i<ctx.GRATES;i++){const x=ctx.wx(ctx.grateY(i)),z=ctx.laneZAt(l,x);for(let k=-2;k<=2;k++)B(P,1.7,.12,.22,x,.07,z+k*1.2,0xffffff);B(P,1.9,.08,6.4,x,.03,z,0x9a9a9a);}
 const m=new THREE.Mesh(merge(P),grateMat);m.receiveShadow=true;g.add(m);
}
function updVent(dt,t){const ph=G.ventPhase(),k=ph===2?1:ph===1?.35+.3*Math.sin(t*18):0;grateMat.emissive.setRGB(1*k,.32*k,.05*k);}

const BUILD={gate:buildGate,bridge:buildBridge,tunnel:buildTunnel,cross:buildCross,pylon:buildPylon,mine:buildMine,flood:buildFlood,boost:buildBoost,vent:buildVent};
return{
 layout(L){
  for(const id in root){const on=L.map===id;root[id].visible=on;
   const key=L.mode+'|'+L.laneZ[0]+'|'+L.laneZ[1];if(on&&built[id]!==key){built[id]=key;BUILD[id](L);}}
 },
 update(dt,t){
  if(root.gate.visible)updGate(dt,t);
  if(root.cross.visible)updCross(dt,t);
  if(root.pylon.visible)zapTex.offset.x=(zapTex.offset.x+dt*(1.5+Math.random()))%1,zapMat.opacity=.32+.3*Math.random();
  if(root.mine.visible)updMine(dt,t);
  if(root.flood.visible)updFlood(dt);
  if(root.boost.visible)updBoost(dt);
  if(root.vent.visible)updVent(dt,t);
 },
 event(ev){if(ev.t==='cross')flash=1;else if(ev.t==='shock')wFlash=1;else if(ev.t==='stage'){flash=0;wFlash=0;}}
};
});})();
