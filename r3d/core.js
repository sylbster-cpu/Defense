/* 중계선: 최후의 방어 — 2.5D 렌더러 코어 (three.js r160)
   게임 규칙과 상태는 index.html에 있다. 이 폴더의 파일은 그 상태를 읽어 그리기만 하고 규칙을 바꾸지 않는다.
   WebGL을 쓸 수 없거나 이 파일들이 실패하면 index.html의 2D 캔버스가 그대로 쓰인다.
   구성: core.js(장면·카메라·화면 맞춤·품질) + env.js(지형·조명) + base.js(시설·포탑) + units.js(기체·적) + fx.js(효과) + hud.js(겹쳐 그리는 2D 표시) */
(function(){
'use strict';
const THREE=window.THREE;
if(!THREE)return;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const R3D=window.R3D={ready:false,parts:{},order:['env','base','units','fx','hud'],register(name,create){this.parts[name]=create;}};

/* ---------- shared constants: one world unit = 10 game units ---------- */
const U=0.1;
// Shared palette. Lane 0 (발전소) is amber, lane 1 (정비소) is teal, hostile machines are rust.
R3D.pal={
 amber:0xf0c47b,amberDeep:0xd99b54,teal:0x8dd7d0,tealDeep:0x4fa59c,rust:0xeb806c,cream:0xf2f1e9,good:0xa7d8a3,
 ground:0x1b2a2f,groundWarm:0x33302a,road:0x2a3c41,roadEdge:0x4e696e,metal:0x54707a,metalDark:0x24363c,steel:0x8fa6a8,
 fog:0x3a3530,haze:0xd9965a,sun:0xffcf94,sky:0x16242b,
 enemy:{runner:0xe3b65e,grunt:0xdc876f,brute:0xb86562,boss:0xde9e80},enemyDark:0x4a2f30,enemyEye:0xff5a3c
};
// Size envelope of each enemy type in world units. units.js builds models inside it; fx.js and hud.js aim at it.
R3D.ENEMY={runner:{r:.95,h:1.5,cy:.85},grunt:{r:1.3,h:2.3,cy:1.2},brute:{r:1.75,h:3.1,cy:1.6},boss:{r:2.4,h:4.6,cy:2.3}};

/* ---------- utilities for the parts ---------- */
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_p=new THREE.Vector3(),_s=new THREE.Vector3();
R3D.util={
 clamp,lerp,
 // frame-rate independent approach: v += (target-v) * (1-exp(-rate*dt))
 damp(v,target,rate,dt){return v+(target-v)*(1-Math.exp(-rate*dt));},
 // Matrix4 from position, euler rotation (radians) and scale
 mat(px=0,py=0,pz=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){return new THREE.Matrix4().compose(_p.set(px,py,pz),_q.setFromEuler(_e.set(rx,ry,rz)),_s.set(sx,sy,sz));},
 // Merge many primitives into ONE geometry with vertex colours (one draw call per model).
 // parts: [{g:BufferGeometry, m:Matrix4 (optional), c:colour hex}] -> non-indexed geometry with position/normal/color.
 // Use with new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true}). Input geometries are disposed.
 merge(parts){
  let n=0;const list=[];
  for(const p of parts){let g=p.g.index?p.g.toNonIndexed():p.g;if(p.m)g.applyMatrix4(p.m);if(!g.attributes.normal)g.computeVertexNormals();list.push([g,new THREE.Color(p.c===undefined?0xffffff:p.c)]);n+=g.attributes.position.count;if(g!==p.g)p.g.dispose();}
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);let o=0;
  for(const [g,c] of list){const k=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);for(let i=0;i<k;i++){col[(o+i)*3]=c.r;col[(o+i)*3+1]=c.g;col[(o+i)*3+2]=c.b;}o+=k;g.dispose();}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(pos,3));out.setAttribute('normal',new THREE.BufferAttribute(nor,3));out.setAttribute('color',new THREE.BufferAttribute(col,3));out.computeBoundingSphere();return out;
 },
 // Canvas-drawn texture. draw(ctx2d,w,h). opts: {repeat:[x,y], srgb:true}
 canvasTex(w,h,draw,opts={}){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(opts.srgb!==false)t.colorSpace=THREE.SRGBColorSpace;if(opts.repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(opts.repeat[0],opts.repeat[1]);}t.anisotropy=4;return t;},
 // Deterministic pseudo random in [0,1) from an integer seed (use instead of Math.random for static scenery).
 rand(seed){let x=Math.sin(seed*127.1+311.7)*43758.5453;return x-Math.floor(x);}
};

