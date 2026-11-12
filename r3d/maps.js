/* maps.js — 맵마다 붙는 지형물: 관문의 차단문, 다리와 낭떠러지, 터널, 샛길. 게임 상태를 읽기만 한다. */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('maps',ctx=>{
const {scene,util}=ctx,G=ctx.G,mat=util.mat,merge=util.merge,PI=Math.PI;
const B=(P,w,h,d,x,y,z,c,ry,rx,rz)=>P.push({g:new THREE.BoxGeometry(w,h,d),m:mat(x,y,z,rx||0,ry||0,rz||0),c});
const hash=(x,y)=>{const h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h);};
// lumpy boulder: a dodecahedron with every corner pushed in or out (as in env.js)
function rock(P,x,y,z,sx,sy,sz,c,seed){
 const g=new THREE.DodecahedronGeometry(1,0),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const X=p.getX(i),Y=p.getY(i),Z=p.getZ(i),k=.7+.55*hash(seed+Math.round(X*40)+Math.round(Y*90)*3.1,Math.round(Z*50)*1.7+seed*.37);p.setXYZ(i,X*k,Y*k,Z*k);}
 g.computeVertexNormals();P.push({g,m:mat(x,y,z,hash(seed,1)*.5,hash(seed,2)*6.28,hash(seed,3)*.5,sx,sy,sz),c});
}
const propMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.92,metalness:.04});
// merged mesh with per-facet tone jitter and a darker foot (the hand-painted look of env.js)
function solid(P,seed,jit,foot){const g=merge(P),p=g.attributes.position.array,c=g.attributes.color.array;let r=seed*7919+17;const R=()=>(r=(r*16807)%2147483647)/2147483647;
 for(let i=0;i<p.length;i+=9){const k=1+(R()-.5)*(jit||.16);for(let j=0;j<9;j+=3){const f=foot===0?1:.62+.38*Math.min(1,Math.max(0,p[i+j+1]/(foot||1.1)));c[i+j]*=k*f;c[i+j+1]*=k*f;c[i+j+2]*=k*f;}}
 const m=new THREE.Mesh(g,propMat);m.castShadow=true;m.receiveShadow=true;return m;}
function clear(g){for(let i=g.children.length-1;i>=0;i--){const o=g.children[i];g.remove(o);o.traverse(q=>{if(q.geometry&&!q.geometry.userData.keep)q.geometry.dispose();});}}
const root={gate:new THREE.Group(),bridge:new THREE.Group(),tunnel:new THREE.Group(),cross:new THREE.Group()},built={};
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
  const lm=new THREE.MeshBasicMaterial({color:RED,fog:false});
  const bar=new THREE.Mesh(barGeo,lm);bar.position.set(x,4.08,z0);g.add(bar);                    // the signal bar: red shut, green open, seen from any camera
  for(const s of [-1,1]){const m=new THREE.Mesh(lampGeo,lm);m.position.set(x+s*.47,3.75,z0);g.add(m);}
  gates.push({piv,lm,sg,ang:0});
 }
}
function updGate(dt,t){
 const half=G.GATE.half,rem=half-((+G.stageTime||0)%half),live=G.phase==='battle';
 for(let i=0;i<gates.length;i++){const q=gates[i],shut=live&&G.gateShut(i);
  q.ang=util.damp(q.ang,shut?0:1.3,shut?9:5,dt);q.piv.rotation.x=q.sg*q.ang;
  const blink=live&&rem<1&&Math.sin(t*26)>0;q.lm.color.setHex(shut?(blink?DARK:RED):(blink?AMBER:GREEN));}   // open: amber blinks in the last second before it shuts
}

