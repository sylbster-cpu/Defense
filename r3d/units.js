/* units.js — 지원 기체와 적 기계 네 종(질주형·보병형·중장갑·거대 병기): 모델, 걸음·궤도 움직임, 상태 표시, 사거리 표식 */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('units',ctx=>{
const {scene,camera,renderer,pal,ENEMY,A,util}=ctx,{clamp,lerp,damp,mat}=util;
const PI=Math.PI,TAU=PI*2;
const GY=.05;        // enemy feet height: env.js lays the road at y = .025
const DY=.3;         // height of the ground decals (range marks, slow rings, light pool): clear of the road's polygon offset at any screen size
const POP=.25;       // spawn pop-in time (s)
const DIE=.2;         // collapse time after a kill (s); fx.js covers it with the explosion
const FALL=.7;        // a machine knocked off a bridge: time to slide over the edge and drop out of sight
let Q=ctx.quality;

/* ====================================================================== */
/* 1. Geometry helpers: every model is ONE merged geometry with vertex colours.
      Extra per-vertex data: aPiv = pivot of the limb a vertex belongs to,
      aFx = (glow strength, limb mode, phase offset, amplitude).            */
/* ====================================================================== */
const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const cyl=(rt,rb,h,n)=>new THREE.CylinderGeometry(rt,rb,h,n);
// box whose top face is scaled by (tx,tz) and shifted by (ox,oz): bevels, pyramids, swept fins
function tapY(w,h,d,tx,tz,ox,oz){const g=box(w,h,d),p=g.attributes.position;
 for(let i=0;i<p.count;i++)if(p.getY(i)>0)p.setXYZ(i,p.getX(i)*tx+(ox||0),p.getY(i),p.getZ(i)*tz+(oz||0));
 g.computeVertexNormals();return g;}
// box along X whose cross-section goes from (h0,d0) at the back to (h1,d1) at the front.
// flat: 0 keeps the centre line, 1 keeps the bottom flat, -1 keeps the top flat
function tapX(len,h0,d0,h1,d1,flat){const g=box(len,1,1),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const f=p.getX(i)>0,h=f?h1:h0,d=f?d1:d0,yu=p.getY(i);
  p.setXYZ(i,p.getX(i),flat>0?(yu+.5)*h-h0/2:flat<0?h0/2-(.5-yu)*h:yu*h,p.getZ(i)*d);}
 g.computeVertexNormals();return g;}
const mixc=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t).getHex();
// part list builder: add(geometry, colour, x,y,z, rx,ry,rz, {glow, limb:[mode,px,py,pz,phase,amp], m})
// limb modes (animated in the vertex shader): 1 leg swing about Z, 2 wheel roll about Z, 3 slow spin about Y
const adder=list=>(g,c,x,y,z,rx,ry,rz,o)=>{const q={g,c,m:mat(x||0,y||0,z||0,rx||0,ry||0,rz||0),glow:0,limb:null};if(o)Object.assign(q,o);list.push(q);return q;};
// wide: optional widening of the finished model in x and z (pivots follow)
function build(parts,wide){
 const cnt=parts.map(p=>p.g.index?p.g.index.count:p.g.attributes.position.count),n=cnt.reduce((a,b)=>a+b,0),w=wide||1;
 const g=util.merge(parts),piv=new Float32Array(n*3),fx=new Float32Array(n*4);let o=0;
 parts.forEach((p,i)=>{const L=p.limb;for(let k=0;k<cnt[i];k++,o++){fx[o*4]=p.glow;if(L){piv[o*3]=L[1]*w;piv[o*3+1]=L[2];piv[o*3+2]=L[3]*w;fx[o*4+1]=L[0];fx[o*4+2]=L[4];fx[o*4+3]=L[5];}}});
 if(w!==1)g.scale(w,1,w);
 g.setAttribute('aPiv',new THREE.BufferAttribute(piv,3));g.setAttribute('aFx',new THREE.BufferAttribute(fx,4));return g;
}

// Hostile body colours: pal.enemy pushed apart in hue AND value, so the four types still separate when a machine
// is 13-30 px wide on a warm brown world. Yellow dart / orange box / dark crimson ram behind a pale shield / peach tower under a black crown.
const HC={runner:mixc(pal.enemy.runner,0xffc21a,.7),grunt:mixc(pal.enemy.grunt,0xee5a14,.6),brute:mixc(pal.enemy.brute,0x8e1420,.7),boss:mixc(pal.enemy.boss,0xf0b890,.35)};
const HDARK=mixc(pal.enemyDark,0x120a0c,.45);   // near-black maroon for joints, treads and the boss crown
const EYE=mixc(pal.enemyEye,0xffa040,.3);       // emissive pieces run a little hotter than pal.enemyEye so they bloom to orange, not to dull red

/* ---------- runner: low yellow dart on four scuttling legs ---------- */
function runnerGeo(){const p=[],add=adder(p),c=HC.runner,dk=HDARK,c2=mixc(c,pal.enemyDark,.6),hi=mixc(c,0xfff2b8,.4),eye=EYE;
 add(tapX(1.4,.22,.86,.1,.16,-1),dk,.05,.44,0);                                 // belly
 add(tapX(1.57,.5,1.44,.12,.2,1),c,.165,.8,0);                                  // wedge shell: a triangle from above, nose at the envelope edge
 add(tapX(.84,.3,.5,.1,.22,1),c2,-.2,1.1,0);                                    // dark engine spine
 add(tapY(.62,.42,.1,.3,1,-.24,0),hi,-.36,1.38,0);                              // swept tail fin
 add(box(.32,.1,.5),eye,.44,.83,0,0,0,-.24,{glow:1.7});                         // eye strip on the nose slope (seen from above)
 add(box(.12,.1,.14),eye,.9,.63,0,0,0,0,{glow:1.7});                            // nose tip
 for(const s of [1,-1])add(box(.08,.22,.3),eye,-.63,.84,s*.36,0,0,0,{glow:1.2});  // exhaust ports
 for(const [x,f] of [[.26,0],[-.38,1]])for(const s of [1,-1]){
  const limb=[1,x,.56,s*.36,(f^(s>0?0:1))?PI:0,.5];
  add(box(.13,.13,.3),dk,x,.63,s*.47,-s*.6,0,0,{limb});                         // thigh, up and out
  add(tapY(.12,.74,.12,1.5,1.5),dk,x,.36,s*.66,-s*.2,0,0,{limb});               // shin
  add(box(.2,.3,.06),c,x,.46,s*.72,-s*.2,0,0,{limb});                           // shin guard: makes the scuttle readable
 }
 return build(p);}

/* ---------- grunt: boxy orange walker on two reverse-jointed legs ---------- */
function gruntGeo(){const p=[],add=adder(p),c=HC.grunt,dk=HDARK,c2=mixc(c,pal.enemyDark,.4),c3=mixc(c,pal.enemyDark,.75),hi=mixc(c,0xffa050,.25),eye=EYE;
 add(box(.66,.3,.8),dk,0,.98,0);                                                // pelvis
 add(cyl(.16,.16,1.24,6),dk,0,1,0,PI/2);                                        // hip axle
 add(tapY(1.1,.25,1.1,1.3,1.3),c2,0,1.2,0);                                     // lower bevel
 add(box(1.46,.5,1.46),c,0,1.575,0);                                            // torso
 add(tapY(1.46,.22,1.46,.78,.78),hi,0,1.935,0);                                 // top bevel
 add(box(.46,.08,.74),c3,-.24,2.08,0);                                          // hatch
 add(box(.36,.1,1.52),dk,.6,1.8,0);                                             // brow
 add(box(.2,.1,1),eye,.42,2.05,0,0,0,0,{glow:1.7});                             // roof lamp bar (seen from above)
 add(box(.16,.26,1.1),dk,.78,1.36,0);                                           // jaw bumper
 add(box(.1,.22,1.24),eye,.74,1.61,0,0,0,0,{glow:1.7});                         // visor, front
 for(const s of [1,-1]){
  add(box(.5,.22,.1),eye,.48,1.61,s*.74,0,0,0,{glow:1.5});                      // visor, wrapping round the sides
  add(box(.7,.42,.26),c3,-.05,1.6,s*.86);                                       // shoulder pods
  add(cyl(.11,.13,.42,6),dk,-.6,1.97,s*.38);                                    // exhaust stacks
  add(cyl(.08,.08,.03,6),eye,-.6,2.19,s*.38,0,0,0,{glow:1});
  const limb=[1,0,1,s*.5,s>0?0:PI,.42];
  add(box(.32,.62,.34),dk,.14,.76,s*.5,0,0,.5,{limb});                          // thigh
  add(box(.3,.3,.42),c,.3,.52,s*.5,0,0,0,{limb});                               // knee armour
  add(box(.22,.62,.26),dk,.17,.3,s*.5,0,0,-.55,{limb});                         // shin
  add(box(.72,.12,.44),c3,.14,.06,s*.5,0,0,0,{limb});                           // foot
 }
 return build(p,1.2);}   // widened to fill its envelope