/* ---------- boot: called once by index.html with the game bridge ---------- */
R3D.boot=function(G,field){
 if(R3D.ready)return R3D.api;
 const base2d=field.querySelector('#game');
 const glc=document.createElement('canvas'),hudc=document.createElement('canvas');
 glc.id='game3d';hudc.id='hud3d';glc.className=hudc.className='r3d';glc.setAttribute('aria-hidden','true');hudc.setAttribute('aria-hidden','true');
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas:glc,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){return null;}
 field.insertBefore(glc,base2d.nextSibling);field.insertBefore(hudc,glc.nextSibling);
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(30,1,1,600);
 const qs=new URLSearchParams(location.search);
 const forcedQ=qs.has('q')?clamp(+qs.get('q')|0,0,2):null;

 // Layout of the world for the current screen. Parts read it in layout(L) and must not cache laneZ elsewhere.
 const L={mode:'side',w:1,h:1,dpr:1,laneZ:[8,-8],LZ:8,camPos:new THREE.Vector3(),camTarget:new THREE.Vector3(),dist:60};
 // Fixed anchors along the lane axis (world X). Enemies walk from spawnX down to leakX (towards -X).
 const A={U,spawnX:(G.LEAK_Y-G.LANE_TOP)*U,leakX:0,droneX:(G.LEAK_Y-G.DRONE_Y)*U,droneH:3.6,turretX:(G.LEAK_Y-G.TURRET_Y)*U,turretH:2.3,turretZ:2.5,
  laneW:8,facX:-5,hubX:-11,xMin:-15,xMax:(G.LEAK_Y-G.LANE_TOP)*U+5};
 const v3=new THREE.Vector3();
 const ctx={THREE,R3D,G,scene,camera,renderer,L,A,U,pal:R3D.pal,ENEMY:R3D.ENEMY,util:R3D.util,quality:forcedQ===null?2:forcedQ,time:0,
  // game y (distance along the lane) -> world x
  wx(y){return (G.LEAK_Y-y)*U;},
  // lane index -> world z of the lane centre
  lz(lane){return L.laneZ[lane];},
  // game x (used by the drone while it slides between lanes) -> world z
  // Maps bend a lane toward the median in stretches: off() is the sideways shift of a lane at world x, laneZAt() its centre line there.
  off(lane,x){const f=G.mapShape;if(!f)return 0;const k=f(lane,G.LEAK_Y-x/U);return k?-Math.sign(L.laneZ[lane])*(L.mode==='side'?2.7:2.05)*k:0;},
  laneZAt(lane,x){return L.laneZ[lane]+ctx.off(lane,x);},
  gz(x){return lerp(ctx.laneZAt(0,A.droneX),ctx.laneZAt(1,A.droneX),(x-G.LANES[0])/(G.LANES[1]-G.LANES[0]));},
  // world position of the support drone body / an enemy centre / a turret muzzle pivot
  dronePos(out){return out.set(A.droneX,A.droneH,ctx.gz(G.drone.x));},
  enemyPos(e,out){const d=R3D.ENEMY[e.type]||R3D.ENEMY.grunt;const x=ctx.wx(e.y);return out.set(x,d.cy,L.laneZ[e.lane]+ctx.off(e.lane,x));},
  turretPos(lane,out){return out.set(A.turretX,A.turretH,Math.sign(L.laneZ[lane])*A.turretZ);},
  // world -> CSS pixel inside the battlefield box (for hud.js). Returns out with .x,.y and .z (ndc depth, >1 is behind far plane)
  project(v,out){v3.copy(v).project(camera);out.x=(v3.x*.5+.5)*L.w;out.y=(-v3.y*.5+.5)*L.h;out.z=v3.z;return out;},
  // approximate CSS pixels covered by one world unit at a world position (for sizing hud marks)
  pxPerUnit(v){const d=v3.copy(v).sub(camera.position).length();return L.h/(2*Math.tan(camera.fov*Math.PI/360)*d);},
  // shake: every event adds trauma (0..1). The picture moves by trauma squared times SHAKE_PX screen pixels, so small events stay small and the big ones read on a phone.
  shake(amount){trauma=Math.min(1,trauma+amount);},
  fxScreen:{white:0,red:0},   // full-screen flashes drawn by hud.js: set to 1 by an event, hud.js lets them fade
  hud:{canvas:hudc,ctx:hudc.getContext('2d')}
 };
 // shared soft round sprite texture for glows and particles
 ctx.tex={glow:R3D.util.canvasTex(64,64,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);})};

 const inst=[];
 for(const name of R3D.order){const create=R3D.parts[name];if(!create)continue;const p=create(ctx)||{};p.name=name;inst.push(p);}

 /* ---------- camera: frame the whole play area for the current box ---------- */
 const dir=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),fitPts=[];
 function fit(target,pts,mg){
  const t=target;let dist=70;
  for(let k=0;k<10;k++){
   camera.position.copy(t).addScaledVector(dir,dist);camera.lookAt(t);camera.updateMatrixWorld(true);
   let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
   for(const p of pts){v3.copy(p).project(camera);x0=Math.min(x0,v3.x);x1=Math.max(x1,v3.x);y0=Math.min(y0,v3.y);y1=Math.max(y1,v3.y);}
   const ax0=-1+2*mg.l,ax1=1-2*mg.r,ay0=-1+2*mg.b,ay1=1-2*mg.t;
   const s=Math.max((x1-x0)/(ax1-ax0),(y1-y0)/(ay1-ay0));
   const hh=Math.tan(camera.fov*Math.PI/360)*dist,hw=hh*camera.aspect;
   right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);
   t.addScaledVector(right,((x0+x1)/2-(ax0+ax1)/2)*hw).addScaledVector(up,((y0+y1)/2-(ay0+ay1)/2)*hh);
   dist*=s;
  }
  camera.position.copy(t).addScaledVector(dir,dist);camera.lookAt(t);camera.updateMatrixWorld(true);
  L.dist=dist;L.camPos.copy(camera.position);L.camTarget.copy(t);
 }
 let needLayout=true,boxW=0,boxH=0;
 function layout(){
  needLayout=false;
  const box=field.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height),dpr=window.devicePixelRatio||1;
  boxW=w;boxH=h;L.w=w;L.h=h;L.dpr=dpr;
  // 'side': wide phone screen, lanes run left to right, 발전소 lane behind (top), 정비소 lane in front (bottom).
  // 'behind': tall or square screen, camera stands behind the base, 발전소 lane on the left, 정비소 lane on the right.
  L.mode=G.compact()?'side':'behind';
  if(L.mode==='side'){L.LZ=8.5;L.laneZ=[L.LZ,-L.LZ];camera.fov=24;dir.set(0,Math.sin(54*Math.PI/180),-Math.cos(54*Math.PI/180)).normalize();}
  else{L.LZ=7;L.laneZ=[-L.LZ,L.LZ];camera.fov=30;dir.set(-Math.cos(50*Math.PI/180),Math.sin(50*Math.PI/180),0).normalize();}
  camera.aspect=w/h;camera.near=2;camera.far=900;camera.updateProjectionMatrix();
  const zr=L.LZ+A.laneW/2+.5;fitPts.length=0;
  for(const x of [A.xMin+2,A.spawnX+(L.mode==='side'?4.5:1.5)])for(const z of [-zr,zr])fitPts.push(new THREE.Vector3(x,0,z));
  for(const z of [-zr,zr])fitPts.push(new THREE.Vector3(A.droneX,A.droneH+1.2,z),new THREE.Vector3(A.facX,5,z));
  fit(new THREE.Vector3((A.xMin+A.spawnX)/2,0,0),fitPts,L.mode==='side'?{l:.015,r:.015,t:.13,b:.05}:{l:.03,r:.03,t:.075,b:.035});
  applyQuality();
  const hd=Math.min(3,dpr);hudc.width=Math.round(w*hd);hudc.height=Math.round(h*hd);L.hudScale=hd;
  for(const p of inst)if(p.layout)p.layout(L);
 }
 function applyQuality(){
  const cap=[1,1.5,2][ctx.quality];renderer.setPixelRatio(Math.min(L.dpr,cap));renderer.setSize(boxW,boxH,false);
 }
 function setQuality(q){q=clamp(q,0,2);if(q===ctx.quality)return;ctx.quality=q;applyQuality();for(const p of inst)if(p.quality)p.quality(q);}
 if(window.ResizeObserver)new ResizeObserver(()=>{needLayout=true;}).observe(field);
 window.addEventListener('resize',()=>{needLayout=true;});
 window.addEventListener('orientationchange',()=>{needLayout=true;});

 /* ---------- frame ---------- */
 const SHAKE_PX=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)?5:14;
 let last=0,trauma=0,frameNo=0,slowAcc=0,slowN=0,settle=.8,tooSlow=0,modeSeen='',mapSeen='';
 const shakeOff=new THREE.Vector3();
 function frame(now){
  const raw=Math.min(1,Math.max(0,(now-last)/1000||0)),dt=Math.min(.1,raw);last=now;frameNo++;
  const mode=G.compact()?'side':'behind';
  if(G.mapId!==mapSeen){mapSeen=G.mapId;L.map=mapSeen;needLayout=true;}   // a new map: every part lays itself out again
  if(needLayout||mode!==modeSeen){modeSeen=mode;layout();settle=.6;slowAcc=0;slowN=0;}
  // dialogs cover the field: keep the scene alive but cheap
  const covered=G.phase!=='battle'&&G.phase!=='practice';
  const evs=G.events;
  if(evs.length){for(let i=0;i<evs.length;i++){const ev=evs[i];for(const p of inst)if(p.event)p.event(ev,G);}evs.length=0;}
  ctx.time+=dt;ctx.dt=dt;
  if(covered&&frameNo%3){return;}
  const step=covered?dt*3:dt;
  for(const p of inst)if(p.update)p.update(step,ctx.time,G);
  if(trauma>.002){trauma=Math.max(0,trauma-dt*1.6);const k=trauma*trauma*SHAKE_PX/Math.max(1,ctx.pxPerUnit(L.camTarget)),tt=ctx.time,nx=Math.sin(tt*53.1+1.7)*.6+Math.sin(tt*31.3+4.1)*.4,ny=Math.sin(tt*47.7+.3)*.6+Math.sin(tt*27.1+2.9)*.4,m=camera.matrixWorld.elements;
   camera.position.copy(L.camPos);camera.position.x+=(m[0]*nx+m[4]*ny)*k;camera.position.y+=(m[1]*nx+m[5]*ny)*k;camera.position.z+=(m[2]*nx+m[6]*ny)*k;}
  else camera.position.copy(L.camPos);
  renderer.render(scene,camera);
  // adaptive quality: measured in 1.5 s windows while actually playing. It only ever steps down (30 fps capped devices stay put),
  // The game is played in 2.5D only: a slow device stays at the lowest level; the 2D canvas is used only when WebGL cannot run at all.
  if(forcedQ===null&&!covered&&!G.paused&&dt>0){
   if(settle>0)settle-=raw;
   else{slowAcc+=raw;slowN++;
    if(slowAcc>=1.5&&slowN>=6){const avg=slowAcc/slowN;slowAcc=0;slowN=0;
     if(ctx.quality>0){if(avg>.036){setQuality(avg>.06?0:ctx.quality-1);settle=.6;}}
    }}
  }
 }
 glc.addEventListener('webglcontextlost',ev=>{ev.preventDefault();G.active=false;field.classList.remove('r3d-on');});
 for(const p of inst)if(p.quality)p.quality(ctx.quality);
 R3D.ctx=ctx;R3D.ready=true;
 // which lane a touch belongs to: the boundary is the median strip as drawn, not the middle of the box
 const tapV=new THREE.Vector3(),tapP={x:0,y:0,z:0};
 function laneAt(cx,cy){const b=field.getBoundingClientRect();tapV.set(A.droneX,0,0);ctx.project(tapV,tapP);return L.mode==='side'?((cy-b.top)<tapP.y?0:1):((cx-b.left)<tapP.x?0:1);}
 // where a touch lands on the ground: the lane whose centre line is nearer there, and the distance along it
 function fieldPos(cx,cy){const b=field.getBoundingClientRect(),nx=(cx-b.left)/b.width*2-1,ny=1-(cy-b.top)/b.height*2;tapV.set(nx,ny,-1).unproject(camera);const ax=tapV.x,ay=tapV.y,az=tapV.z;tapV.set(nx,ny,1).unproject(camera);
  const k=ay/((ay-tapV.y)||1e-9),x=ax+(tapV.x-ax)*k,z=az+(tapV.z-az)*k;return{lane:Math.abs(z-ctx.laneZAt(0,x))<=Math.abs(z-ctx.laneZAt(1,x))?0:1,y:G.LEAK_Y-x/U};}
 // where a point of a lane is drawn, in page pixels (lane, distance along it, height above the road)
 function screenOf(lane,y,h){const x=ctx.wx(y);tapV.set(x,h||0,ctx.laneZAt(lane,x));ctx.project(tapV,tapP);const b=field.getBoundingClientRect();return{x:b.left+tapP.x,y:b.top+tapP.y};}
 R3D.api={frame,setQuality,laneAt,fieldPos,screenOf,get quality(){return ctx.quality;},info:()=>({q:ctx.quality,mode:L.mode,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,geoms:renderer.info.memory.geometries,tex:renderer.info.memory.textures,pr:renderer.getPixelRatio()}),hudCanvas:hudc};
 return R3D.api;
};
})();
