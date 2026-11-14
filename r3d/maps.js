/* maps.js — 맵마다 붙는 지형물: 고압선, 관문, 다리, 터널, 샛길, 침수로, 가속로, 격납고, 포격장, 변전소, 역장, 도주로, 모래폭풍. 게임 상태를 읽기만 한다. */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('maps',ctx=>{
const {scene,util}=ctx,G=ctx.G,A=ctx.A,{mat,merge,box:B,hash,rock}=util,PI=Math.PI;
const propMat=util.stdMat();
// merged mesh with per-facet tone jitter and a darker foot (the hand-painted look of env.js)
function solid(P,seed,jit,foot){const g=merge(P),p=g.attributes.position.array,c=g.attributes.color.array;let r=seed*7919+17;const R=()=>(r=(r*16807)%2147483647)/2147483647;
 for(let i=0;i<p.length;i+=9){const k=1+(R()-.5)*(jit||.16);for(let j=0;j<9;j+=3){const f=foot===0?1:.62+.38*Math.min(1,Math.max(0,p[i+j+1]/(foot||1.1)));c[i+j]*=k*f;c[i+j+1]*=k*f;c[i+j+2]*=k*f;}}
 const m=new THREE.Mesh(g,propMat);m.castShadow=true;m.receiveShadow=true;return m;}
function clear(g){for(let i=g.children.length-1;i>=0;i--){const o=g.children[i];g.remove(o);o.traverse(q=>{if(q.geometry&&!q.geometry.userData.keep)q.geometry.dispose();if(q.material&&q.material.userData.own)q.material.dispose();});}}   // own: a material made for this one build (lamps)
const root={gate:new THREE.Group(),bridge:new THREE.Group(),tunnel:new THREE.Group(),cross:new THREE.Group(),pylon:new THREE.Group(),flood:new THREE.Group(),boost:new THREE.Group(),hangar:new THREE.Group(),mortar:new THREE.Group(),grid:new THREE.Group(),barrier:new THREE.Group(),flee:new THREE.Group(),storm:new THREE.Group()},built={};
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

/* ---------- 샛길·도주로: a deck between the lanes along the crossover stretch. Chevrons show which way machines cross:
   towards the drone's lane on 샛길, away from it on 도주로. Each map keeps its own deck and texture. ---------- */
const chevDraw=(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(255,236,190,1)';c.lineWidth=12;c.lineCap='round';c.lineJoin='round';
 for(let k=0;k<2;k++){const y=18+k*64;c.beginPath();c.moveTo(10,y+26);c.lineTo(w/2,y);c.lineTo(w-10,y+26);c.stroke();}};
const decks={};let flash=0;
function deck(id,col){if(decks[id])return decks[id];const tex=util.canvasTex(64,128,chevDraw,{repeat:[1,1]});tex.wrapT=THREE.RepeatWrapping;
 return decks[id]={tex,mat:new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,color:col,opacity:.85,fog:false}),chev:null,cz:[0,0]};}