/* ---------- brute: wide dark-crimson tracked ram behind a pale dozer shield ---------- */
function bruteGeo(){const p=[],add=adder(p),c=HC.brute,dk=HDARK,c2=mixc(c,dk,.5),cL=mixc(c,0xf0604a,.4),sh=mixc(pal.enemy.boss,pal.cream,.25),tr=mixc(dk,0x000000,.3),wh=mixc(dk,c,.4),eye=EYE;
 for(const s of [1,-1]){const z=s*.98;
  add(box(1.7,.62,.5),tr,0,.37,z);                                              // tread belt
  for(const x of [-.8,-.27,.27,.8]){const limb=[2,x,.37,z,x*2,-1/.36];
   add(cyl(.36,.36,.6,8),wh,x,.37,z,PI/2,0,0,{limb});                           // road wheels (roll with distance)
   add(box(.34,.1,.06),cL,x,.37,s*1.29,0,0,0,{limb});}                          // hub bar that makes the roll visible
  add(box(2.2,.1,.66),c,0,.78,z);                                               // fender
  add(tapY(1.1,.42,.62,.7,.6),cL,-.15,2.3,s*.9);                                // pauldron
  add(box(.24,.08,.24),dk,-.15,2.53,s*.9);
  add(cyl(.15,.18,.8,6),dk,-.85,2.45,s*.45);                                    // exhaust stacks
  add(cyl(.11,.11,.03,6),eye,-.85,2.86,s*.45,0,0,0,{glow:1});
  add(box(.6,.12,.06),eye,-.3,1.25,s*.77,0,0,0,{glow:1.3});                     // side vents
 }
 add(box(2,.75,1.5),c2,-.1,1.05,0);                                             // hull
 add(tapY(1.7,.75,2.3,.7,.78,-.1,0),c,-.15,1.8,0);                              // hunched upper body
 add(box(.55,.7,1.5),dk,-1,1.2,0);                                              // engine block
 add(box(.5,.4,.8),dk,.72,1.72,0);                                              // head
 add(box(.1,.22,.56),eye,.98,1.74,0,0,0,0,{glow:1.7});                          // eye, front
 add(box(.34,.08,.5),eye,.72,1.95,0,0,0,0,{glow:1.7});                          // eye, top lamp (seen from above)
 add(tapY(.34,1.25,2.4,1,.88),sh,1,1,0,0,0,.18);                                // dozer shield
 for(const z of [-.6,0,.6])add(box(.07,.74,.16),dk,1.16,1,z,0,0,.18);
 return build(p);}

/* ---------- boss: pale hexagonal siege tower on four legs, black turning crown around a big glowing core ---------- */
function bossGeo(){const p=[],add=adder(p),c=HC.boss,dk=HDARK,c2=mixc(pal.enemy.brute,dk,.45),cL=mixc(c,0xfff4dc,.55),eye=EYE;
 for(const sx of [1,-1])for(const sz of [1,-1]){
  const limb=[1,sx*.75,1.75,sz*.75,sx*sz>0?0:PI,.2];
  add(tapY(.85,.3,.85,.7,.7),dk,sx*1.25,.15,sz*1.25,0,0,0,{limb});              // foot
  add(tapY(.5,1.25,.5,1.25,1.25),c,sx*1.25,.9,sz*1.25,0,0,0,{limb});            // shin
  add(box(.66,.5,.66),dk,sx*1.22,1.7,sz*1.22,0,PI/4,0,{limb});                  // knee
  add(box(.9,.36,.4),c2,sx*.95,1.82,sz*.95,0,-sx*sz*PI/4,0,{limb});             // thigh
 }
 add(cyl(1.5,1.3,.8,6),c2,0,1.75,0);                                            // lower hull
 add(cyl(1.62,1.62,.16,6),dk,0,2.15,0);
 add(cyl(1.02,1.4,1.05,6),c,0,2.72,0);                                          // tower
 for(const s of [1,-1]){
  add(tapY(1.4,1.3,.24,.7,1),c,-.1,2.45,s*1.52,-s*.12);                         // side shields
  add(box(.9,.14,.28),dk,-.1,2.3,s*1.55,-s*.12);
  add(cyl(.16,.2,.9,6),dk,-1.2,3.2,s*.5);                                       // smokestacks
  add(box(.56,.36,.08),eye,-.1,2.78,s*1.63,-s*.12,0,0,{glow:1.2});                // furnace window in each shield
 }
 add(box(.7,1.1,1.5),dk,-1.25,2.35,0);                                          // reactor block
 add(tapX(1,.55,1.7,.2,.7,1),c2,1.5,1.4,0);                                     // ram prow
 add(cyl(.72,.72,.14,8),dk,1.12,2.62,0,0,0,PI/2);                               // eye socket
 add(cyl(.52,.52,.1,8),eye,1.2,2.62,0,0,0,PI/2,{glow:1.5});                     // eye
 add(cyl(.22,.22,.06,6),0xffd39a,1.25,2.62,0,0,0,PI/2,{glow:2});
 add(box(.34,.16,1.5),dk,1.05,3.12,0);                                          // brow
 const spin=[3,0,0,0,0,.25];
 add(cyl(1.16,1.04,.24,12),dk,0,3.36,0,0,0,0,{limb:spin});                      // crown ring
 add(cyl(.56,.8,.25,6),dk,0,3.5,0);
 add(new THREE.IcosahedronGeometry(.62,0),eye,0,3.98,0,0,0,0,{glow:1.8,limb:[3,0,0,0,0,-.75]});   // core
 for(let k=0;k<6;k++){const a=k*TAU/6+PI/6;                                     // crown spikes lean outwards
  const m=new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(.34));m.setPosition(Math.sin(a)*1.1,3.92,Math.cos(a)*1.1);
  add(cyl(.05,.3,1.1,4),cL,0,0,0,0,0,0,{m,limb:spin});}
 return build(p);}

