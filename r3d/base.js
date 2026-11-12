/* base.js — 지키는 것들: 발전소·정비소·중앙 송신소·누출 게이트·포탑 진지. 시설 상태와 협동 조준을 읽어 그대로 비춘다. */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('base',ctx=>{
const {scene,A,pal,util}=ctx,{clamp,damp}=util;
const TAU=Math.PI*2,HPI=Math.PI/2;
const C={cream:pal.cream,creamD:0xc7c4b4,steel:pal.steel,metal:pal.metal,dark:pal.metalDark,deck:0x35494f,copper:0xb7743f,
 amber:pal.amber,amberD:pal.amberDeep,teal:pal.teal,tealD:pal.tealDeep,white:0xffffff,
 // lamp colours are more saturated than the palette so they still read as amber / teal after tone mapping
 la:0xff9a2e,lt:0x3fe3d2,lt2:0x2cc2b4,hot:0xffd48a,core:0xff8a22,good:0x4dffb0};

/* ================= 1. lit material with per-vertex lamp channels ================= */
// Every model is ONE merged mesh. Faces tagged with the attribute glow=(channel 1..4, threshold) are lamps:
// they emit vertexColour * uGlow[channel] while uLvl[channel] is above their threshold and look like dark glass otherwise.
// This gives independent lights and bar-graph gauges (health rows, charge rings) without extra draw calls.
const VS_HEAD='attribute vec2 glow;uniform vec3 uGlow[4];uniform vec4 uLvl;varying vec4 vGlow;\n';
const VS_BODY='#include <begin_vertex>\nint gch=int(glow.x+.5);vec3 gcol=vec3(0.);float glv=0.;\n'+
 'if(gch==1){gcol=uGlow[0];glv=uLvl.x;}else if(gch==2){gcol=uGlow[1];glv=uLvl.y;}else if(gch==3){gcol=uGlow[2];glv=uLvl.z;}else if(gch==4){gcol=uGlow[3];glv=uLvl.w;}\n'+
 'vGlow=vec4(gcol*clamp((glv-glow.y)*16.,0.,1.),gch>0?1.:0.);';
function glowMat(){
 const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.8,metalness:.06});
 const glow=[new THREE.Color(0),new THREE.Color(0),new THREE.Color(0),new THREE.Color(0)],lvl=new THREE.Vector4(1,1,1,1);
 m.userData.glow=glow;m.userData.lvl=lvl;
 m.onBeforeCompile=sh=>{
  sh.uniforms.uGlow={value:glow};sh.uniforms.uLvl={value:lvl};
  sh.vertexShader=VS_HEAD+sh.vertexShader.replace('#include <begin_vertex>',VS_BODY);
  sh.fragmentShader='varying vec4 vGlow;\n'+sh.fragmentShader
   .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.07+.012,vGlow.a);')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor.rgb*vGlow.rgb;');
 };
 m.customProgramCacheKey=()=>'r3d-base-glow';
 return m;
}
function setG(mat,ch,c,k){mat.userData.glow[ch].copy(c).multiplyScalar(k);}

/* ================= 2. model builder (build time only) ================= */
let P=null,TM=null;                                   // parts of the model being built, current parent transform
const UP=new THREE.Vector3(0,1,0),_e=new THREE.Euler(0,0,0,'YXZ'),_q=new THREE.Quaternion(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_d=new THREE.Vector3();
// local matrix: position, rotation [x,y,z] applied as yaw(Y) * pitch(X) * roll(Z), optional scale
function mat(x,y,z,r,s){const m=new THREE.Matrix4();_e.set(r?r[0]:0,r?r[1]:0,r?r[2]:0);
 m.compose(_p.set(x,y,z),_q.setFromEuler(_e),s?_s.set(s[0],s[1],s[2]):_s.set(1,1,1));return TM?m.premultiply(TM):m;}
function part(g,c,m,o){P.push({g,c,m,e:(o&&o.e)||0,th:(o&&o.th)||0});}
function at(x,y,z,r,fn){const prev=TM;TM=mat(x,y,z,r);fn();TM=prev;}
function raw(g,c,x,y,z,o){part(g,c,mat(x,y,z,o&&o.r,o&&o.s),o);}
// all primitives stand on their base: (x,y,z) is the centre of the bottom face
function box(w,h,d,x,y,z,c,o){const g=new THREE.BoxGeometry(w,h,d);g.translate(0,h/2,0);raw(g,c,x,y,z,o);}
function cyl(rt,rb,h,n,x,y,z,c,o){const g=new THREE.CylinderGeometry(rt,rb,h,n);g.translate(0,h/2,0);raw(g,c,x,y,z,o);}
function sph(r,x,y,z,c,o){raw(new THREE.SphereGeometry(r,8,5),c,x,y,z,o);}             // centred
function tor(R,r,x,y,z,c,o){const g=new THREE.TorusGeometry(R,r,(o&&o.rs)||5,(o&&o.ts)||12);g.rotateX(HPI);raw(g,c,x,y,z,o);}   // lying flat, centred
// rectangular frustum: bottom w0 x d0, top w1 x d1 shifted by (ox,oz)
function fruGeo(w0,d0,w1,d1,h,ox,oz){
 const a=w0/2,b=d0/2,c=w1/2,d=d1/2;ox=ox||0;oz=oz||0;
 const v=[[-a,0,-b],[a,0,-b],[a,0,b],[-a,0,b],[-c+ox,h,-d+oz],[c+ox,h,-d+oz],[c+ox,h,d+oz],[-c+ox,h,d+oz]];
 const f=[0,1,2,0,2,3, 4,7,6,4,6,5, 3,2,6,3,6,7, 1,0,4,1,4,5, 2,1,5,2,5,6, 0,3,7,0,7,4],pos=new Float32Array(f.length*3);
 for(let i=0;i<f.length;i++){pos[i*3]=v[f[i]][0];pos[i*3+1]=v[f[i]][1];pos[i*3+2]=v[f[i]][2];}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
function fru(w0,d0,w1,d1,h,x,y,z,c,o){raw(fruGeo(w0,d0,w1,d1,h,o&&o.ox,o&&o.oz),c,x,y,z,o);}
// wedge: the slope faces +Z, the vertical back is at -d/2
function wedge(w,h,d,x,y,z,c,o){raw(fruGeo(w,d,w,.001,h,0,-d/2),c,x,y,z,o);}
// box with chamfered top edges (the "bevelled box" of the art direction)
function cbox(w,h,d,ch,x,y,z,c,o){at(x,y,z,o&&o.r,()=>{box(w,h-ch,d,0,0,0,c,o&&{e:o.e,th:o.th});fru(w,d,w-2*ch,d-2*ch,ch,0,h-ch,0,c,o&&{e:o.e,th:o.th});});}
// round bar between two points
function bar(x0,y0,z0,x1,y1,z1,r,c,o){_d.set(x1-x0,y1-y0,z1-z0);const len=_d.length(),g=new THREE.CylinderGeometry(r,r,len,(o&&o.n)||4);
 const m=new THREE.Matrix4().compose(_p.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),_q.setFromUnitVectors(UP,_d.normalize()),_s.set(1,1,1));part(g,c,TM?m.premultiply(TM):m,o);}
// open cone visible from both sides (second copy is mirrored, which flips its winding)
function shell(rt,rb,h,n,x,y,z,cOut,cIn){
 let g=new THREE.CylinderGeometry(rt,rb,h,n,1,true);g.translate(0,h/2,0);raw(g,cOut,x,y,z);
 g=new THREE.CylinderGeometry(rt,rb,h,n,1,true);g.translate(0,h/2,0);raw(g,cIn,x,y,z,{s:[-1,1,1]});
}
function model(fn){
 P=[];TM=null;fn();const parts=P;P=null;
 const n=parts.map(p=>p.g.index?p.g.index.count:p.g.attributes.position.count);
 const g=util.merge(parts),a=new Float32Array(g.attributes.position.count*2);let o=0;
 for(let i=0;i<parts.length;i++)for(let k=0;k<n[i];k++){a[o++]=parts[i].e;a[o++]=parts[i].th;}
 g.setAttribute('glow',new THREE.BufferAttribute(a,2));return g;
}

/* ================= 3. sprite batches (one draw call each) and the particle pool ================= */
// Quads drawn with instancing: camera-facing sprites, or (flat) light pools lying on the ground.
// data: x,y,z,size, r,g,b,a per quad, rewritten every frame.
function makeBatch(n,blending,order,flat){
 const g=new THREE.InstancedBufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]),3));g.setIndex([0,1,2,0,2,3]);
 const data=new Float32Array(n*8),ib=new THREE.InstancedInterleavedBuffer(data,8);ib.setUsage(THREE.DynamicDrawUsage);
 g.setAttribute('iPos',new THREE.InterleavedBufferAttribute(ib,4,0));g.setAttribute('iCol',new THREE.InterleavedBufferAttribute(ib,4,4));
 // scene fog: additive quads fade out with distance, smoke blends to the fog colour like everything else
 const add=blending===THREE.AdditiveBlending,FOGF='#ifdef USE_FOG\n#ifdef FOG_EXP2\nfloat ff=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);\n#else\nfloat ff=smoothstep(fogNear,fogFar,vFogDepth);\n#endif\ngl_FragColor.a*=1.-ff;\n#endif\n';
 const m=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{map:{value:null}}]),fog:true,transparent:true,depthWrite:false,blending,
  // sprites are pulled 1.2 units towards the camera so a halo is not cut by the lamp it sits on
  vertexShader:'attribute vec4 iPos;attribute vec4 iCol;varying vec4 vCol;varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){vUv=position.xy+.5;vCol=iCol;'+
   (flat?'vec4 mv=viewMatrix*vec4(iPos.x+position.x*iPos.w,iPos.y,iPos.z-position.y*iPos.w,1.);':'vec4 mv=viewMatrix*vec4(iPos.xyz,1.);mv.xyz*=1.-1.2/length(mv.xyz);mv.xy+=position.xy*iPos.w;')+
   'gl_Position=projectionMatrix*mv;\n#ifdef USE_FOG\nvFogDepth=-mv.z;\n#endif\n}',
  fragmentShader:'uniform sampler2D map;varying vec4 vCol;varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){gl_FragColor=vec4(vCol.rgb,vCol.a*texture2D(map,vUv).a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n'+
   (add?FOGF:'#include <fog_fragment>\n')+'}'});
 m.uniforms.map.value=ctx.tex.glow;
 const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=order;mesh.visible=false;scene.add(mesh);
 return{mesh,geo:g,ib,d:data,n,c:0};
}
function spr(b,x,y,z,size,col,a){if(b.c>=b.n||a<=.004)return;const o=b.c++*8,d=b.d;d[o]=x;d[o+1]=y;d[o+2]=z;d[o+3]=size;d[o+4]=col.r;d[o+5]=col.g;d[o+6]=col.b;d[o+7]=a;}
function flush(b){b.geo.instanceCount=b.c;b.ib.needsUpdate=true;b.mesh.visible=b.c>0;}
const glowB=makeBatch(128,THREE.AdditiveBlending,3),smokeB=makeBatch(56,THREE.NormalBlending,2),poolB=makeBatch(12,THREE.AdditiveBlending,1,true);
// The shared glow texture is too peaked for smoke (its dense core is a few pixels on a phone): the smoke batch gets a lumpy, flat-topped puff.
smokeB.mesh.material.uniforms.map.value=util.canvasTex(64,64,(c,w,h)=>{
 for(let i=0;i<7;i++){const a=util.rand(i*3.1)*TAU,d=i?5+util.rand(i*7.7)*7:0,x=w/2+Math.cos(a)*d,y=h/2+Math.sin(a)*d,r=i?10+util.rand(i*5.3)*5:17;
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.5)');g.addColorStop(.55,'rgba(255,255,255,.3)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}
},{srgb:false});