/* ---------- 다리: a chasm across the field; each lane crosses it on a railed deck ---------- */
const pitMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,map:util.canvasTex(256,8,(c,w,h)=>{
 const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(3,4,5,0)');g.addColorStop(.09,'rgba(3,4,5,.88)');g.addColorStop(.2,'rgba(2,3,4,.97)');g.addColorStop(.8,'rgba(2,3,4,.97)');g.addColorStop(.91,'rgba(3,4,5,.88)');g.addColorStop(1,'rgba(3,4,5,0)');c.fillStyle=g;c.fillRect(0,0,w,h);})});
function buildBridge(L){
 const g=root.bridge;clear(g);const x0=ctx.wx(G.BRIDGE[1]),x1=ctx.wx(G.BRIDGE[0]),xc=(x0+x1)/2,len=x1-x0,zs=[ctx.laneZAt(0,xc),ctx.laneZAt(1,xc)];
 const pit=new THREE.Mesh(new THREE.PlaneGeometry(len+1.8,96),pitMat);pit.rotation.x=-PI/2;pit.position.set(xc,.014,0);pit.renderOrder=1;g.add(pit);
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
 const g=root.tunnel;clear(g);const xa=ctx.wx(G.TUNNEL[1]),xb=ctx.wx(G.TUNNEL[0]),xc=(xa+xb)/2,len=xb-xa,zs=[L.laneZ[0],L.laneZ[1]],zo=L.LZ+6.8,P=[];
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

/* ---------- 샛길: a deck between the lanes where they meet. Chevrons show which way machines will cross: away from the drone. ---------- */
const chevTex=util.canvasTex(64,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(255,236,190,1)';c.lineWidth=12;c.lineCap='round';c.lineJoin='round';
 for(let k=0;k<2;k++){const y=18+k*64;c.beginPath();c.moveTo(10,y+26);c.lineTo(w/2,y);c.lineTo(w-10,y+26);c.stroke();}},{repeat:[1,1]});
chevTex.wrapT=THREE.RepeatWrapping;
const chevMat=new THREE.MeshBasicMaterial({map:chevTex,transparent:true,depthWrite:false,color:0xffd48a,opacity:.85,fog:false});
let chev=null,cz=[0,0],flash=0;
function buildCross(L){
 const g=root.cross;clear(g);const x=ctx.wx(G.CROSS_Y),z0=ctx.laneZAt(0,x),z1=ctx.laneZAt(1,x),sg=Math.sign(z1-z0)||1;
 const a=z0+sg*3.6,b=z1-sg*3.6,len=Math.abs(b-a),zc=(a+b)/2,P=[];cz=[z0,z1];
 B(P,4.6,.08,len,x,.04,zc,0x4a5153);
 for(const s of [-1,1]){B(P,.28,.3,len-1.2,x+s*2.45,.15,zc,0x646660);for(const e of [a,b])B(P,.4,.5,.4,x+s*2.45,.25,e+(e===a?sg:-sg)*.6,0x33393b);}
 g.add(solid(P,91,.1,.4));
 chev=new THREE.Mesh(new THREE.PlaneGeometry(3.2,Math.max(1.2,len-.6)),chevMat);chev.rotation.set(-PI/2,0,0);chev.position.set(x,.1,zc);chev.renderOrder=2;g.add(chev);
 chevTex.repeat.set(1,Math.max(1,(len-.6)/2.6));
}
function updCross(dt,t){
 if(!chev)return;const d=G.drone,from=d?d.lane:0,dir=Math.sign(cz[1-from]-cz[from]);   // machines go from the drone's lane to the other one
 chev.rotation.z=dir<0?0:PI;chevTex.offset.y=(chevTex.offset.y-dt*1.1)%1;
 flash=Math.max(0,flash-dt*2.5);chevMat.opacity=Math.min(1,.62+.18*Math.sin(t*4)+.4*flash);
}

const BUILD={gate:buildGate,bridge:buildBridge,tunnel:buildTunnel,cross:buildCross};
return{
 layout(L){
  for(const id in root){const on=L.map===id;root[id].visible=on;
   const key=L.mode+'|'+L.laneZ[0]+'|'+L.laneZ[1];if(on&&built[id]!==key){built[id]=key;BUILD[id](L);}}
 },
 update(dt,t){
  if(root.gate.visible)updGate(dt,t);
  if(root.cross.visible)updCross(dt,t);
 },
 event(ev){if(ev.t==='cross')flash=1;else if(ev.t==='stage')flash=0;}
};
});})();