/* ---------- support drone: cream quad-fan gunship, nose towards +X, origin at ctx.dronePos ---------- */
const DUCTS=[[.85,1.3],[.85,-1.3],[-.85,1.3],[-.85,-1.3]];
const TEAL_LIT=0x52e0cf;   // lights are a deeper teal than pal.teal so they stay coloured when they glow
function droneGeo(){const p=[],add=adder(p),cr=pal.cream,st=pal.steel,mt=pal.metal,dk=pal.metalDark,tl=TEAL_LIT;
 add(box(1.5,.62,1.06),cr,0,.2,0);                                              // fuselage
 add(tapX(1.05,.62,1.06,.2,.36,0),cr,1.275,.2,0);                               // nose
 add(tapX(1.15,.2,.28,.62,1.06,-1),st,-1.325,.41,0);                            // tail boom
 add(box(1.1,.06,.56),st,-.1,.53,0);                                            // top panel
 add(tapX(.7,.18,.5,.06,.24,1),dk,1.08,.5,0,0,0,-.2);                           // canopy
 add(box(.14,.1,.4),tl,1.5,.4,0,0,0,-.2,{glow:.9});                             // sensor eye
 add(box(.8,.03,.14),tl,-.15,.565,0,0,0,0,{glow:.85});                          // top light strip
 add(box(.36,.04,.36),tl,-.25,-.11,0,0,0,0,{glow:.85});                         // belly lamp
 add(box(.3,.2,.3),mt,.45,-.15,0);                                              // weapon pod under the nose
 add(box(.9,.3,.5),dk,.55,-.36,0);
 add(tapX(.3,.3,.5,.16,.3,0),dk,1.15,-.36,0);
 for(const s of [1,-1]){
  add(box(1.1,.08,.05),tl,0,.3,s*.54,0,0,0,{glow:.85});                         // side light strips
  add(cyl(.06,.06,.9,6),mt,1.5,-.36,s*.13,0,0,PI/2);                            // twin barrels
  add(cyl(.085,.085,.1,6),dk,1.92,-.36,s*.13,0,0,PI/2);
  add(cyl(.17,.2,.4,6),dk,-.9,.18,s*.56,0,0,PI/2);                              // thrusters
  add(cyl(.13,.13,.04,6),tl,-1.11,.18,s*.56,0,0,PI/2,{glow:1.1});
  add(tapY(.5,.55,.07,.45,1,-.2,0),st,-1.6,.72,s*.2,s*.45);                     // V tail
  add(box(.12,.06,.1),tl,-1.74,.97,s*.33,0,0,0,{glow:1});
  add(box(.3,.14,2.6),cr,s*.85,.24,0);                                          // outrigger beams
 }
 for(const [x,z] of DUCTS){
  add(new THREE.TorusGeometry(.58,.12,5,12),cr,x,.26,z,PI/2);                   // fan ducts
  add(cyl(.13,.13,.18,6),dk,x,.26,z);
  add(box(1.1,.05,.08),dk,x,.26,z);
  add(box(.3,.08,.06),tl,x,.26,z+Math.sign(z)*.7,0,0,0,{glow:.85});             // wingtip lights
 }
 return build(p);}

/* ====================================================================== */
/* 2. Materials. One patched standard material draws every enemy (instanced),
      a second copy draws the drone. The patch adds: per-vertex glow, limb
      animation in the vertex shader, hit flash and the dull "slowed" tint.  */
/* ====================================================================== */
const animPars=inst=>'attribute vec3 aPiv;attribute vec4 aFx;'+(inst?'attribute vec4 iAnim;\n#define UANIM iAnim\n':'uniform vec4 uAnim;\n#define UANIM uAnim\n');
// UANIM = (walk phase, flash, dull, spin clock)
const ANIM_VERT=`
if(aFx.y>.5){vec3 q=transformed-aPiv;float a;
 if(aFx.y<1.5){float ph=UANIM.x+aFx.z;a=sin(ph)*aFx.w;q.xy=vec2(cos(a)*q.x-sin(a)*q.y,sin(a)*q.x+cos(a)*q.y);q.y+=max(0.,cos(ph))*abs(aFx.w)*aPiv.y*.45;}
 else if(aFx.y<2.5){a=UANIM.x*aFx.w+aFx.z;q.xy=vec2(cos(a)*q.x-sin(a)*q.y,sin(a)*q.x+cos(a)*q.y);}
 else{a=UANIM.w*aFx.w+aFx.z;q.xz=vec2(cos(a)*q.x-sin(a)*q.z,sin(a)*q.x+cos(a)*q.z);}
 transformed=aPiv+q;}
`;
function unitMat(inst,amb,opts){
 const m=new THREE.MeshStandardMaterial(Object.assign({vertexColors:true,flatShading:true},opts));
 m.userData.uGlow={value:1};m.userData.uAmb={value:amb};m.userData.uAnim={value:new THREE.Vector4()};
 m.onBeforeCompile=sh=>{sh.uniforms.uGlow=m.userData.uGlow;sh.uniforms.uAmb=m.userData.uAmb;if(!inst)sh.uniforms.uAnim=m.userData.uAnim;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+animPars(inst)+'varying float vGlow;varying vec2 vTint;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvGlow=aFx.x;vTint=UANIM.yz;'+ANIM_VERT);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uGlow,uAmb;varying float vGlow;varying vec2 vTint;')
   .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,(vec3(dot(diffuseColor.rgb,vec3(.3,.5,.2)))*vec3(.8,.66,.5)+vec3(.035,.028,.02))*.7,vTint.y*.5)*(1.-.18*vTint.y);')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*uAmb*(.5+max(0.,dot(normal,viewMatrix[1].xyz)))+vColor.rgb*vGlow*uGlow*(1.-vTint.y*.45)+(diffuseColor.rgb*1.3+vec3(.26,.18,.1))*vTint.x*vTint.x;');};
 m.customProgramCacheKey=()=>'units'+(inst?'I':'S');return m;
}
const enemyMat=unitMat(true,.24,{roughness:.8,metalness:.1});
const droneMat=unitMat(false,.16,{roughness:.55,metalness:.15});
// shadow pass uses the same limb animation, so leg shadows walk too
const enemyDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
enemyDepth.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+animPars(true)).replace('#include <begin_vertex>','#include <begin_vertex>\n'+ANIM_VERT);};
enemyDepth.customProgramCacheKey=()=>'unitsD';

/* ---------- two tiny batches for everything flat or glowing ----------
   Both use premultiplied blending: rgb is added, alpha darkens. So one draw call can hold
   additive glows AND dark smoke / contact shadows.                                          */