const cA=new THREE.Color(0xff9a2e),cT=new THREE.Color(0x3fe3d2),cG=new THREE.Color(0x2fe89a),cR=new THREE.Color(0xff3b24),cW=new THREE.Color(0xffffff),
 cHot=new THREE.Color(0xffe2a8),cWarm=new THREE.Color(0xffb347),cSpark=new THREE.Color(0xffd08a),cZap=new THREE.Color(0xbfeeff),
 // smoke starts warm (lit from below by the wreck) and pales as it thins: it must stay lighter than the dark ground behind it
 cSmoke=new THREE.Color(0x9c7354),cAsh=new THREE.Color(0xa69d92),cSteam=new THREE.Color(0xb3aa9d),laneCol=[cA,cT],tmpC=new THREE.Color(),tmpP=new THREE.Color();
const NP=72,parts=[];let pNext=0;
for(let i=0;i<NP;i++)parts.push({on:false,add:false,t:0,life:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,s0:1,s1:1,col:cW,c1:null,a:1,grav:0});
function emit(add,x,y,z,vx,vy,vz,life,s0,s1,col,a,grav,c1){const p=parts[pNext];pNext=(pNext+1)%NP;
 p.on=true;p.add=add;p.t=0;p.life=life;p.x=x;p.y=y;p.z=z;p.vx=vx;p.vy=vy;p.vz=vz;p.s0=s0;p.s1=s1;p.col=col;p.c1=c1||null;p.a=a;p.grav=grav;}
const rnd=()=>Math.random()-.5;
// A puff must be a few units wide to be seen at all on a phone (one unit is about 6 px there). The wind carries it towards -X, away from the lanes.
function puff(x,y,z,big,col,c1,a){emit(false,x+rnd()*.4,y,z+rnd()*.4,-.9+rnd()*.4,1.3+Math.random()*.4,.1+rnd()*.3,3.2+Math.random(),1.8*big,5*big,col,a||.9,0,c1);}
function sparks(x,y,z,n,col,pow){for(let i=0;i<n;i++)emit(true,x,y,z,rnd()*pow,Math.random()*pow*.9+.6,rnd()*pow,.28+Math.random()*.3,.42,.06,col,1,9);}
function updParticles(dt){
 for(let i=0;i<NP;i++){const p=parts[i];if(!p.on)continue;p.t+=dt;if(p.t>=p.life){p.on=false;continue;}
  p.vy-=p.grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.1){p.y=.1;p.vy=-p.vy*.3;}
  const u=p.t/p.life,env=p.add?1-u*u:Math.min(1,u*6)*(1-u);
  spr(p.add?glowB:smokeB,p.x,p.y,p.z,p.s0+(p.s1-p.s0)*u,p.c1?tmpP.copy(p.col).lerp(p.c1,u):p.col,p.a*env);}
}