function buildDeck(id,Z,col,seed){
 const D=deck(id,col),g=root[id];clear(g);const xa=ctx.wx(Z[1]-14),xb=ctx.wx(Z[0]+14),x=(xa+xb)/2,dx=xb-xa,z0=ctx.laneZAt(0,x),z1=ctx.laneZAt(1,x),sg=Math.sign(z1-z0)||1;
 const a=z0+sg*3.6,b=z1-sg*3.6,len=Math.abs(b-a),zc=(a+b)/2,P=[];D.cz=[z0,z1];
 B(P,dx,.08,len,x,.04,zc,0x4a5153);
 for(const s of [-1,1]){B(P,.28,.3,len-1.2,x+s*(dx/2-.15),.15,zc,0x646660);for(const e of [a,b])B(P,.4,.5,.4,x+s*(dx/2-.15),.25,e+(e===a?sg:-sg)*.6,0x33393b);}
 for(let k=1;k<4;k++)B(P,.12,.09,len-.4,xa+k*dx/4,.085,zc,0x5e6563);
 g.add(solid(P,seed,.1,.4));
 D.chev=flat(g,D.mat,dx-1.2,Math.max(1.2,len-.6),x,.1,zc,2);
 D.tex.repeat.set(Math.max(1,Math.round((dx-1.2)/3.2)),Math.max(1,(len-.6)/2.6));
}
const buildCross=()=>buildDeck('cross',G.CROSS,0xffd48a,91),buildFlee=()=>buildDeck('flee',G.FLEE,0xff9a6a,93);
function updDeck(id,away,dt,t){
 const D=decks[id];if(!D||!D.chev)return;const d=G.drone,dl=d?d.lane:0,to=away?1-dl:dl,dir=Math.sign(D.cz[to]-D.cz[1-to]);   // 샛길: machines come over to the drone's lane; 도주로: they run from it
 D.chev.rotation.z=dir<0?0:PI;D.tex.offset.y=(D.tex.offset.y-dt*1.1)%1;
 flash=Math.max(0,flash-dt*2.5);D.mat.opacity=Math.min(1,.62+.18*Math.sin(t*4)+.4*flash);
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
/* ---------- 격납고: a hangar block on the median with a door to each lane. The door rolls up when machines come out; the lamp over it
   blinks amber before it opens and flashes red when the drone keeps it shut. ---------- */
const hangs=[],slatGeo=new THREE.BoxGeometry(4,.3,.14),unitGeo=new THREE.BoxGeometry(1,1,1);slatGeo.userData.keep=unitGeo.userData.keep=true;
const doorMat=new THREE.MeshStandardMaterial({color:0x7d8782,roughness:.7,metalness:.3});
const halfMedian=L=>Math.max(1.5,L.LZ-5.25);   // the free ground between the lanes, either side of the centre line
function buildHangar(L){
 const g=root.hangar;clear(g);hangs.length=0;const x=ctx.wx(G.HANGAR.y),hw=halfMedian(L),len=6.4,Ht=2.5,P=[];
 B(P,len,Ht,2*hw,x,Ht/2,0,0x86908a);                                                             // the block
 B(P,len+.6,.35,2*hw+.5,x,Ht+.17,0,0x6a7678);                                                    // roof slab
 for(const k of [-1,1])B(P,.4,Ht+.1,2*hw+.3,x+k*len/2,(Ht+.1)/2,0,0x9aa39d);                      // end walls
 for(let k=0;k<5;k++)B(P,len*.7,.06,.12,x,Ht+.38,(k-2)*Math.min(.55,hw*.3),0x58646a);              // roof ribs
 for(let i=0;i<2;i++){const sg=Math.sign(L.laneZ[i])||1,zf=sg*hw;
  B(P,4.6,.3,.34,x,2.2,zf+sg*.12,0xf0b54e);                                                       // hazard header over the door
  for(const s of [-1,1])B(P,.32,2.1,.4,x+s*2.15,1.05,zf+sg*.12,0x2b2b2b);}                        // door posts
 g.add(solid(P,161,.1,1));
 for(let i=0;i<2;i++){const sg=Math.sign(L.laneZ[i])||1,zf=sg*hw;
  const dk=new THREE.Mesh(new THREE.PlaneGeometry(4,2),darkMat);dk.position.set(x,1,zf+sg*.03);dk.rotation.y=sg>0?0:PI;g.add(dk);   // the dark inside
  const door=new THREE.Group();door.position.set(x,2.05,zf+sg*.1);for(let k=0;k<7;k++){const m=new THREE.Mesh(slatGeo,doorMat);m.position.y=-.15-k*.29;m.castShadow=true;door.add(m);}g.add(door);   // roll-up door, hinged at its top
  const lm=new THREE.MeshBasicMaterial({color:DARK,fog:false});lm.userData.own=true;
  const lamp=new THREE.Mesh(unitGeo,lm);lamp.scale.set(3.6,.3,.2);lamp.position.set(x,2.58,zf+sg*.22);g.add(lamp);
  const roof=new THREE.Mesh(unitGeo,lm);roof.scale.set(len*.8,.35,.6);roof.position.set(x,Ht+.5,sg*(hw-.5));g.add(roof);   // the same lamp along the roof edge on that lane's side: both cameras see it
  hangs.push({door,lm,k:0,open:0,shut:0});}
}
function updHangar(dt,t){
 const live=G.phase==='battle',more=G.nextSpawn<G.pattern.length,T=G.hangarT||[0,0];
 for(let i=0;i<hangs.length;i++){const h=hangs[i];h.open=Math.max(0,h.open-dt);h.shut=Math.max(0,h.shut-dt);
  const warn=live&&more&&T[i]-G.stageTime<G.HANGAR.warn;
  h.k=util.damp(h.k,h.open>0?1:0,h.open>0?8:3,dt);h.door.scale.y=1-.9*h.k;
  h.lm.color.setHex(h.shut>0?(Math.sin(t*30)>0?RED:DARK):warn?(Math.sin(t*20)>0?AMBER:DARK):h.open>0?AMBER:0x3a2414);}
}

/* ---------- 포격장: the enemy mortar battery on the median at the far end, one tube for each lane's turret. A tube flashes when it fires
   (hud.js draws the red reticle over the turret, fx.js the shell landing or being shot down). ---------- */
const tubes=[],flashGeo=new THREE.SphereGeometry(.7,10,8),flashMat=new THREE.MeshBasicMaterial({color:0xffb060,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});flashGeo.userData.keep=true;
let shellsSeen=0;
function buildMortar(L){
 const g=root.mortar;clear(g);tubes.length=0;const x=ctx.wx(G.LANE_TOP+34),hw=halfMedian(L),P=[];
 for(let k=0;k<14;k++){const a=k/14*PI*2,r=Math.min(2.6,hw+.4);B(P,1.2,.55,.7,x+Math.cos(a)*r*1.25,.27,Math.sin(a)*r,k%2?0x6b6450:0x5d5747,PI/2-a);}   // sandbag ring
 B(P,3.4,.14,2*Math.min(2.6,hw+.4)-.6,x,.07,0,0x3b3a36);                                          // floor of the pit
 B(P,1.2,.7,1,x+1.6,.35,0,0x4a4a3c);B(P,.9,.5,.8,x+1.7,.95,0,0x5a5a48);                            // ammunition crates
 for(let i=0;i<2;i++){const sg=Math.sign(L.laneZ[i])||1,zc=sg*Math.min(1,hw*.5),tilt=.62,yaw=.32*sg;
  const dir=new THREE.Vector3(-Math.sin(tilt),Math.cos(tilt)*Math.cos(yaw),Math.cos(tilt)*Math.sin(yaw));
  B(P,1.3,.3,1.3,x-.2,.15,zc,0x2c3234);                                                           // base plate
  P.push({g:new THREE.CylinderGeometry(.3,.38,2.6,8),m:util.mat(x-.2+dir.x*1.1,.3+dir.y*1.1,zc+dir.z*1.1,yaw,0,tilt),c:0x3a4446});   // the tube, pointing up and towards the base
  for(const s of [-.4,.4])B(P,.12,1,.12,x-.6,.5,zc+s,0x2c3234,0,0,.5);                             // bipod
  const fl=new THREE.Mesh(flashGeo,flashMat.clone());fl.material.userData.own=true;fl.position.set(x-.2+dir.x*2.5,.3+dir.y*2.5,zc+dir.z*2.5);fl.visible=false;g.add(fl);
  tubes.push({fl,f:0});}
 g.add(solid(P,171,.12,.6));shellsSeen=0;
}
function updMortar(dt){
 const S=G.shells||[];for(let k=shellsSeen;k<S.length;k++){const q=tubes[S[k].lane];if(q)q.f=1;}shellsSeen=S.length;   // a new shell in the air: its tube has just fired
 for(const q of tubes){q.f=Math.max(0,q.f-dt*3);q.fl.visible=q.f>0;if(q.f>0){q.fl.material.opacity=q.f;q.fl.scale.setScalar(.6+1.4*(1-q.f));}}
}

/* ---------- 변전소: transformers on the median between the turret bunker and the drone, with a lamp for each charge
   (lit: ready; the next one to fill breathes; a spent charge goes dark) ---------- */
const gridLamps=[],chargeGeo=new THREE.SphereGeometry(.46,12,9);chargeGeo.userData.keep=true;
function buildGrid(L){
 const g=root.grid;clear(g);gridLamps.length=0;const x0=ctx.wx(420),x1=ctx.wx(372),xc=(x0+x1)/2,len=x1-x0,hw=halfMedian(L),P=[];
 B(P,len+.6,.2,2*hw,xc,.1,0,0x4a4f4c);                                                            // concrete pad
 for(const s of [-1,1])B(P,len+.6,.7,.1,xc,.45,s*(hw-.05),0x8a9496);                              // low fence along both sides
 for(const k of [-1,1]){const tx=xc+k*len*.24;B(P,1.6,1.5,Math.min(2.2,2*hw-.8),tx,.95,0,0x5f6c66);   // two transformers
  for(let f=-2;f<=2;f++)B(P,.08,1.2,Math.min(2.4,2*hw-.6),tx+f*.3,.85,0,0x46514c);                 // cooling fins
  for(const dz of [-.5,0,.5]){B(P,.16,.7,.16,tx,2.05,dz,0xc9c1a6);for(let d=0;d<3;d++)B(P,.36,.06,.36,tx,1.85+d*.22,dz,0xb5ab8e);}}   // insulators
 B(P,len*.55,.1,.1,xc,2.5,-.5,0x8fa6a8);B(P,len*.55,.1,.1,xc,2.5,.5,0x8fa6a8);                    // busbars between them
 B(P,.3,2.2,.3,xc,1.2,0,0x3c4a4e);B(P,5.4,.32,.6,xc,2.35,0,0x2c3436);                              // lamp mast and bar
 g.add(solid(P,181,.1,.8));
 for(let i=0;i<G.GRID.max;i++){const lm=new THREE.MeshBasicMaterial({color:0x7fe0ff,fog:false});lm.userData.own=true;const m=new THREE.Mesh(chargeGeo,lm);
  m.position.set(xc+(i-(G.GRID.max-1)/2)*1.3,2.85,0);g.add(m);gridLamps.push(lm);}
}
function updGrid(dt,t){const n=G.grid|0;
 for(let i=0;i<gridLamps.length;i++){const lm=gridLamps[i];if(i<n)lm.color.setRGB(.5,.88,1);else if(i===n){const b=.18+.14*Math.sin(t*3);lm.color.setRGB(b*.5,b*.88,b);}else lm.color.setRGB(.06,.09,.1);}}

/* ---------- 역장: an energy wall across each lane between emitter posts. It stands BARRIER.up of every BARRIER.cycle seconds
   and flickers in the second before it rises. ---------- */
const wallTex=util.canvasTex(64,64,(c,w,h)=>{c.clearRect(0,0,w,h);const gr=c.createLinearGradient(0,h,0,0);gr.addColorStop(0,'rgba(255,255,255,.75)');gr.addColorStop(.6,'rgba(255,255,255,.22)');gr.addColorStop(1,'rgba(255,255,255,.05)');c.fillStyle=gr;c.fillRect(0,0,w,h);
 c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=1.5;for(let k=0;k<4;k++){c.beginPath();c.moveTo(0,k*16);c.lineTo(w,k*16+8);c.stroke();}c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.stroke();},{repeat:[3,1]});
wallTex.wrapT=THREE.RepeatWrapping;
const wallMat=new THREE.MeshBasicMaterial({map:wallTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:0x78dcff,opacity:0,side:THREE.DoubleSide,fog:false});
const capMat=new THREE.MeshBasicMaterial({color:0x78dcff,fog:false}),lineMat=new THREE.MeshBasicMaterial({color:0x78dcff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.3,fog:false});
const walls=[];let wallK=0;
function buildBarrier(L){
 const g=root.barrier;clear(g);walls.length=0;const x=ctx.wx(G.BARRIER.y),P=[];
 for(let i=0;i<2;i++){const lz=ctx.laneZAt(i,x);
  for(const s of [-1,1]){const z=lz+s*5;B(P,.9,.4,.9,x,.2,z,0x3c4a4e);B(P,.5,3.6,.5,x,2,z,0x5d6461);B(P,.8,.3,.8,x,3.85,z,0x2c3436);
   const cap=new THREE.Mesh(chargeGeo,capMat);cap.position.set(x,4.15,z);g.add(cap);}
  for(const dx of [-.45,.45]){const w=new THREE.Mesh(new THREE.PlaneGeometry(9.6,3.6),wallMat);w.rotation.y=PI/2;w.position.set(x+dx,1.85,lz);w.renderOrder=3;g.add(w);walls.push(w);}
  const top=flat(g,wallMat,.9,9.6,x,3.62,lz,3);walls.push(top);                                   // the top edge: what reads of the wall from the side camera
  strip(g,lineMat,x-1.3,x+1.3,lz,9.6,.08);}
 g.add(solid(P,191,.1,1));
}
function updBarrier(dt,t){
 const live=G.phase==='battle',up=live&&G.barrierUp(),B_=G.BARRIER,ph=G.stageTime%B_.cycle,soon=live&&!up&&B_.cycle-ph<B_.warn;
 wallK=util.damp(wallK,up?1:0,up?14:8,dt);
 const fl=soon&&Math.sin(t*34)>0?.3:0,op=Math.max(wallK*(.8+.2*Math.sin(t*13)),fl);
 wallMat.opacity=op;for(const w of walls)w.visible=op>.01;wallTex.offset.y=(wallTex.offset.y+dt*.6)%1;
 const c=.25+.75*Math.max(wallK,fl*2);capMat.color.setRGB(.47*c,.86*c,1*c);lineMat.opacity=.12+.6*Math.max(wallK,fl*1.5);
}

/* ---------- 모래폭풍: two sheets of blown sand drifting over the whole field (hud.js adds a light haze on top) ---------- */
const sandDraw=seed=>(c,w,h)=>{c.clearRect(0,0,w,h);let r=seed;const R=()=>(r=(r*16807)%2147483647)/2147483647;
 for(let i=0;i<60;i++){const x=R()*w,y=R()*h,rad=12+R()*44,a=.1+R()*.22,sx=1.8+R();
  for(const ox of [-w,0,w])for(const oy of [-h,0,h]){c.save();c.translate(x+ox,y+oy);c.scale(sx,1);const gr=c.createRadialGradient(0,0,0,0,0,rad);gr.addColorStop(0,'rgba(255,255,255,'+a+')');gr.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gr;c.fillRect(-rad,-rad,2*rad,2*rad);c.restore();}}};
const sandTex=[util.canvasTex(256,256,sandDraw(11),{repeat:[3,2]}),util.canvasTex(256,256,sandDraw(29),{repeat:[2,1.5]})];
const sandMat=sandTex.map((tex,i)=>new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,color:i?0xc89a60:0xd8b07a,opacity:i?.55:.45,fog:false}));
function buildStorm(L){
 const g=root.storm;clear(g);const x0=A.xMin,x1=A.xMax+6,d=2*(L.LZ+12);
 flat(g,sandMat[0],x1-x0,d,(x0+x1)/2,1.4,0,4);flat(g,sandMat[1],x1-x0,d,(x0+x1)/2,3.6,0,5);
}
function updStorm(dt){sandTex[0].offset.x=(sandTex[0].offset.x+dt*.07)%1;sandTex[0].offset.y=(sandTex[0].offset.y+dt*.01)%1;sandTex[1].offset.x=(sandTex[1].offset.x+dt*.11)%1;}