const PREMULT={transparent:true,depthWrite:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor};
const tile=(c,i,S,draw,cols=2)=>{c.save();c.translate((i%cols)*S,(1-Math.floor(i/cols))*S);c.beginPath();c.rect(0,0,S,S);c.clip();draw(c,S);c.restore();};
const glowTile=(c,S)=>{const g=c.createRadialGradient(S/2,S/2,0,S/2,S/2,S*.47);g.addColorStop(0,'#fff');g.addColorStop(.3,'#8a8a8a');g.addColorStop(.65,'#2a2a2a');g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(0,0,S,S);};
// decal atlas, 4 x 2 tiles (R channel): 0 soft glow, 1 dashed ring, 2 thin ring, 3 solid bar, 4 shadow disc
const decalTex=util.canvasTex(512,256,(c,w,h)=>{const S=128;c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle='#fff';
 tile(c,0,S,glowTile,4);
 tile(c,1,S,(c,S)=>{const R=S*.4,per=TAU*R/14;c.setLineDash([per*.56,per*.44]);for(const [lw,al] of [[13,.22],[6,1]]){c.globalAlpha=al;c.lineWidth=lw;c.beginPath();c.arc(S/2,S/2,R,0,TAU);c.stroke();}},4);
 tile(c,2,S,(c,S)=>{for(const [lw,al] of [[16,.12],[9,.25],[3.5,1]]){c.globalAlpha=al;c.lineWidth=lw;c.beginPath();c.arc(S/2,S/2,S*.4,0,TAU);c.stroke();}},4);
 tile(c,3,S,(c,S)=>{c.fillStyle='#fff';c.fillRect(3,3,S-6,S-6);},4);
 tile(c,4,S,(c,S)=>{const g=c.createRadialGradient(S/2,S/2,0,S/2,S/2,S*.47);g.addColorStop(0,'#fff');g.addColorStop(.5,'#f0f0f0');g.addColorStop(.78,'#707070');g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(0,0,S,S);},4);
},{srgb:false});
// sprite atlas (R channel): 0 soft glow, 1 spark, 2 smoke puff, 3 electric arc
const spriteTex=util.canvasTex(256,256,(c,w,h)=>{const S=128;c.fillStyle='#000';c.fillRect(0,0,w,h);
 tile(c,0,S,glowTile);
 tile(c,1,S,(c,S)=>{const g=c.createRadialGradient(S/2,S/2,0,S/2,S/2,S*.3);g.addColorStop(0,'#fff');g.addColorStop(.35,'#999');g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(0,0,S,S);
  c.strokeStyle='#fff';c.lineCap='round';for(const [lw,al,r] of [[5,.3,.4],[1.6,1,.44]]){c.globalAlpha=al;c.lineWidth=lw;c.beginPath();c.moveTo(S*(.5-r),S/2);c.lineTo(S*(.5+r),S/2);c.moveTo(S/2,S*(.5-r));c.lineTo(S/2,S*(.5+r));c.stroke();}});
 tile(c,2,S,(c,S)=>{c.globalCompositeOperation='lighter';for(let i=0;i<9;i++){const a=util.rand(i+3)*TAU,d=util.rand(i+11)*S*.2,r=S*(.14+.12*util.rand(i+29)),x=S/2+Math.cos(a)*d,y=S/2+Math.sin(a)*d;
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.5)');g.addColorStop(.6,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,S,S);}});
 tile(c,3,S,(c,S)=>{c.strokeStyle='#fff';c.lineJoin='round';const pts=[[.1,.5],[.26,.36],[.4,.58],[.55,.4],[.7,.62],[.9,.46]];
  for(const [lw,al] of [[9,.2],[2.4,1]]){c.globalAlpha=al;c.lineWidth=lw;c.beginPath();pts.forEach((q,i)=>i?c.lineTo(q[0]*S,q[1]*S):c.moveTo(q[0]*S,q[1]*S));c.moveTo(.4*S,.58*S);c.lineTo(.5*S,.8*S);c.lineTo(.62*S,.74*S);c.stroke();}});
},{srgb:false});

const MAXQ=400,dPos=new Float32Array(MAXQ*12),dUv=new Float32Array(MAXQ*8),dCol=new Float32Array(MAXQ*16);let dN=0;
const decalGeo=new THREE.BufferGeometry();
{const idx=new Uint16Array(MAXQ*6);for(let i=0;i<MAXQ;i++)idx.set([i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3],i*6);decalGeo.setIndex(new THREE.BufferAttribute(idx,1));
 for(const [n,a,s] of [['position',dPos,3],['uv',dUv,2],['aCol',dCol,4]]){const at=new THREE.BufferAttribute(a,s);at.setUsage(THREE.DynamicDrawUsage);decalGeo.setAttribute(n,at);}}
const decalMesh=new THREE.Mesh(decalGeo,new THREE.ShaderMaterial(Object.assign({uniforms:{map:{value:decalTex}},side:THREE.DoubleSide,
 vertexShader:'attribute vec4 aCol;varying vec4 vC;varying vec2 vUv;void main(){vC=aCol;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform sampler2D map;varying vec4 vC;varying vec2 vUv;void main(){float m=texture2D(map,vUv).r;gl_FragColor=vec4(vC.rgb*m,vC.a*m);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'},PREMULT)));
decalMesh.frustumCulled=false;decalMesh.renderOrder=-1;scene.add(decalMesh);
// flat quad in the XZ plane. (hx,hz) half sizes, rot about Y, tl atlas tile, rgb additive, a darkening,
// k0/k1 fade the colour at the -x / +x edge (gradients)
function decal(cx,y,cz,hx,hz,rot,tl,r,g,b,a,k0,k1){
 if(dN>=MAXQ)return;
 const c=rot?Math.cos(rot):1,s=rot?Math.sin(rot):0,ax=hx*c,az=-hx*s,bx=hz*s,bz=hz*c,o=dN*12,u=dN*8,q=dN*16;
 dPos[o]=cx-ax-bx;dPos[o+1]=y;dPos[o+2]=cz-az-bz;dPos[o+3]=cx+ax-bx;dPos[o+4]=y;dPos[o+5]=cz+az-bz;
 dPos[o+6]=cx+ax+bx;dPos[o+7]=y;dPos[o+8]=cz+az+bz;dPos[o+9]=cx-ax+bx;dPos[o+10]=y;dPos[o+11]=cz-az+bz;
 const u0=(tl&3)*.25+.004,u1=u0+.242,v0=(tl>>2)*.5+.004,v1=v0+.492;
 dUv[u]=u0;dUv[u+1]=v0;dUv[u+2]=u1;dUv[u+3]=v0;dUv[u+4]=u1;dUv[u+5]=v1;dUv[u+6]=u0;dUv[u+7]=v1;
 dCol[q]=r*k0;dCol[q+1]=g*k0;dCol[q+2]=b*k0;dCol[q+3]=a*k0;dCol[q+4]=r*k1;dCol[q+5]=g*k1;dCol[q+6]=b*k1;dCol[q+7]=a*k1;
 dCol[q+8]=r*k1;dCol[q+9]=g*k1;dCol[q+10]=b*k1;dCol[q+11]=a*k1;dCol[q+12]=r*k0;dCol[q+13]=g*k0;dCol[q+14]=b*k0;dCol[q+15]=a*k0;
 dN++;
}

const MAXS=640,sPos=new Float32Array(MAXS*3),sCol=new Float32Array(MAXS*4),sDat=new Float32Array(MAXS*3);let sN=0;
const spriteGeo=new THREE.BufferGeometry();
for(const [n,a,s] of [['position',sPos,3],['aCol',sCol,4],['aDat',sDat,3]]){const at=new THREE.BufferAttribute(a,s);at.setUsage(THREE.DynamicDrawUsage);spriteGeo.setAttribute(n,at);}
const spriteMat=new THREE.ShaderMaterial(Object.assign({uniforms:{map:{value:spriteTex},uPx:{value:300}},
 vertexShader:'attribute vec4 aCol;attribute vec3 aDat;uniform float uPx;varying vec4 vC;varying vec3 vD;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aDat.x*uPx/max(1.,-mv.z);vC=aCol;vD=vec3(aDat.y,cos(aDat.z),sin(aDat.z));}',
 fragmentShader:'uniform sampler2D map;varying vec4 vC;varying vec3 vD;void main(){vec2 p=gl_PointCoord-.5;p=vec2(vD.y*p.x-vD.z*p.y,vD.z*p.x+vD.y*p.y);if(abs(p.x)>.5||abs(p.y)>.5)discard;'+
  'vec2 uv=(vec2(mod(vD.x,2.),floor(vD.x*.5+.01))+.5+p*.97)*.5;float m=texture2D(map,uv).r;gl_FragColor=vec4(vC.rgb*m,vC.a*m);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'},PREMULT));
const spriteMesh=new THREE.Points(spriteGeo,spriteMat);spriteMesh.frustumCulled=false;spriteMesh.renderOrder=2;scene.add(spriteMesh);
// camera-facing sprite: size in world units, tl atlas tile, rot radians, rgb additive, a darkening
function sprite(x,y,z,size,tl,rot,r,g,b,a){
 if(sN>=MAXS)return;const o=sN*3,q=sN*4;
 sPos[o]=x;sPos[o+1]=y;sPos[o+2]=z;sDat[o]=size;sDat[o+1]=tl;sDat[o+2]=rot;sCol[q]=r;sCol[q+1]=g;sCol[q+2]=b;sCol[q+3]=a;sN++;
}

/* ---------- pooled particles: smoke, sparks, exhaust and dust ---------- */
// one particle = x,y,z, vx,vy,vz, life, maxLife, size, kind
const SMOKE=0,SPARK=1,EXHAUST=2,DUST=3;
const MAXP=200,PF=10,pp=new Float32Array(MAXP*PF);let pHead=0;
function emit(kind,x,y,z,vx,vy,vz,life,size){
 const o=pHead*PF;pHead=(pHead+1)%MAXP;
 pp[o]=x;pp[o+1]=y;pp[o+2]=z;pp[o+3]=vx;pp[o+4]=vy;pp[o+5]=vz;pp[o+6]=life;pp[o+7]=life;pp[o+8]=size;pp[o+9]=kind;
}
function particles(dt){
 for(let i=0;i<MAXP;i++){const o=i*PF;let life=pp[o+6];if(life<=0)continue;
  life-=dt;pp[o+6]=life;if(life<=0)continue;
  const k=1-life/pp[o+7],kind=pp[o+9];
  if(kind===SPARK)pp[o+4]-=14*dt;                                   // sparks fall
  else{const d=Math.exp(-(kind===DUST?2.6:1.6)*dt);pp[o+3]*=d;pp[o+5]*=d;if(kind===DUST)pp[o+4]*=d;}   // puffs slow down and hang
  pp[o]+=pp[o+3]*dt;pp[o+1]+=pp[o+4]*dt;pp[o+2]+=pp[o+5]*dt;
  const x=pp[o],y=pp[o+1],z=pp[o+2],s=pp[o+8];
  if(kind===SPARK){const f=1-k;sprite(x,Math.max(.2,y),z,s*(.6+.4*f),1,i,1.6*f,.9*f,.35*f,0);}
  else if(kind===DUST){const a=Math.min(1,k*5)*(1-k)*.22;sprite(x,y,z,s*(1+2.8*k),2,i*1.7+k,.36*a,.28*a,.2*a,a*.8);}
  else{const a=Math.min(1,k*6)*(1-k)*(kind===EXHAUST?.5:.95);sprite(x,y,z,s*(1+1.6*k),2,i*1.7+k,.05*a,.04*a,.034*a,a);}   // dark: it dims what is behind it
 }
}

/* ====================================================================== */
/* 3. Enemies: one InstancedMesh per type (one draw call per type, plus one in the shadow pass) */
/* ====================================================================== */
// k: walk phase per world unit travelled.   hip, amp: leg length and swing (keeps the standing foot on the ground)
// roll, sway, swf: body motion.             ex, ey, es: eye halo sprite (model x, y and size).   lx, ly: hot dot on the top lamp
// feet: [model x, model z, which half of the stride it lands on, ...] for a dust puff at every footfall
// dust: distance between dust puffs for machines without feet.   ds: dust puff size.   stack: exhaust stacks (model x, y, z)
const TYPE={
 runner:{geo:runnerGeo(),cap:40,k:5.2,hip:.56,amp:.5,roll:.06,sway:.07,swf:5.2,ex:.62,ey:.74,es:.95,lx:.44,ly:.9,dust:.7,ds:.85},
 grunt:{geo:gruntGeo(),cap:40,k:3.6,hip:1,amp:.42,roll:.05,sway:.045,swf:3.1,ex:.92,ey:1.62,es:1.3,lx:.5,ly:2.12,feet:[.6,.6,0,.6,-.6,1],ds:.9},
 brute:{geo:bruteGeo(),cap:24,k:1,hip:0,amp:0,roll:.012,sway:.02,swf:2.2,ex:1,ey:1.76,es:1.5,lx:.72,ly:2.02,dust:.7,ds:1.15,stack:[.85,2.9,.45]},
 boss:{geo:bossGeo(),cap:8,k:2.6,hip:1.75,amp:.2,roll:.025,sway:.018,swf:1.4,ex:1.28,ey:2.62,es:2.1,lx:0,ly:4,feet:[1.6,1.25,0,-.9,-1.25,0,1.6,-1.25,1,-.9,1.25,1],ds:1.6,stack:[1.2,3.7,.5]}
};
// The machines cast shadows but do not receive them: one walking in its neighbour's long dusk shadow would lose its colour.
const TLIST=[];
for(const name in TYPE){const T=TYPE[name];T.n=0;
 T.anim=new Float32Array(T.cap*4);T.animAttr=new THREE.InstancedBufferAttribute(T.anim,4);T.animAttr.setUsage(THREE.DynamicDrawUsage);T.geo.setAttribute('iAnim',T.animAttr);
 const m=T.mesh=new THREE.InstancedMesh(T.geo,enemyMat,T.cap);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);T.mtx=m.instanceMatrix.array;
 m.count=0;m.visible=false;m.frustumCulled=false;m.castShadow=true;m.customDepthMaterial=enemyDepth;scene.add(m);TLIST.push(T);}

// per-enemy render state, keyed by the game's enemy object and recycled through `spare`
const states=new Map(),act=[],spare=[];let tick=0;
function addState(e,popIn){
 const S=spare.pop()||{e:null,T:null,d:null,seen:0,age:0,dist:0,px:0,pz:0,killed:false,dying:0,smoke:0,puff:0,dustD:0,step:0,slowK:0,stunK:0,jx:0,jz:0,jr:0,knock:0};
 ctx.enemyPos(e,_v);
 S.e=e;S.T=TYPE[e.type]||TYPE.grunt;S.d=ENEMY[e.type]||ENEMY.grunt;S.seen=0;S.age=popIn?0:POP;S.dist=Math.random()*3;S.px=_v.x;S.pz=_v.z;
 S.killed=false;S.fall=false;S.dying=0;S.smoke=Math.random()*.5;S.puff=Math.random()*.4;S.dustD=0;S.step=1e9;S.slowK=0;S.stunK=0;S.knock=0;
 states.set(e,S);act.push(S);return S;
}
function freeState(i){const S=act[i];states.delete(S.e);S.e=null;spare.push(S);act[i]=act[act.length-1];act.pop();}
function clearStates(){for(let i=act.length-1;i>=0;i--)freeState(i);pp.fill(0);}

const cEye=new THREE.Color(pal.enemyEye),cHot=new THREE.Color(EYE),cDust=new THREE.Color(0xd9a468),cTeal=new THREE.Color(pal.teal),cLit=new THREE.Color(TEAL_LIT),cAmber=new THREE.Color(pal.amber);
const _p=new THREE.Vector3(),_s=new THREE.Vector3(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_m=new THREE.Matrix4(),_v=new THREE.Vector3();
// The boss (4.6 tall) and the brute are taller than the drone's belly at A.droneH, and they walk right under it.
// liftT = how far the drone has to climb per lane this frame, lift = the smoothed value actually used.
const liftT=[0,0],lift=[0,0];
let run=true,eT=0,curG=null;   // run: false while the game is paused, so emitters, jitter and particles hold still. eT: the enemies' own clock
// ground direction of shadows (away from env.js's sun), for the blob shadows drawn when the shadow map is off
let shX=-.92,shZ=.39,shA=0;
function findSun(){
 for(let i=0;i<scene.children.length;i++){const o=scene.children[i];if(o.isDirectionalLight&&o.target){const dx=o.target.position.x-o.position.x,dz=o.target.position.z-o.position.z,l=Math.hypot(dx,dz);if(l>1e-3){shX=dx/l;shZ=dz/l;}break;}}
 shA=Math.atan2(-shZ,shX);
}
findSun();

function drawEnemy(S,dt,t){
 const e=S.e,T=S.T,d=S.d,dead=S.dying>0,wig=e.wiggle||0,i=T.n;
 if(!dead&&curG&&curG.mapCover&&curG.mapCover(e.lane,e.y))return;   // inside a tunnel: not drawn at all
 if(i>=T.cap)return;T.n=i+1;   // more of one type than the pool holds: the extra ones are skipped whole

 // where it is and how far it has walked since the last frame
 let x=S.px,z=S.pz,moved=0;
 if(!dead){ctx.enemyPos(e,_v);moved=Math.abs(_v.x-S.px);if(moved<3)S.dist+=moved;else moved=0;x=S.px=_v.x;z=S.pz=_v.z;S.age+=dt;}
 const slow=!dead&&e.slow>0,stun=!dead&&e.stun>0;
 S.slowK=damp(S.slowK,slow?1:0,9,dt);S.stunK=damp(S.stunK,stun?1:0,14,dt);
 const ph=S.dist*T.k,sn=Math.sin(ph);   // the walk cycle follows distance, so slowed and stunned machines visibly drag

 // pose: spawn pop-in with a small overshoot, weight shift from the walk cycle, idle sway from e.wiggle
 let sc=1;if(S.age<POP){const b=S.age/POP-1;sc=Math.max(.05,1+2.2*b*b*b+1.2*b*b);}
 sc*=e.final?1.22:.9;   // machines are drawn a little smaller than their envelope; the last boss larger
 let sy=sc,sxz=sc,y=GY-T.hip*(1-Math.cos(T.amp*sn))*sc;   // sink a little while the legs are spread: the standing foot stays down
 let roll=sn*T.roll,yaw=Math.sin(t*T.swf+wig)*T.sway,pitch=Math.cos(ph*2)*T.roll*.4;
 let flash=clamp((e.flash||0)/.12,0,1),dull=S.slowK;
 if(e.rare)flash=Math.max(flash,.42+.2*Math.sin(t*7));   // rare machines glow
 if(!T.hip)y+=Math.abs(Math.sin(ph*5.3))*.025;            // tracked: engine rumble
 if(S.stunK>.02){   // overload stun: rocked back on its heels, shaking, arcs crawling over the hull
  const sk=S.stunK;
  if(stun&&run){S.jx=(Math.random()-.5)*.14;S.jz=(Math.random()-.5)*.14;S.jr=(Math.random()-.5)*.16;}
  x+=S.jx*sk;z+=S.jz*sk;roll+=S.jr*sk;pitch+=(.13+S.jr*.5)*sk;flash=Math.max(flash,sk*(.03+(run?Math.random()*.1:.05)));
  if(run)for(let n=Q>0?3:1;n>0;n--)if(Math.random()<.7){const a=Math.random()*TAU,rr=d.r*(.4+Math.random()*.5),b=(.5+Math.random()*.8)*sk;
   sprite(x+Math.cos(a)*rr,GY+d.h*(.25+Math.random()*.7),z+Math.sin(a)*rr,d.r*(.55+Math.random()*.6),3,a*5,.35*b,.9*b,b,0);}
 }
 if(S.knock>.01){const kn=S.knock;x+=kn*.34;sxz*=1+.1*kn;sy*=1-.13*kn;pitch+=.12*kn;flash=Math.max(flash,Math.min(1,kn));S.knock=damp(S.knock,0,13,dt);}   // a hit shoves the machine back and squashes it for a moment (drawing only)
 if(dead&&S.fall){const k=S.dying/FALL,o=Math.sign(ctx.L.laneZ[e.lane])||1;z+=o*Math.min(1,k*2.2)*(4.6+d.r);y-=k>.35?7*(k-.35)*(k-.35)*4:0;roll+=o*k*1.6;flash=Math.max(0,.6-k);dull=k*.6;}   // over the edge and down
 else if(dead){const k=S.dying/DIE;sy*=1-.72*k*k;sxz*=1+.22*k;pitch-=.3*k;y-=.25*k;flash=Math.max(0,1-k*1.4);dull=k;}   // collapse

 // on the road: contact shadow, the dusty dashed ring of a machine slowed by rubble, hot light spilled ahead of it
 const vis=sc*(dead?Math.max(0,1-S.dying/(S.fall?FALL*.4:DIE)):1),ek=(dead?flash:1)*(1-.5*dull)*(stun&&run?.4+Math.random()*.6:1)*sc;
 decal(x,DY-.04,z,d.r*1.3*sc,d.r*1.3*sc,0,4,0,0,0,.66*vis,1,1);
 if(Q<1){const hl=(d.r*.7+d.h*.55)*sc;decal(x+shX*hl,DY-.05,z+shZ*hl,hl,d.r*.85*sc,shA,4,0,0,0,.62*vis,1,1);}   // no shadow map at low quality: a blob stretched away from the sun
 if(S.slowK>.02){const k=S.slowK*(.75+.25*Math.sin(t*6+wig)),rr=d.r+.55;decal(x,DY,z,rr,rr,t*.7+wig,1,cDust.r*k*.95,cDust.g*k*.95,cDust.b*k*.95,.25*k,1,1);}
 if(Q>0)decal(x-d.r*1.25,DY,z,d.r*1.15,d.r*.95,0,0,cEye.r*.09*ek,cEye.g*.09*ek,cEye.b*.09*ek,0,1,1);

 // eye halo and a hot dot on the top lamp (the part of the eye the high camera sees);
 // the boss also lights its crown core and throws a red pool on the lane
 const pu=.85+.15*Math.sin(t*5+wig*3),hk=.75*ek;
 if(Q>0)sprite(x-T.ex*sxz,y+T.ey*sy,z,T.es*pu,0,0,cEye.r*.4*ek,cEye.g*.4*ek,cEye.b*.4*ek,0);
 sprite(x-T.lx*sxz,y+T.ly*sy,z,T.es*.55,0,0,cHot.r*hk,cHot.g*hk,cHot.b*hk,0);
 if(T===TYPE.boss){const cp=.8+.2*Math.sin(t*2.6+wig),k=ek*cp;
  decal(x,DY,z,5.2,5.2,0,0,cEye.r*.2*k,cEye.g*.2*k,cEye.b*.2*k,0,1,1);
  decal(x,DY,z,3.7*sc,3.7*sc,0,2,cEye.r*.24*k,cEye.g*.24*k,cEye.b*.24*k,0,1,1);   // thin threat ring: the siege machine is marked out at any size
  sprite(x,y+3.95*sy,z,3.4*cp,0,0,cEye.r*.42*k,cEye.g*.42*k,cEye.b*.42*k,0);}

 if(!dead){
  // dust: a puff under each foot as it lands, or a trail behind wheels and scuttlers
  if(Q>0&&moved>0){
   if(T.feet){const st=Math.floor(ph/PI-.5);if(st!==S.step){const first=S.step>1e8,half=st&1,F=T.feet;S.step=st;
    if(!first)for(let n=0;n<F.length;n+=3)if(F[n+2]===half)emit(DUST,x-F[n],GY+.2,z-F[n+1],.3+Math.random()*.6,.3+Math.random()*.3,(Math.random()-.5)*.9,.7+Math.random()*.4,T.ds);}}
   else{S.dustD+=moved*(Q>1?1:.5);if(S.dustD>T.dust){S.dustD=0;emit(DUST,x+d.r*.6,GY+.2,z+(Math.random()-.5)*d.r*1.3,.5+Math.random()*.7,.3+Math.random()*.3,(Math.random()-.5)*.6,.7+Math.random()*.4,T.ds);}}
  }
  // heavy machines chug exhaust while they move (high quality only)
  if(T.stack&&Q>1&&moved>0&&run){S.puff-=dt;if(S.puff<=0){S.puff=.3+Math.random()*.3;
   emit(EXHAUST,x+T.stack[0],y+T.stack[1],z+(Math.random()<.5?1:-1)*T.stack[2],.4+Math.random()*.5,1.1+Math.random()*.5,(Math.random()-.5)*.3,.7+Math.random()*.3,.5+Math.random()*.25);}}
  // badly damaged: smoke now and then, sometimes a few sparks
  if(e.hp<e.maxHp*.35&&run){S.smoke-=dt;if(S.smoke<=0){S.smoke=(.22+Math.random()*.3)*(Q>0?1:2.2);
   const ox=(Math.random()-.3)*d.r*.7,oz=(Math.random()-.5)*d.r*.9;
   emit(SMOKE,x+ox,y+d.h*.8,z+oz,.5+Math.random()*.6,1.3+Math.random()*.8,(Math.random()-.5)*.5,.8+Math.random()*.5,d.r*(.7+Math.random()*.5));
   if(Math.random()<.6)for(let n=0;n<3;n++)emit(SPARK,x+ox,y+d.h*.6,z+oz,(Math.random()-.5)*5,2+Math.random()*4,(Math.random()-.5)*5,.3+Math.random()*.3,.5+Math.random()*.4);}}
  // ask the drone to climb if this machine is tall and about to pass under it
  const need=d.cy+d.h/2+.35-(A.droneH-.6);
  if(need>liftT[e.lane]&&Math.abs(x-A.droneX)<d.r+3.4)liftT[e.lane]=need;
 }

 // write the instance: matrix + (walk phase, flash, dull, spin clock)
 _e.set(roll,PI+yaw,pitch);_q.setFromEuler(_e);_p.set(x,y,z);_s.set(sxz,sy,sxz);_m.compose(_p,_q,_s);_m.toArray(T.mtx,i*16);
 const a=i*4;T.anim[a]=ph;T.anim[a+1]=flash;T.anim[a+2]=dull;T.anim[a+3]=Q>0?t%(TAU*4):0;
}

function updateEnemies(dt,G){
 curG=G;tick++;liftT[0]=liftT[1]=0;if(run)eT+=dt;const t=eT;   // sway, eye pulse and crown spin stop with the game
 for(let i=0;i<TLIST.length;i++)TLIST[i].n=0;
 const list=G.enemies;
 for(let i=0;i<list.length;i++){const e=list[i];if(e.hp<=0)continue;(states.get(e)||addState(e,true)).seen=tick;}
 // gone from G.enemies: killed ones collapse briefly, leaked ones just disappear
 for(let i=act.length-1;i>=0;i--){const S=act[i];
  if(S.seen!==tick){if(!S.killed){freeState(i);continue;}S.dying+=Math.max(dt,.001);if(S.dying>=(S.fall?FALL:DIE)){freeState(i);continue;}}
  drawEnemy(S,dt,t);}
 for(let i=0;i<TLIST.length;i++){const T=TLIST[i],m=T.mesh;m.count=T.n;m.visible=T.n>0;if(T.n){m.instanceMatrix.needsUpdate=true;T.animAttr.needsUpdate=true;}}
 enemyMat.userData.uGlow.value=1+.12*Math.sin(t*7);   // eyes breathe
}

/* ====================================================================== */
/* 4. Support drone, its fan discs, range marks and the echo hologram       */
/* ====================================================================== */
const dGeo=droneGeo();
const drone=new THREE.Group(),droneBody=new THREE.Mesh(dGeo,droneMat);droneBody.castShadow=true;drone.add(droneBody);
// spinning fan blur: four flat quads sharing one texture that rotates (mirrored UVs make two of them counter-rotate)
const rotorTex=util.canvasTex(128,128,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.translate(w/2,h/2);
 const g=c.createRadialGradient(0,0,5,0,0,60);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.45,'rgba(255,255,255,.14)');g.addColorStop(.9,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=g;c.beginPath();c.arc(0,0,60,0,TAU);c.fill();
 for(let b=0;b<3;b++)for(let i=0;i<16;i++){const a=b*TAU/3+i*.06;c.fillStyle='rgba(255,255,255,'+(.55*Math.pow(1-i/16,1.6)).toFixed(3)+')';c.beginPath();c.moveTo(0,0);c.arc(0,0,57,a,a+.07);c.closePath();c.fill();}});
rotorTex.center.set(.5,.5);
const rotorGeo=new THREE.BufferGeometry();
{const pos=[],uv=[],idx=[],r=.56;
 DUCTS.forEach(([x,z],i)=>{const f=i%3===0?1:0;pos.push(x-r,.3,z-r,x+r,.3,z-r,x+r,.3,z+r,x-r,.3,z+r);uv.push(f,0,1-f,0,1-f,1,f,1);idx.push(i*4,i*4+2,i*4+1,i*4,i*4+3,i*4+2);});
 rotorGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));rotorGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));rotorGeo.setIndex(idx);}