/* ================= 4. models ================= */
// All buildings are modelled facing +Z; layout() turns them so that this front faces the camera in both layouts.
function pad(paint,lamp){
 cbox(6.8,.42,6.8,.14, 0,0,0, C.dark);
 box(6.1,.06,6.1, 0,.42,0, C.deck);
 box(5.5,.05,.32, 0,.48,2.98, paint);
 // health row: four lamps on the front edge that go out one by one as the facility is damaged
 for(let k=0;k<4;k++)box(.8,.09,.2, -1.95+k*1.3,.5,2.98, lamp,{e:1,th:[.04,.27,.5,.74][k]});
}
/* --- 발전소: reactor drum with a glowing core in a pylon cage, two coil towers, turbine and vent block --- */
const PCZ=-.3;
const gPower=model(()=>{
 pad(C.amberD,C.la);
 cyl(2.25,2.42,.72,10, 0,.42,PCZ, C.dark);
 cyl(2.0,2.14,.8,10, 0,1.14,PCZ, C.cream);
 cyl(2.06,2.06,.1,10, 0,1.94,PCZ, C.creamD);
 for(let k=-2;k<=2;k++){const a=k*.5;box(.5,.26,.08, Math.sin(a)*2.07,1.4,PCZ+Math.cos(a)*2.07, C.la,{r:[0,a,0],e:1,th:.42});}
 tor(1.52,.2, 0,2.02,PCZ, C.copper);
 raw(new THREE.SphereGeometry(1.3,10,2,0,TAU,0,.62),C.hot,0,1.9,PCZ,{e:2});                // core dome: hot cap
 raw(new THREE.SphereGeometry(1.3,10,3,0,TAU,.62,HPI-.62),C.core,0,1.9,PCZ,{e:2});         // core dome: body
 for(const a of[Math.PI,Math.PI/3,-Math.PI/3])at(Math.sin(a)*1.86,1.94,PCZ+Math.cos(a)*1.86,[-.24,a,0],()=>{   // pylons lean inwards
  box(.44,2.4,.5, 0,0,0, C.cream);box(.52,.22,.58, 0,2.4,0, C.copper);box(.18,1.25,.06, 0,.55,.26, C.la,{e:1,th:.6});});
 for(let k=0;k<2;k++){const x=k?2.5:-2.5,z=-2.5;                                            // coil towers
  box(1.2,.5,1.2, x,.42,z, C.dark);cyl(.34,.42,3.6,6, x,.92,z, C.steel);
  for(let j=0;j<4;j++)tor(.58,.15, x,1.55+j*.7,z, C.copper,{ts:10});
  cyl(.6,.44,.2,8, x,4.52,z, C.dark);sph(.44, x,5.14,z, C.la,{e:1,th:k?.64:.32});}
 cbox(1.8,1.2,1.4,.16, 2.4,.42,2.05, C.cream);                                              // vent block
 for(let k=0;k<3;k++)box(1.3,.1,.06, 2.4,.72+k*.26,2.76, C.dark);
 box(1.2,.08,.8, 2.4,1.62,2.05, C.dark);box(1.0,.04,.6, 2.4,1.7,2.05, C.la,{e:1,th:.55});
 box(.3,.55,1.2, -2.95,.42,2.15, C.dark);box(.3,.55,1.2, -1.8,.42,2.15, C.dark);            // turbine
 cyl(.66,.66,1.9,8, -3.3,1.3,2.15, C.steel,{r:[0,0,-HPI]});
 cyl(.71,.71,.14,8, -2.95,1.3,2.15, C.la,{r:[0,0,-HPI],e:1,th:.2});cyl(.71,.71,.14,8, -2.05,1.3,2.15, C.la,{r:[0,0,-HPI],e:1,th:.7});
 cyl(.3,.66,.4,8, -1.4,1.3,2.15, C.dark,{r:[0,0,-HPI]});
 bar(-1.05,1.3,2.15, -.7,1.2,1.7, .15, C.copper,{n:6});bar(1.55,1.0,1.75, 1.2,1.0,1.3, .15, C.copper,{n:6});
 box(.1,.75,.1, 3.05,1.62,2.55, C.dark);box(.3,.26,.3, 3.05,2.37,2.55, C.white,{e:3});      // warning lamp
});
// collector: crown ring resting on the pylon tops with a finned rotor ring hanging over the core (origin = crown centre)
const gRotor=model(()=>{
 tor(1.29,.12, 0,0,0, C.steel,{ts:14});
 for(const a of[0,TAU/3,-TAU/3]){bar(Math.sin(a)*1.29,0,Math.cos(a)*1.29, 0,.3,0, .07, C.steel);bar(Math.sin(a)*.98,-1.25,Math.cos(a)*.98, 0,-.95,0, .06, C.steel);}
 cyl(.1,.17,.5,6, 0,.2,0, C.steel);sph(.2, 0,.78,0, C.hot,{e:1,th:.2});
 cyl(.07,.07,1.3,5, 0,-1.05,0, C.steel);
 tor(.98,.14, 0,-1.25,0, C.copper,{ts:14});
 for(let k=0;k<6;k++){const a=k*TAU/6;at(Math.sin(a)*1.02,-1.25,Math.cos(a)*1.02,[0,a,0],()=>{box(.16,.34,.5, 0,-.17,0, C.cream);box(.1,.06,.34, 0,.17,0, C.la,{e:1,th:.1});});}});

/* --- 정비소: saw-tooth shed with a repair bay door, travelling gantry crane, service pad, gear block and stores --- */
const SHED_A=Math.atan2(.8,1.45),GEAR_A=Math.atan2(1.2,1.9);
const gShop=model(()=>{
 pad(C.tealD,C.lt);
 box(4.3,.3,3.0, -1.15,.42,-1.75, C.dark);box(4.2,2.2,2.9, -1.15,.42,-1.75, C.cream);
 for(let k=0;k<2;k++){const zc=-1.025-k*1.45;                                               // two roof teeth with skylights on the slopes
  wedge(4.2,.8,1.45, -1.15,2.62,zc, C.steel);box(4.3,.1,.16, -1.15,3.38,zc-.66, C.dark);
  at(-1.15,3.02,zc,[SHED_A,0,0],()=>{for(let j=0;j<3;j++)box(1.1,.05,1.1, -1.3+j*1.3,.015,0, C.lt2,{e:1,th:[.2,.66,.4,.52,.08,.8][k*3+j]});});}
 box(2.8,2.0,.14, -1.75,.42,-.26, C.dark);                                                   // bay door frame
 box(2.4,.62,.06, -1.75,.48,-.2, C.lt,{e:2});                                              // light from inside the bay
 box(2.4,1.2,.1, -1.75,1.12,-.17, C.steel);
 for(let k=0;k<3;k++)box(2.4,.05,.12, -1.75,1.42+k*.3,-.165, C.metal);
 box(.1,1.4,.06, -3.22,.7,-.26, C.lt,{e:1,th:.3});box(.1,1.4,.06, -.28,.7,-.26, C.lt,{e:1,th:.3});
 box(1.0,.34,.06, .3,1.8,-.27, C.lt,{e:1,th:.46});
 box(.14,.08,3.1, -2.95,.48,1.45, C.steel);box(.14,.08,3.1, .95,.48,1.45, C.steel);         // crane rails
 cyl(1.2,1.26,.1,12, -1.0,.48,1.55, C.dark);                                                 // service pad with a spare gun
 for(let k=0;k<8;k++){const a=k*TAU/8;box(.3,.04,.12, -1.0+Math.sin(a),.58,1.55+Math.cos(a), C.lt,{r:[0,a,0],e:1,th:.24});}
 box(.7,.34,.5, -1.15,.58,1.55, C.steel);box(.34,.12,.6, -1.15,.92,1.55, C.cream);cyl(.1,.1,.9,6, -.8,.75,1.55, C.dark,{r:[0,0,-HPI]});
 box(1.9,.3,2.7, 2.35,.42,-1.9, C.dark);box(1.8,1.3,2.6, 2.35,.42,-1.9, C.steel);           // gear block
 wedge(1.8,1.2,1.9, 2.35,1.72,-2.25, C.cream);
 box(1.5,.07,.34, 2.35,1.72,-.95, C.lt,{e:1,th:.58});
 box(1.5,.95,.06, 2.35,.62,-.58, C.dark);                                                    // tool board
 for(let k=0;k<5;k++){const h=[.6,.42,.7,.5,.36][k];box(.1,h,.05, 1.8+k*.28,1.47-h,-.54, [C.cream,C.amber,C.cream,C.teal,C.creamD][k]);}
 cyl(.22,.22,1.0,6, 1.75,.48,.35, C.tealD);cyl(.1,.14,.16,6, 1.75,1.48,.35, C.cream);       // gas bottles, crates
 cyl(.22,.22,1.0,6, 2.3,.48,.3, C.cream);cyl(.1,.14,.16,6, 2.3,1.48,.3, C.tealD);
 cbox(1.0,.7,1.0,.08, 2.65,.48,1.7, C.metal);box(1.02,.12,.3, 2.65,.86,1.7, C.tealD);box(.6,.45,.6, 2.5,1.18,1.6, C.creamD);
 box(.1,.7,.1, 3.05,1.72,-.8, C.dark);box(.3,.26,.3, 3.05,2.42,-.8, C.white,{e:3});         // warning lamp
});
const gGantry=model(()=>{                                                                    // origin: deck level, centre between the rails
 for(const s of[-1,1]){box(.5,.3,1.0, s*1.95,0,0, C.dark);box(.3,3.25,.5, s*1.95,.3,0, C.cream);bar(s*1.95,2.5,0, s*1.2,3.52,0, .09, C.steel);
  box(.24,.5,.7, s*2.3,3.47,0, C.dark);box(.2,.16,.2, s*1.95,3.97,0, C.lt,{e:1,th:.15});}
 box(4.6,.42,.6, 0,3.55,0, C.tealD);box(4.6,.08,.68, 0,3.5,0, C.dark);
 box(.7,.28,.8, .2,3.22,0, C.dark);box(.3,.06,.3, .2,3.16,0, C.lt,{e:1,th:.3});
 box(.06,1.25,.06, .2,1.95,0, C.dark);box(.34,.26,.34, .2,1.72,0, C.cream);box(.5,.1,.12, .2,1.62,0, C.dark);
});
const gGear=model(()=>{cyl(.62,.62,.16,12, 0,0,0, C.teal);
 for(let k=0;k<8;k++){const a=k*TAU/8;box(.26,.16,.3, Math.sin(a)*.74,0,Math.cos(a)*.74, C.teal,{r:[0,a,0]});}
 cyl(.26,.26,.24,8, 0,0,0, C.cream);cyl(.12,.12,.28,6, 0,0,0, C.lt,{e:1,th:.2});
 for(let k=0;k<4;k++){const a=k*HPI+.4;cyl(.11,.11,.18,6, Math.sin(a)*.42,0,Math.cos(a)*.42, C.dark);}});