const BUILD={gate:buildGate,bridge:buildBridge,tunnel:buildTunnel,cross:buildCross,pylon:buildPylon,flood:buildFlood,boost:buildBoost,hangar:buildHangar,mortar:buildMortar,grid:buildGrid,barrier:buildBarrier,flee:buildFlee,storm:buildStorm};
return{
 layout(L){
  for(const id in root){const on=L.map===id;root[id].visible=on;
   const key=L.mode+'|'+L.laneZ[0]+'|'+L.laneZ[1];if(on&&built[id]!==key){built[id]=key;BUILD[id](L);}}
 },
 update(dt,t){
  if(root.gate.visible)updGate(dt,t);
  if(root.cross.visible)updDeck('cross',false,dt,t);
  if(root.flee.visible)updDeck('flee',true,dt,t);
  if(root.pylon.visible)zapTex.offset.x=(zapTex.offset.x+dt*(1.5+Math.random()))%1,zapMat.opacity=.32+.3*Math.random();
  if(root.flood.visible)updFlood(dt);
  if(root.boost.visible)updBoost(dt);
  if(root.hangar.visible)updHangar(dt,t);
  if(root.mortar.visible)updMortar(dt);
  if(root.grid.visible)updGrid(dt,t);
  if(root.barrier.visible)updBarrier(dt,t);
  if(root.storm.visible)updStorm(dt);
 },
 event(ev){if(ev.t==='cross')flash=1;else if(ev.t==='shock')wFlash=1;else if(ev.t==='stage'){flash=0;wFlash=0;wallK=0;shellsSeen=0;for(const h of hangs){h.open=h.shut=0;}}
  else if(ev.t==='hangar'&&hangs[ev.lane]){if(ev.shut)hangs[ev.lane].shut=.8;else hangs[ev.lane].open=1.5;}}
};
});})();