const rotorMat=new THREE.MeshBasicMaterial({map:rotorTex,color:TEAL_LIT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false});
drone.add(new THREE.Mesh(rotorGeo,rotorMat));scene.add(drone);
// echo hologram: the same hull drawn as additive, scan-lined light
const holoMat=new THREE.ShaderMaterial({uniforms:{uCol:{value:new THREE.Color(0x96f0d7)},uA:{value:0},uT:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:'varying vec3 vN;varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}',
 fragmentShader:'uniform vec3 uCol;uniform float uA,uT;varying vec3 vN;varying vec3 vW;void main(){float fr=1.-abs(dot(normalize(vN),normalize(cameraPosition-vW)));float sc=.5+.5*sin(vW.y*26.-uT*10.);'+
  'gl_FragColor=vec4(uCol*uA*(.22+.78*fr*fr)*(.45+.55*sc),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
const ghost=new THREE.Mesh(dGeo,holoMat);ghost.visible=false;scene.add(ghost);

// smoothed drone state: lateral speed, overdrive level, mark brightness, overload-ready level, and short kicks from events
let lastZ=NaN,velZ=0,odS=0,markA=1,pulseA=0,recoil=0,kick=0,flare=0,ghostKick=0;

// range bracket across the lane at world x; dir = +1/-1 is the side the covered stretch lies on
function bracket(x,dir,zc,k){
 const hz=A.laneW/2-.3,r=cTeal.r*k,g=cTeal.g*k,b=cTeal.b*k;
 decal(x,DY,zc,.05,hz,0,3,r*.42,g*.42,b*.42,0,1,1);                               // thin line across the lane
 decal(x+dir*1.2,DY,zc,1.2,hz,0,3,r*.1,g*.1,b*.1,0,dir>0?1:0,dir>0?0:1);          // faint band fading into the covered stretch
 for(let s=-1;s<=1;s+=2){decal(x+dir*.75,DY,zc+s*hz,.75,.09,0,3,r,g,b,0,1,1);decal(x,DY,zc+s*(hz-.55),.09,.62,0,3,r,g,b,0,1,1);}   // corners
}
// overload frame: the outline of everything the overload would hit, as marching dashes on the ground.
// It follows a bent lane, and in the stretches where the map lets the overload reach across (G.mapNear) it widens over the other lane.
const fp=new Float32Array(1200),fa=new Uint8Array(512);let fN=0;    // outline points x,z; fa: the overload reaches across at this sample
function fpAdd(x,z){
 if(fN>1){const o=fN*2,ax=fp[o-4],az=fp[o-3],bx=fp[o-2],bz=fp[o-1];if(Math.abs((bx-ax)*(z-bz)-(bz-az)*(x-bx))<1e-4&&(bx-ax)*(x-bx)+(bz-az)*(z-bz)>=0){fp[o-2]=x;fp[o-1]=z;return;}}   // straight on: extend the last segment
 if(fN<600){fp[fN*2]=x;fp[fN*2+1]=z;fN++;}
}
function pulseFrame(G,x,z,lane,px,hz,off,r,g,b){
 const sg=Math.sign(ctx.L.laneZ[lane])||1,z0=z-ctx.off(lane,x),near=G.mapNear,other=ctx.L.laneZ[1-lane],n=Math.min(500,Math.max(4,Math.ceil(px*2/.2))),step=px*2/n;
 const zIn=(xi,across)=>across?other+ctx.off(1-lane,xi)-sg*hz:z0+ctx.off(lane,xi)-sg*hz;
 fN=0;
 for(let i=0;i<=n;i++){const xi=x-px+i*step;fpAdd(xi,z0+ctx.off(lane,xi)+sg*hz);}                  // the outer side of the drone's lane
 for(let i=0;i<=n;i++)fa[i]=near&&near(G.LEAK_Y-(x-px+i*step)/A.U)?1:0;
 for(let i=0,j;i<=n;i=j){for(j=i;j<=n&&fa[j]===fa[i];j++);if(fa[i]&&(j-i)*step<1)fa.fill(0,i,j);}   // a sliver of a near stretch at the end of the range is not worth a spike across the other lane
 for(let i=n;i>=0;i--){const xi=x-px+i*step;                                                       // back along the median side, or along the far side of the other lane
  if(i<n&&fa[i]!==fa[i+1])fpAdd(xi,zIn(xi,fa[i+1]));
  fpAdd(xi,zIn(xi,fa[i]));}
 fpAdd(fp[0],fp[1]);
 const per=1.7,dash=1,base=off-per;let acc=0;
 for(let i=0;i<fN-1;i++){const ax=fp[i*2],az=fp[i*2+1],dx=fp[i*2+2]-ax,dz=fp[i*2+3]-az,len=Math.hypot(dx,dz);if(len<1e-4)continue;
  const ux=dx/len,uz=dz/len,rot=Math.atan2(-uz,ux);
  for(let s=base+Math.ceil((acc-dash-base)/per)*per;s<acc+len;s+=per){const a=Math.max(acc,s),e=Math.min(acc+len,s+dash);if(e-a<.08)continue;
   const m=(a+e)/2-acc;decal(ax+ux*m,DY+.01,az+uz*m,(e-a)/2,.075,rot,3,r,g,b,0,1,1);}
  acc+=len;}
}

function updateDrone(dt,t,G){
 const dr=G.drone,ef=G.effects,L=ctx.L,live=G.phase==='battle'||G.phase==='practice';
 ctx.dronePos(_v);const x=_v.x,z=_v.z;

 // lateral speed from the change of z -> bank into the slide
 let vz=0;if(dt>0&&Math.abs(z-lastZ)<12)vz=(z-lastZ)/dt;lastZ=z;
 velZ=damp(velZ,vz,9,dt);
 const f=clamp((dr.x-G.LANES[0])/(G.LANES[1]-G.LANES[0]),0,1),moving=Math.abs(G.LANES[dr.lane]-dr.x)>20;
 for(let i=0;i<2;i++)lift[i]=damp(lift[i],liftT[i],liftT[i]>lift[i]?5:2.2,dt);
 const up=ctx.droneLift=lerp(lift[0],lift[1],f);   // published for anyone who wants to start a tracer at the real hull
 // overdrive level: full while burst lasts, fading out over its last half second
 odS=damp(odS,dr.burst>0?clamp(dr.burst/.5,0,1):0,10,dt);
 recoil=damp(recoil,0,16,dt);kick=damp(kick,0,7,dt);flare=damp(flare,0,3.5,dt);
 const y=_v.y+up+Math.sin(t*1.9)*.1-kick*.35,bank=clamp(velZ*.012,-.6,.6);
 drone.position.set(x,y,z);
 drone.rotation.set(bank+Math.sin(t*1.3)*.03,Math.sin(t*.7)*.04,-.07+recoil*.07+Math.sin(t*1.1)*.02-Math.abs(bank)*.12);
 drone.updateMatrixWorld();

 // lights: hull strips, fan discs, thrusters, belly lamp, light pool on the lane
 droneMat.userData.uGlow.value=1+1.6*odS+kick*1.5+flare*.6;
 rotorTex.rotation=(t*(17+odS*10))%TAU;
 rotorMat.color.copy(cLit).multiplyScalar(.55+.8*odS+.35*flare+kick);
 const lp=.2+.1*odS+.3*kick+.08*flare,th=.55+1.2*odS+flare*.8;
 decal(x,DY,z,3.8,3.8,0,0,cTeal.r*lp,cTeal.g*lp,cTeal.b*lp,0,1,1);
 for(let s=-1;s<=1;s+=2){_v.set(-1.22,.18,s*.56).applyMatrix4(drone.matrixWorld);sprite(_v.x,_v.y,_v.z,1.1+.9*odS+flare*.5,0,0,cLit.r*th,cLit.g*th,cLit.b*th,0);}
 // belly glow; it kicks with every shot (fx.js draws the tracer from the hull centre, towards either side)
 const bg=.3+recoil*.7;_v.set(-.25,-.25,0).applyMatrix4(drone.matrixWorld);sprite(_v.x,_v.y,_v.z,2.2+recoil*.8,0,0,cTeal.r*bg,cTeal.g*bg,cTeal.b*bg,0);
 // overdrive: a faint aura and two rings that keep expanding around the hull while burst lasts
 if(odS>.02){
  sprite(x,y+.2,z,4.4,0,0,cLit.r*.07*odS,cLit.g*.07*odS,cLit.b*.07*odS,0);
  for(let i=0;i<2;i++){const p=(t*1.25+i*.5)%1,rr=1.7+2.1*p,k=(1-p)*(1-p)*odS*.6;decal(x,y+.15,z,rr,rr,0,2,cLit.r*k,cLit.g*k,cLit.b*k,0,1,1);}
 }

 // range marks: every range runs along the lane, so they are brackets across it. They slide with the drone and dim in transit.
 markA=damp(markA,moving?.3:1,moving?18:6,dt);
 const dx=ef.droneRange*A.U,k=markA*(.5+.12*odS);
 {const z0=z-ctx.off(dr.lane,x);bracket(x+dx,-1,z0+ctx.off(dr.lane,x+dx),k);bracket(x-dx,1,z0+ctx.off(dr.lane,x-dx),k);}   // each mark sits on the lane where it is, also on a bent lane
 // overload ready: dashed amber frame around everything it would hit, and a blinking lamp under the nose
 pulseA=damp(pulseA,live&&dr.pulseCooldown<=.01&&!G.pulseLock?1:0,8,dt);   // hidden until the overload has been introduced
 if(pulseA>.02){
  const px=ef.pulseRange*A.U,hz=A.laneW/2-.75,k2=pulseA*markA*(.62+.2*Math.sin(t*4)),r=cAmber.r*k2,g=cAmber.g*k2,b=cAmber.b*k2,off=(t*1.1)%1.7;
  pulseFrame(G,x,z,dr.lane,px,hz,off,r,g,b);
  const bl=(.5+.5*Math.sin(t*6))*pulseA*.8;_v.set(.55,-.6,0).applyMatrix4(drone.matrixWorld);sprite(_v.x,_v.y,_v.z,1,0,0,cAmber.r*bl,cAmber.g*bl,cAmber.b*bl,0);
 }

 // echo: a flickering hologram of the drone keeps firing into the lane it just left, fading with burst
 const echo=G.echoOn();ghost.visible=echo;
 if(echo){ghostKick=damp(ghostKick,0,12,dt);
  const gz=ctx.laneZAt(dr.echoLane,A.droneX),gy=A.droneH+lift[dr.echoLane]+Math.sin(t*1.9+1)*.1;
  const a=clamp(dr.burst,0,1)*(.7+.3*Math.sin(t*37)*Math.sin(t*5.3))*(Math.random()<.06?.35:1);
  ghost.position.set(x,gy,gz);ghost.rotation.set(Math.sin(t*1.3)*.03,0,-.07);
  holoMat.uniforms.uA.value=a*(.85+ghostKick*.8);holoMat.uniforms.uT.value=t%100;
  decal(x,DY,gz,3.2,3.2,0,0,cTeal.r*.16*a,cTeal.g*.16*a,cTeal.b*.16*a,0,1,1);
  sprite(x,gy+.2,gz,5,0,0,cTeal.r*.2*a,cTeal.g*.2*a,cTeal.b*.2*a,0);
 }
}

/* ====================================================================== */
/* 5. Part interface                                                        */
/* ====================================================================== */
// quality 0: no shadow casting (blob shadows instead), fewer arcs and smoke, no dust, no eye halos or light spill, no crown spin.
// 1: no exhaust, thinner dust. 2: everything.
let laneZ0=ctx.L.laneZ[0];
function setQuality(q){Q=q;droneBody.castShadow=q>0;for(const T of TLIST)T.mesh.castShadow=q>0;}
setQuality(Q);
return{
 layout(L){
  lastZ=NaN;velZ=0;findSun();   // lane z changes with the layout: do not read the jump as a slide
  // world-space leftovers (puffs, collapsing wrecks) would hang over the old lane positions
  if(L&&L.laneZ[0]!==laneZ0){laneZ0=L.laneZ[0];pp.fill(0);for(let i=act.length-1;i>=0;i--)if(act[i].dying>0)freeState(i);}
 },
 quality:setQuality,
 event(ev){
  if(ev.t==='fall'&&ev.e){(states.get(ev.e)||addState(ev.e,false)).fall=true;return;}   // knocked off a bridge: the 'hit' that kills it follows
  if(ev.t==='hit'){
   // remember kills: the enemy is already gone from G.enemies when this arrives, so it may never have been drawn
   if(ev.kill&&ev.e)(states.get(ev.e)||addState(ev.e,false)).killed=true;
   if(ev.src==='drone')recoil=1;else if(ev.src==='echo')ghostKick=1;
   if(!ev.kill&&ev.e&&ev.src!=='pulse'){const S=states.get(ev.e);if(S){const w=ev.e.type==='boss'?.35:ev.e.type==='brute'?.65:1;S.knock=Math.min(1.6,S.knock+(ev.src==='turret'||ev.src==='pierce'?1.3:.8)*w);}}
  }else if(ev.t==='pulse')kick=1;
  else if(ev.t==='move')flare=1;
  else if(ev.t==='stage')clearStates();
 },
 update(dt,t,G){
  dN=0;sN=0;run=!G.paused;
  updateDrone(dt,t,G);      // first: its range marks lie under the enemies' shadows, and it uses the lift the enemies asked for last frame
  updateEnemies(dt,G);
  particles(run?dt:0);
  // upload what the batches collected this frame
  decalGeo.setDrawRange(0,dN*6);
  if(dN){decalGeo.attributes.position.needsUpdate=true;decalGeo.attributes.uv.needsUpdate=true;decalGeo.attributes.aCol.needsUpdate=true;}
  spriteGeo.setDrawRange(0,sN);
  if(sN){spriteGeo.attributes.position.needsUpdate=true;spriteGeo.attributes.aCol.needsUpdate=true;spriteGeo.attributes.aDat.needsUpdate=true;}
  spriteMat.uniforms.uPx.value=renderer.domElement.height/(2*Math.tan(camera.fov*PI/360));   // world size -> point size in device px
 }
};
});})();