/* --- 중앙 송신소: cabin, lattice mast, core gauge bands, sweeping dish, antenna spire with the beacon, guy cables --- */
const gHub=model(()=>{
 const o8={r:[0,Math.PI/8,0]};
 cyl(2.3,2.46,.5,8, 0,0,0, C.dark,o8);cyl(2.02,2.02,.06,8, 0,.5,0, C.deck,o8);
 cbox(1.9,1.2,1.15,.14, 0,.5,1.25, C.cream);box(1.3,.3,.06, .15,1.1,1.83, C.hot,{e:3});box(.42,.8,.06, -.62,.56,1.83, C.dark);
 box(.6,.18,.5, .45,1.7,1.2, C.steel);
 cbox(1.3,.85,.9,.12, .3,.5,-1.45, C.steel);box(.9,.06,.5, .3,1.35,-1.45, C.dark);
 fru(1.0,1.0,.46,.46,3.74, 0,.56,0, C.dark);                                                 // dark core behind the lattice
 const lv=[.56,1.8,3.05,4.3],sy=y=>.86-.36*(y-.56)/3.74;
 for(const sx of[-1,1])for(const sz of[-1,1])bar(sx*.86,.56,sz*.86, sx*.5,4.3,sz*.5, .1, C.steel);
 for(let k=0;k<3;k++){const y=lv[k],s=sy(y),yb=lv[k+1],sb=sy(yb),f=k%2?1:-1;
  if(k>0)for(const d of[-1,1]){bar(-s,y,d*s, s,y,d*s, .07, C.steel);bar(d*s,y,-s, d*s,y,s, .07, C.steel);}
  for(const d of[-1,1]){bar(-s*f,y,d*s, sb*f,yb,d*sb, .06, C.steel);bar(d*s,y,-s*f, d*sb,yb,sb*f, .06, C.steel);}}
 cyl(.98,.98,.14,8, 0,4.3,0, C.dark,o8);
 for(let k=0;k<4;k++){const a=Math.PI/4+k*HPI;at(Math.sin(a)*.82,4.44,Math.cos(a)*.82,[0,a,0],()=>{box(.26,.95,.12, 0,0,0, C.cream);box(.12,.14,.05, 0,.72,.07, C.white,{e:1});});}
 cyl(.24,.32,3.2,6, 0,4.44,0, C.cream);
 for(let k=0;k<6;k++)cyl(.38,.38,.22,6, 0,5.55+k*.36,0, C.white,{e:2,th:(k+.3)/6});          // gauge of G.core
 cyl(.6,.6,.12,8, 0,7.64,0, C.dark,o8);
 cyl(.07,.12,2.25,5, 0,7.76,0, C.steel);
 bar(-.45,9.35,0, .45,9.35,0, .045, C.steel);bar(0,9.35,-.45, 0,9.35,.45, .045, C.steel);bar(-.28,9.7,0, .28,9.7,0, .04, C.steel);bar(0,9.7,-.28, 0,9.7,.28, .04, C.steel);
 sph(.27, 0,10.2,0, C.white,{e:1});                                                          // beacon
 for(const sx of[-1,1])for(const sz of[-1,1]){box(.4,.24,.4, sx*1.42,.5,sz*1.42, C.metal);bar(sx*1.42,.74,sz*1.42, sx*.3,7.5,sz*.3, .05, C.steel);}
});
const gDish=model(()=>{                                                                      // origin on the mast axis at y = 7.76, dish towards +X
 cyl(.3,.34,.4,8, 0,0,0, C.steel);bar(0,.25,0, .85,.45,0, .1, C.dark);
 at(1.05,.5,0,[0,0,-.96],()=>{shell(1.15,.2,.34,12, 0,0,0, C.steel,C.cream);cyl(.2,.2,.04,8, 0,-.02,0, C.dark);tor(1.15,.05, 0,.34,0, C.cream,{rs:4});
  for(let k=0;k<3;k++){const a=k*TAU/3;bar(Math.sin(a)*1.05,.32,Math.cos(a)*1.05, 0,.95,0, .03, C.steel);}
  box(.16,.16,.16, 0,.9,0, C.white,{e:1});});
});

/* --- per lane: leak gate at x = 0 (posts outside the corridor, lit sill across it) and the conduit stub to the hub line --- */
function laneGeo(col){return model(()=>{
 for(const s of[-1,1]){box(.95,.22,.95, 0,0,s*4.95, C.dark);cbox(.72,.86,.72,.12, 0,.22,s*4.95, C.steel);
  box(.5,.26,.5, 0,1.08,s*4.95, C.white,{e:1});box(.6,.07,.6, 0,1.34,s*4.95, C.dark);box(.16,.5,.08, 0,.42,s*4.57, C.white,{e:1});}
 fru(.9,9.2,.46,9.1,.4, 0,0,0, C.dark);
 for(let k=0;k<7;k++)box(.26,.05,.86, 0,.4,-3.6+k*1.2, C.white,{e:1});
 box(2.3,.24,.5, -9.75,0,0, C.dark);box(2.1,.04,.12, -9.75,.24,0, col,{e:2});
 for(let k=0;k<2;k++)box(.07,.3,.64, -9.2-k*1.1,0,0, C.metal);
 cbox(.9,.46,.9,.1, -11,0,0, C.metal);box(.32,.06,.32, -11,.46,0, col,{e:2});
});}
// conduit along z through the hub, modelled one unit long each way; scale.z = signed lane z, so +z is always lane 0
const gRun=model(()=>{box(.5,.24,2, 0,0,0, C.dark);
 for(const s of[-1,1]){for(let k=0;k<3;k++)box(.64,.3,.03, 0,0,s*(.45+k*.2), C.metal);box(.12,.04,.6, 0,.24,s*.67, s>0?C.la:C.lt,{e:s>0?1:2});}});

/* --- turret bunker on the median and the two turrets --- */
const gBunker=model(()=>{
 cbox(3.6,.3,5.5,.1, 0,0,0, C.dark);
 cbox(2.3,1.15,2.5,.26, -.1,.3,0, C.steel);box(1.5,.05,1.6, -.1,1.45,0, C.creamD);
 fru(.9,2.7,.34,2.5,.72, 1.3,.3,0, C.metal);                                                 // glacis on the enemy side
 box(.06,.14,1.7, 1.03,1.04,0, C.dark);box(.08,.8,.62, -1.24,.3,0, C.dark);box(.05,.1,.3, -1.26,1.14,0, C.good,{e:1});   // firing slit, rear door
 cyl(.4,.4,.08,8, -.45,1.5,0, C.dark);box(.5,.3,.7, -.1,1.0,1.3, C.metal);box(.5,.3,.7, -.1,1.0,-1.3, C.metal);
 for(let k=0;k<3;k++)box(.2,.08,.2, .45,1.5,-.6+k*.6, C.good,{e:1});
 cyl(.05,.08,1.0,5, -.9,1.45,.75, C.steel);box(.16,.14,.16, -.9,2.45,.75, C.white,{e:1});
 for(const s of[-1,1]){
  box(.9,.7,.9, 0,.3,s*1.65, C.dark);cyl(.6,.74,1.2,8, 0,.3,s*2.5, C.metal);cyl(.94,.84,.12,12, 0,1.5,s*2.5, C.dark);
  // charge ring: eight segments that fill with the 협동 조준 bonus
  for(let k=0;k<8;k++){const a=(k+.5)*TAU/8;box(.36,.05,.17, Math.sin(a)*.79,1.62,s*2.5+Math.cos(a)*.79, C.white,{r:[0,a,0],e:2,th:(k+.4)/8*.96});}
  cbox(.5,.5,.9,.1, 1.4,.3,s*1.75, C.metal);}
});
// head: origin = the pivot, barrel towards +X
function headGeo(col,lamp){return model(()=>{
 cyl(.5,.56,.14,10, 0,-.54,0, C.steel);cyl(.34,.42,.2,8, 0,-.42,0, C.dark);
 cbox(1.25,.74,1.0,.2, -.12,-.28,0, C.cream);
 box(.5,.5,.12, .12,-.22,.56, C.metal);box(.5,.5,.12, .12,-.22,-.56, C.metal);
 box(.42,.5,.84, -.86,-.22,0, C.metal);box(.3,.06,.84, -.86,.28,0, col);
 box(.66,.05,.26, -.2,.46,0, lamp,{e:1});
 box(.24,.12,.24, .22,.46,.28, C.dark);box(.06,.08,.14, .35,.48,.28, C.white,{e:1});
});}
const gGun=model(()=>{
 box(.36,.5,.66, .42,-.25,0, C.metal);box(.86,.34,.4, 1.0,-.17,0, C.steel);
 cyl(.13,.13,1.05,6, 1.4,0,0, C.dark,{r:[0,0,-HPI]});
 box(.26,.3,.36, 2.42,-.15,0, C.metal);box(.05,.2,.24, 2.57,-.1,0, C.white,{e:2});
 for(let k=0;k<3;k++)box(.2,.04,.22, .72+k*.28,.17,0, C.white,{e:3,th:[.12,.45,.8][k]});     // heat strip
});
const TS=1.18,MUZZLE=2.7*TS;                                                               // turret scale, pivot-to-muzzle distance

/* ================= 5. scene assembly ================= */
const casters=[];                                                                            // meshes that cast shadows, with the quality level they need
function add(parent,geo,m,sh){const o=new THREE.Mesh(geo,m);o.receiveShadow=true;o.castShadow=false;if(sh)casters.push(o,sh);parent.add(o);return o;}
let Q=2,rc=-1,rs=0;                                                                          // quality; cos/sin of the buildings' facing turn
function makeFac(i){
 const root=new THREE.Group(),tilt=new THREE.Group(),m=glowMat();root.add(tilt);scene.add(root);
 const F={i,root,tilt,mat:m,lvl:m.userData.lvl,on:1,slump:0,sv:0,sp:1,ph:i*2,jt:9,ja:0,ts:1,tk:1,alt:0,weld:0,arc:0,arcS:1,wx:A.facX,wz:0,mover:null,gearG:null,gear:null};
 add(tilt,i?gShop:gPower,m,1);
 if(i){F.mover=add(tilt,gGantry,m,2);F.mover.position.set(-1,.48,1.5);
  F.gearG=new THREE.Group();F.gearG.position.set(2.35,2.33,-2.24);F.gearG.rotation.x=GEAR_A;tilt.add(F.gearG);F.gear=add(F.gearG,gGear,m,0);}
 else{F.mover=add(tilt,gRotor,m,2);F.mover.position.set(0,4.3,PCZ);}
 return F;
}
const fac=[makeFac(0),makeFac(1)];
const gate=[0,1].map(i=>{const m=glowMat();const mesh=add(scene,laneGeo(i?C.lt:C.la),m,0);return{mesh,mat:m,fl:0,ph:0,z:0};});
const runMat=glowMat(),run=add(scene,gRun,runMat,0);run.position.set(A.hubX,0,0);
const hub={g:new THREE.Group(),mat:glowMat(),col:new THREE.Color(0x4dffb0),dish:null,droop:0,ang:0,hit:0,last:100,beat:0,ts:0};
hub.g.position.set(A.hubX,0,0);scene.add(hub.g);add(hub.g,gHub,hub.mat,1);hub.dish=add(hub.g,gDish,hub.mat,2);hub.dish.position.y=7.76;
const bunkMat=glowMat(),bunker=add(scene,gBunker,bunkMat,1);bunker.position.set(A.turretX,0,0);
const tur=[0,1].map(i=>{const g=new THREE.Group(),m=glowMat();g.scale.setScalar(TS);scene.add(g);add(g,headGeo(i?C.teal:C.amber,i?C.lt:C.la),m,1);const gun=add(g,gGun,m,2);
 return{i,g,gun,mat:m,lvl:m.userData.lvl,x:A.turretX,y:A.turretH,z:0,home:0,yaw:0,pit:0,kick:0,flash:0,zap:0,tk:1,lastFlash:0};});
// field turrets: a small copy of the turret head on a post, standing where a rare machine fell (G.fieldTurrets). A pool of three.
const FS=.95,FPIV=1.75,FMUZ=2.7*FS;                                                          // scale, pivot height, pivot-to-muzzle distance
const gPost=model(()=>{const g0=-FPIV/FS;cyl(.7,.82,.14,10, 0,g0,0, C.dark);cyl(.18,.24,-g0-.54,8, 0,g0+.1,0, C.steel);for(let k=0;k<3;k++)box(.1,.06,1.1, 0,g0+.12,0, C.metal,{r:[0,k*2.094,0]});});
const fld=[0,1,2].map(()=>{const g=new THREE.Group(),m=glowMat();g.scale.setScalar(FS);g.visible=false;scene.add(g);add(g,gPost,m,2);add(g,headGeo(C.amber,C.la),m,2);const gun=add(g,gGun,m,2);
 return{g,gun,mat:m,f:null,yaw:0,pit:.06,kick:0,flash:0,lastFlash:0,pop:0};});
function updField(dt,t,G){const list=G.fieldTurrets||[],R=G.FIELD?G.FIELD.range:120,en=G.enemies;
 for(const F of fld){if(F.f&&list.indexOf(F.f)<0)F.f=null;}
 for(const f of list){if(!fld.some(F=>F.f===f)){const F=fld.find(F=>!F.f);if(F){F.f=f;F.pop=0;F.yaw=ctx.L.laneZ[f.lane]>0?-.46:.46;F.kick=F.flash=0;F.lastFlash=0;}}}
 for(const F of fld){const f=F.f;if(!f){F.g.visible=false;continue;}
  const x=ctx.wx(f.y),z=ctx.laneZAt(f.lane,x);F.pop=Math.min(1,F.pop+dt*4);const end=Math.min(1,f.life/.4),b=F.pop<1?1+.25*Math.sin(F.pop*Math.PI):1;
  F.g.visible=true;F.g.position.set(x,FPIV,z);F.g.scale.setScalar(FS*Math.max(.05,Math.min(F.pop,end))*b);
  let e=null,best=-1e9;for(let j=0;j<en.length;j++){const q=en[j];if(q.hp<=0||q.lane!==f.lane||Math.abs(q.y-f.y)>R)continue;const pr=q.y+(q.type==='boss'?6:0);if(pr>best){best=pr;e=q;}}
  let yawT=(ctx.L.laneZ[f.lane]>0?-.46:.46)+Math.sin(t*.6+f.id*9)*.5,pitT=.06;
  if(e){ctx.enemyPos(e,v);const dx=v.x-x,dy=v.y-FPIV,dz=v.z-z;yawT=Math.atan2(-dz,dx);pitT=clamp(Math.atan2(dy,Math.sqrt(dx*dx+dz*dz)),-.5,.4);}
  F.yaw=damp(F.yaw,yawT,e?13:2.5,dt);F.pit=damp(F.pit,pitT,10,dt);
  if(f.flash>F.lastFlash+.05){F.kick=1;F.flash=1;}F.lastFlash=f.flash;
  F.kick=Math.max(0,F.kick-dt*6.5);F.flash=Math.max(0,F.flash-dt*10);
  F.g.rotation.y=F.yaw;F.gun.rotation.z=F.pit;F.gun.position.x=-.7*F.kick*F.kick;
  const blink=f.life<3?(Math.sin(t*18)>0?1:.2):1;                                         // the last three seconds it blinks
  setG(F.mat,0,cW,blink);setG(F.mat,1,cHot,3.5*F.flash);setG(F.mat,2,cA,1.2*blink);
  if(F.flash>0){const cy=Math.cos(F.yaw),sy=Math.sin(F.yaw),cp=Math.cos(F.pit),m=FMUZ;spr(glowB,x+cy*cp*m,FPIV+Math.sin(F.pit)*m,z-sy*cp*m,1.2+2*F.flash,cHot,F.flash);}
  if(F.pop<1)spr(glowB,x,.6,z,6*(1-F.pop),cA,.8*(1-F.pop));}
}
function applyShadows(){for(let i=0;i<casters.length;i+=2)casters[i].castShadow=Q>=casters[i+1];}

/* ================= 6. per-frame state ================= */
const v=new THREE.Vector3(),tgt=[null,null],bestP=[0,0],near=[0,0];
// facility-local point -> world (only the facing turn and the position; the jolt is ignored on purpose)
function fw(F,x,y,z){return v.set(F.wx+x*rc+z*rs,y,F.wz-x*rs+z*rc);}
// smoke / spark sources and glow points in facility-local coordinates
const SRC=[[0,3.4,PCZ, 2.4,1.9,2.05],[-1.2,3.5,-1.7, 2.35,2.9,-2.2]];

function updFac(F,dt,t,G){
 const i=F.i,hp=G.facilities[i],f=clamp(hp/100,0,1),alive=hp>0,crit=alive&&hp<28,dmg=alive&&hp<=60,S=SRC[i],deco=Q>0;
 F.on=damp(F.on,alive?1:0,alive?4:8,dt);
 // collapse falls under gravity with one small bounce; repair eases back
 if(alive){F.sv=0;F.slump=damp(F.slump,0,4,dt);}
 else if(F.slump<1||F.sv!==0){F.sv+=18*dt;F.slump+=F.sv*dt;if(F.slump>=1){F.slump=1;F.sv=F.sv>1.6?-F.sv*.3:0;}}
 const sl=F.slump;F.mat.color.setScalar(1-.45*sl);
 let fl=1;
 if(crit)fl=Math.sin(t*31+i*4)*Math.sin(t*17.3+1.7)>.2?.28:1;
 else if(dmg)fl=Math.sin(t*7.3+i*2)*Math.sin(t*2.9)>.86?.45:1;
 if(F.jt<.35&&Math.sin(F.jt*75)<0)fl*=.3;                                   // lights stutter right after a leak
 const hum=1+.07*Math.sin(t*3.1+i*2),on=F.on*fl;
 setG(F.mat,0,cW,1.0*on*hum);F.lvl.x=f;
 F.weld=Math.max(0,F.weld-dt*5);
 setG(F.mat,1,cW,i?(.8+1.6*F.weld)*on:(1.02+.16*Math.sin(t*2.3))*on);
 const blink=crit&&(t*2.6)%1<.5;
 setG(F.mat,2,cR,blink?2.2:0);
 // moving parts slow down with damage and stop when offline
 F.sp=damp(F.sp,alive?(crit?.22+.3*Math.abs(Math.sin(t*5.3)):dmg?.6:1):0,3,dt);
 const mv=F.mover;
 if(i){F.ph+=dt*.55*F.sp;const gz=1.5+.72*Math.sin(F.ph);
  mv.position.set(-1,.48-.1*sl,gz+(1.05-gz)*sl);mv.rotation.set(-.6*sl,.1*sl,.17*sl);                // gantry falls back onto the shed
  F.gear.rotation.y+=dt*1.5*F.sp;}
 else{F.ph+=dt*2.3*F.sp;mv.position.set(.3*sl,4.3-.95*sl,PCZ+.35*sl);mv.rotation.set(.5*sl,F.ph,.3*sl);}     // the collector drops into the cage, crooked
 // jolt after a leak (stronger when the facility goes down), then the slumped rest pose
 let jx=0,jz=0,jy=0,jr=0;
 if(F.jt<.9){F.jt+=dt;const e=Math.exp(-7*F.jt)*F.ja;jx=e*Math.sin(F.jt*58);jz=e*Math.cos(F.jt*47)*.7;jy=-e*Math.abs(Math.sin(F.jt*33))*.5;jr=e*.22*Math.sin(F.jt*41);}
 F.tilt.position.set(jx,jy-.1*sl,jz);F.tilt.rotation.set(jr*.6+.02*sl,0,jr+(i?-.035:.035)*sl);
 // pooled smoke and sparks
 F.ts-=dt;F.tk-=dt;
 if(F.ts<=0){F.alt^=1;const half=Q===0&&F.alt;
  if(!alive){F.ts=.24+Math.random()*.12;if(!half){fw(F,S[0],S[1]+.1,S[2]);puff(v.x,v.y,v.z,.9,cSmoke,cAsh);}}
  else if(crit){F.ts=.8+Math.random()*.5;if(!half){fw(F,S[3],S[4],S[5]);puff(v.x,v.y,v.z,.7,cSmoke,cAsh);}}
  else if(dmg){F.ts=1.9+Math.random();if(!half){fw(F,S[3],S[4],S[5]);puff(v.x,v.y,v.z,.55,cSteam,null,.6);}}
  else{F.ts=.55;if(deco&&!i){fw(F,2.4,1.8,2.05);emit(true,v.x+rnd()*.5,v.y,v.z+rnd()*.3,-.15,.8,0,1.5,.7,1.5,cWarm,.1,0);}}}   // heat over the vent
 if(F.tk<=0){
  if(!alive){F.tk=1.6+Math.random()*2.4;fw(F,S[0]+rnd()*2,S[1]-1,S[2]+rnd()*2);sparks(v.x,v.y,v.z,2,cSpark,3);}
  else if(crit){F.tk=.5+Math.random()*.8;fw(F,S[3],S[4],S[5]);sparks(v.x,v.y,v.z,3,cSpark,4);}
  else if(dmg){F.tk=1.6+Math.random()*1.8;fw(F,S[3],S[4],S[5]);sparks(v.x,v.y,v.z,2,cSpark,3.5);}
  else{F.tk=1.8+Math.random()*1.6;                                                    // healthy: welding in the bay / an arc off a coil
   if(i){F.weld=1;if(deco){fw(F,-1.75,.8,.1);sparks(v.x,v.y,v.z,2,cZap,2.6);}}else if(deco){F.arc=1;F.arcS=Math.random()<.5?-1:1;}}}
 // halos and the light pool on the ground
 const gk=on*(deco?hum:1);
 if(deco)spr(poolB,F.wx,.1,F.wz,19,laneCol[i],(.1+.16*f)*gk*(i?1:1.7));           // big additive quads cost fill rate: not at quality 0
 if(i){fw(F,-1.75,.9,.5);spr(glowB,v.x,v.y,v.z,3.4+F.weld,cT,(.3+.4*F.weld)*on);
  fw(F,-1.15,3.3,-1.7);spr(glowB,v.x,v.y,v.z,5,cT,.13*gk*f);
  if(f>.15){fw(F,-2.95,4.6-.6*sl,mv.position.z);spr(glowB,v.x,v.y,v.z,.9,cT,.6*on);fw(F,.95,4.6-.6*sl,mv.position.z);spr(glowB,v.x,v.y,v.z,.9,cT,.6*on);}}
 else{fw(F,0,2.7,PCZ);spr(glowB,v.x,v.y,v.z,5.4,cA,.4*gk);spr(glowB,v.x,v.y+.2,v.z,2.4,cHot,.26*gk);
  if(f>.32){fw(F,-2.5,5.14,-2.5);spr(glowB,v.x,v.y,v.z,1.7,cA,.6*on);}
  if(f>.64){fw(F,2.5,5.14,-2.5);spr(glowB,v.x,v.y,v.z,1.7,cA,.6*on);}
  if(F.arc>0){F.arc=Math.max(0,F.arc-dt*6);if(alive)for(let j=1;j<9;j++){const u=j/9;           // crackle from a coil ball to the collector
   fw(F,F.arcS*2.5*(1-u)+Math.sin(t*90+j*2)*.2,5.14+Math.sin(t*70+j*5)*.26,-2.5+(PCZ+2.5)*u);spr(glowB,v.x,v.y,v.z,.5,cHot,F.arc);}}}
 if(blink){if(i)fw(F,3.05,2.55,-.8);else fw(F,3.05,2.5,2.55);spr(glowB,v.x,v.y,v.z,2.4,cR,.8);}
}

// cross-fade a lamp colour to red. A straight mix of teal and red passes through white, so the lane colour is dimmed faster than the red comes in.
function toRed(c,m){const a=(1-m)*(1-m);c.r=c.r*a+cR.r*m;c.g=c.g*a+cR.g*m;c.b=c.b*a+cR.b*m;}
function updGate(g,i,dt,t,G){
 g.fl=Math.max(0,g.fl-dt);
 const off=G.facilities[i]<=0,warn=clamp(1-near[i]/90,0,1),z=g.z;
 let k=.95+.1*Math.sin(t*2+i*3);tmpC.copy(laneCol[i]);
 if(off){tmpC.copy(cR);k=.55+.25*Math.sin(t*5.7)*Math.sin(t*13.1);}
 // An enemy is about to cross: red blinks, longer and faster as it nears. The phase is integrated: t*rate would jump wildly while the rate changes.
 if(warn>0&&!off){g.ph=(g.ph+dt*(1.5+2.5*warn))%1;if(g.ph<.2+.55*warn){tmpC.copy(cR);k=1.15;}}else g.ph=0;
 if(g.fl>0){const m=Math.min(1,g.fl*2.2);toRed(tmpC,m);k+=((Math.sin(t*26)>0?1.5:.35)-k)*m;}               // leak: red strobe for about a second
 setG(g.mat,0,tmpC,k);
 setG(g.mat,1,cW,.9*fac[i].on);
 const a=Math.min(.9,.32*k);
 spr(glowB,0,1.25,z-4.95,1.5+g.fl,tmpC,a);spr(glowB,0,1.25,z+4.95,1.5+g.fl,tmpC,a);
 if(g.fl>0){const m=Math.min(1,g.fl*1.5),m2=m*m;spr(glowB,0,.7,z,9,cR,.32*m2);spr(poolB,-.5,.55,z,13,cR,.55*m2);}   // short red wash; fx.js adds the blast
 // power flowing from the facility to the hub
 if(Q>0&&fac[i].on>.5){const sg=z<0?-1:1,b=Math.abs(z)-2.4;
  for(let j=0;j<2;j++){const u=(t*.3+j*.5+i*.27)%1,s=u*(2.4+b),e=Math.sin(u*Math.PI);
   if(s<2.4)spr(glowB,-8.6-s,.36,z,.85,laneCol[i],.75*e);else spr(glowB,A.hubX,.36,z-sg*(s-2.4),.85,laneCol[i],.75*e);}}
}

function updHub(dt,t,G){
 const c=G.core,alive=c>0,f=clamp(c/100,0,1);let k;
 if(!alive)k=0;
 else if(c<28){tmpC.copy(cR);k=(t*3.4)%1<.5?2.4:.2;}
 else if(c<50){tmpC.copy(cWarm);k=1.1+.6*Math.sin(t*4.2);}
 else{tmpC.copy(cG);k=.72+.16*Math.sin(t*1.5);}
 if(c<hub.last-.01)hub.hit=1;hub.last=c;hub.hit=Math.max(0,hub.hit-dt*2.2);            // the core just took damage: flash red
 if(alive){hub.col.lerp(tmpC,1-Math.exp(-6*dt));if(hub.hit>0){hub.col.lerp(cR,hub.hit*.8);k+=1.6*hub.hit*(Math.sin(t*30)>0?1:.3);}}
 setG(hub.mat,0,hub.col,k);setG(hub.mat,1,hub.col,alive?.8:0);hub.mat.userData.lvl.y=f;setG(hub.mat,2,cW,alive?.9:0);
 hub.droop=damp(hub.droop,alive?0:1,3,dt);hub.mat.color.setScalar(1-.4*hub.droop);
 if(!alive){hub.ts-=dt;if(hub.ts<=0){hub.ts=.45+Math.random()*.2;puff(A.hubX,6.5,0,.7,cSmoke,cAsh);}}                 // a dead hub smokes
 if(alive&&Q>0)hub.ang+=dt*.32;
 hub.dish.rotation.set(0,hub.ang,-.55*hub.droop);
 spr(glowB,A.hubX,10.2,0,4,hub.col,Math.min(.8,.42*k));
 spr(glowB,A.hubX,6.5,0,3.2,hub.col,alive?.16*f:0);if(Q>0)spr(poolB,A.hubX,.1,0,13,hub.col,Math.min(.3,.2*k));
 if(alive&&Q>0){hub.beat=(hub.beat+dt*(c<28?.9:c<50?.55:.3))%1;spr(glowB,A.hubX,10.2,0,2+9*hub.beat,hub.col,.2*(1-hub.beat));}   // transmit pulse
}

function updTurrets(dt,t,G){
 const shopDown=G.facilities[1]<=0,cap=G.effects.focusCap,frac=cap>0?clamp(G.focusBonus()/cap,0,1):0,pierce=G.pierceOn();
 // bunker: status lamps follow the workshop, the rings show the 협동 조준 charge
 setG(bunkMat,0,cW,shopDown?(Math.sin(t*19)*Math.sin(t*6.3)>0?.4:.1):1);
 if(pierce){setG(bunkMat,1,cHot,1.7+.4*Math.sin(t*11));bunkMat.userData.lvl.y=1.1;}else{setG(bunkMat,1,cA,1.2);bunkMat.userData.lvl.y=frac;}
 for(let i=0;i<2;i++){const T=tur[i],e=tgt[i];let gt=G.turrets[i],yawT,pitT;if(gt&&gt.lane!==i)gt=G.turrets[1-i];
  if(e){ctx.enemyPos(e,v);const dx=v.x-T.x,dy=v.y-T.y,dz=v.z-T.z;yawT=Math.atan2(-dz,dx);pitT=clamp(Math.atan2(dy,Math.sqrt(dx*dx+dz*dz)),-.5,.4);}
  else{yawT=T.home+Math.sin(t*.42+i*2.1)*.6;pitT=.06;}                       // idle sweep
  T.yaw=damp(T.yaw,yawT,e?13:2.5,dt);T.pit=damp(T.pit,pitT,10,dt);
  // the bridge also exposes flash (>0 right after a shot): use it as a backup for the hit event
  const gf=gt?gt.flash:0;if(gf>T.lastFlash+.05)fire(T);T.lastFlash=gf;
  T.kick=Math.max(0,T.kick-dt*6.5);T.flash=Math.max(0,T.flash-dt*10);T.zap=Math.max(0,T.zap-dt*8);
  T.g.rotation.y=T.yaw;T.gun.rotation.z=T.pit;T.gun.position.x=-.7*T.kick*T.kick;
  const dim=shopDown?(Math.sin(t*23+i*3)*Math.sin(t*7.1)>0?.55:.14):1;
  setG(T.mat,0,cW,1.0*dim);
  setG(T.mat,1,cHot,3.5*T.flash+(pierce?1.3+.3*Math.sin(t*11+i):0));
  if(pierce){setG(T.mat,2,cHot,1.7);T.lvl.z=1.1;}else{setG(T.mat,2,cA,1.2*dim);T.lvl.z=frac;}
  const cy=Math.cos(T.yaw),sy=Math.sin(T.yaw),cp=Math.cos(T.pit),sp=Math.sin(T.pit),m=MUZZLE-.7*T.kick*T.kick;
  const mx=T.x+cy*cp*m,my=T.y+sp*m,mz=T.z-sy*cp*m;
  if(T.flash>0){spr(poolB,mx,.3,mz,7.2,cWarm,.5*T.flash);spr(glowB,mx,my,mz,1.9+3*T.flash,cHot,T.flash);spr(glowB,mx+cy*.6,my,mz-sy*.6,1.2+1.7*T.flash,cW,T.flash);}
  if(pierce)spr(glowB,mx,my,mz,1.5+.3*Math.sin(t*11+i),cHot,.75);
  if(frac>0)spr(glowB,T.x,1.7,T.z,2.3+2.1*frac+(pierce?.4:0),pierce?cHot:cA,.2+.45*frac);          // the charge has to read at phone size, where the ring is a few pixels
  if(shopDown){T.tk-=dt;if(T.tk<=0){T.tk=.5+Math.random()*1.1;T.zap=1;if(Q>0||i)sparks(T.x-.5,T.y-.3,T.z,2,cZap,2.8);}
   if(T.zap>0)spr(glowB,T.x-.4,T.y,T.z,1.8,cZap,.7*T.zap);}
 }
}
function fire(T){T.kick=1;T.flash=1;}

/* ================= 7. part interface ================= */
return{
 layout(L){
  // the buildings turn their front to the camera: south in 'side', west (behind the base) in 'behind'
  const ry=L.mode==='side'?Math.PI:-HPI;rc=Math.cos(ry);rs=Math.sin(ry);
  for(let i=0;i<2;i++){const F=fac[i],z=L.laneZ[i];F.wz=z;F.root.position.set(A.facX,0,z);F.root.rotation.y=ry;
   gate[i].z=z;gate[i].mesh.position.set(0,0,z);
   const T=tur[i];ctx.turretPos(i,v);T.x=v.x;T.y=v.y;T.z=v.z;T.g.position.copy(v);const h=v.z>0?-.46:.46;if(h!==T.home){T.home=h;T.yaw=h;}}
  hub.g.rotation.y=ry;run.scale.z=L.laneZ[0];
 },
 update(dt,t,G){
  glowB.c=0;smokeB.c=0;poolB.c=0;
  // one pass over the enemies: turret targets (same rule as the game: in range, closest to the base) and distance to each gate
  const en=G.enemies,TY=G.TURRET_Y,R=G.phase==='battle'?G.BAL.turretRange:-1;
  tgt[0]=tgt[1]=null;bestP[0]=bestP[1]=-1e9;near[0]=near[1]=1e9;
  for(let j=0;j<en.length;j++){const e=en[j],l=e.lane;if(e.hp<=0||(l!==0&&l!==1))continue;
   const d=G.LEAK_Y-e.y;if(d<near[l])near[l]=d;
   if(Math.abs(e.y-TY)>R)continue;const p=e.y+(e.type==='boss'?6:0);if(p>bestP[l]){bestP[l]=p;tgt[l]=e;}}
  updFac(fac[0],dt,t,G);updFac(fac[1],dt,t,G);
  updGate(gate[0],0,dt,t,G);updGate(gate[1],1,dt,t,G);
  setG(runMat,0,cW,.9*fac[0].on);setG(runMat,1,cW,.9*fac[1].on);
  updHub(dt,t,G);updTurrets(dt,t,G);updField(dt,t,G);
  updParticles(dt);flush(glowB);flush(smokeB);flush(poolB);
 },
 event(ev,G){
  if(ev.t==='hit'){if(ev.src==='turret'&&ev.e){const T=tur[ev.e.lane];if(T)fire(T);}}
  else if(ev.t==='leak'){const F=fac[ev.lane],g=gate[ev.lane];if(!F)return;
   g.fl=1;F.jt=0;F.ja=ev.down?.6:.28;
   fw(F,0,1.6,0);sparks(v.x+2.5,1.2,v.z,ev.down?4:3,cSpark,4);
   if(ev.down){const S=SRC[F.i],n=Q?4:2;                                                 // fx.js owns the blast, the fireball and the camera shake
    for(let k=0;k<n;k++){fw(F,rnd()*4,1+Math.random()*2.5,rnd()*4);puff(v.x,v.y,v.z,.9,cSmoke,cAsh);}
    fw(F,S[0],S[1]-.6,S[2]);sparks(v.x,v.y,v.z,Q?8:4,cSpark,6);}
   else puff(v.x+2.6,1,v.z,.5,cSteam,null,.45);}
  else if(ev.t==='stage'){                                                               // new operation: everything is repaired at once
   for(let i=0;i<NP;i++)parts[i].on=false;
   for(let i=0;i<2;i++){const F=fac[i];F.on=1;F.slump=0;F.sv=0;F.sp=1;F.jt=9;F.weld=0;gate[i].fl=0;tur[i].kick=tur[i].flash=tur[i].zap=0;}
   hub.droop=0;}
 },
 quality(q){Q=q;applyShadows();}
};
});})();
