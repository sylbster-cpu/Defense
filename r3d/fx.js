/* fx.js — 사격 궤적·피격 불꽃·폭발·과부하 충격파·돌파 폭발 같은 순간 효과. 모두 고정 크기 풀에서 꺼내 쓰고 게임 이벤트로만 움직인다. */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('fx',ctx=>{
const {scene,A,L,U,pal,ENEMY,util}=ctx,rnd=Math.random;
let Q=ctx.quality,warm=3,lastMode='';
let GY=.3;     // height of the ground decals, just above the lane surface (measured in layout)

/* ---------- colours: display-space rgb triples derived from the shared palette ---------- */
const rgb=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
// push saturation so a tint survives additive blending
const sat=(c,k,g)=>{const l=c[0]*.3+c[1]*.59+c[2]*.11;return c.map(v=>Math.min(1,Math.max(0,(l+(v-l)*k)*g)));};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const C={white:[1,1,1],hot:[1,.96,.84],amber:sat(rgb(pal.amber),1.9,1.02),teal:sat(rgb(pal.teal),1.9,1),cream:rgb(pal.cream),eye:rgb(pal.enemyEye),
 fire0:[1,.68,.27],fire1:[.8,.15,.03],red0:[1,.5,.24],red1:[.72,.08,.03],smoke0:[.3,.2,.14],smoke1:[.12,.115,.11],black0:[.24,.14,.09],black1:[.075,.07,.07],
 dust0:sat(rgb(pal.haze),.55,.62),dust1:sat(rgb(pal.groundWarm),1,1.5),scorch:[.012,.01,.008],stone:rgb(pal.roadEdge),stoneDark:rgb(pal.metalDark),steel:rgb(pal.steel),dark:rgb(pal.enemyDark)};
C.rub0=sat(rgb(pal.haze),.7,.96);C.rock=sat(rgb(pal.haze),.45,.8);C.tealHot=mix(C.teal,C.white,.55);C.amberHot=mix(C.amber,C.white,.5);C.ghost=mix(C.teal,C.cream,.62);C.lance=mix(C.amber,C.white,.7);C.ember=[1,.55,.2];
const ENEMY_COL={};for(const k in ENEMY)ENEMY_COL[k]=rgb(pal.enemy[k]);
const LANE_COL=[C.amber,C.teal];
// at low quality roughly half of the particles are spawned
const cnt=n=>Q?Math.round(n):Math.max(1,Math.round(n*.5));

/* ---------- textures (created once) ---------- */
const texPuff=util.canvasTex(64,64,(c,w)=>{for(let i=0;i<9;i++){const a=util.rand(i+3)*6.283,d=i?util.rand(i+11)*w*.2:0,r=w*(.2+util.rand(i+21)*.1),x=w/2+Math.cos(a)*d,y=w/2+Math.sin(a)*d;
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.62)');g.addColorStop(.62,'rgba(255,255,255,.34)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,w);}},{srgb:false});
const texScorch=util.canvasTex(128,128,(c,w)=>{const h=w/2;let g=c.createRadialGradient(h,h,0,h,h,h*.82);g.addColorStop(0,'rgba(0,0,0,.92)');g.addColorStop(.45,'rgba(0,0,0,.7)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,w);
  // irregular lobes and a few blast streaks
  for(let i=0;i<12;i++){const a=util.rand(i+40)*6.283,d=h*(.3+util.rand(i+50)*.34),r=h*(.14+util.rand(i+60)*.14),x=h+Math.cos(a)*d,y=h+Math.sin(a)*d;g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,w);}
  c.strokeStyle='rgba(0,0,0,.26)';c.lineCap='round';for(let i=0;i<11;i++){const a=util.rand(i+70)*6.283,r0=h*.25,r1=h*(.6+util.rand(i+80)*.32);c.lineWidth=1.5+util.rand(i+90)*3;c.beginPath();c.moveTo(h+Math.cos(a)*r0,h+Math.sin(a)*r0);c.lineTo(h+Math.cos(a)*r1,h+Math.sin(a)*r1);c.stroke();}},{srgb:false});

/* ---------- shared instancing helper: a unit quad drawn once per pooled item ---------- */
const quad=new THREE.PlaneGeometry(1,1),noRay=()=>{};
function instanced(buf,stride,names,sizes,material,order){
 const ib=new THREE.InstancedInterleavedBuffer(buf,stride);ib.setUsage(THREE.DynamicDrawUsage);
 const g=new THREE.InstancedBufferGeometry();g.setIndex(quad.index);g.setAttribute('position',quad.attributes.position);g.setAttribute('uv',quad.attributes.uv);
 let o=0;for(let i=0;i<names.length;i++){g.setAttribute(names[i],new THREE.InterleavedBufferAttribute(ib,sizes[i],o));o+=sizes[i];}
 const m=new THREE.Mesh(g,material);m.frustumCulled=false;m.renderOrder=order;m.matrixAutoUpdate=false;m.raycast=noRay;scene.add(m);m.userData.ib=ib;return m;
}
// premultiplied output: rgb is added, alpha darkens what is behind. alpha 0 = pure additive glow, alpha 1 = opaque smoke.
const PREMUL={transparent:true,depthWrite:false,premultipliedAlpha:true,blending:THREE.NormalBlending};

/* ---------- particles: ONE draw call for glows, sparks, smoke and dust ---------- */
const PN=640,PS=13;
const pBuf=new Float32Array(PN*PS),pPos=new Float32Array(PN*3),pVel=new Float32Array(PN*3),pCol=new Float32Array(PN*6),
 pAge=new Float32Array(PN),pLife=new Float32Array(PN),pS0=new Float32Array(PN),pS1=new Float32Array(PN),pA=new Float32Array(PN),pBl=new Float32Array(PN),
 pGrav=new Float32Array(PN),pDrag=new Float32Array(PN),pStr=new Float32Array(PN),pRot=new Float32Array(PN),pRotV=new Float32Array(PN),pFin=new Float32Array(PN),pFp=new Float32Array(PN),pBnc=new Uint8Array(PN);
let pCur=0,pAlive=0;
const pMesh=instanced(pBuf,PS,['aPS','aTR','aCol','aTex'],[4,4,4,1],new THREE.ShaderMaterial(Object.assign({
 uniforms:{tGlow:{value:ctx.tex.glow},tPuff:{value:texPuff},uSun:{value:new THREE.Vector2(.8,.6)}},
 vertexShader:`attribute vec4 aPS,aTR,aCol;attribute float aTex;uniform vec2 uSun;varying vec2 vUv;varying vec4 vCol;varying float vTex,vLit;
void main(){vec4 mv=viewMatrix*vec4(aPS.xyz,1.);vec2 q=position.xy;float s=aPS.w;
 vec2 tv=(viewMatrix*vec4(aTR.xyz,0.)).xy;float tl=length(tv);vec2 off;
 if(tl>1e-4){vec2 d=tv/tl;off=d*(q.x*s+(q.x-.5)*tl)+vec2(-d.y,d.x)*q.y*s;}   // stretched back along the velocity (sparks)
 else{float c=cos(aTR.w),n=sin(aTR.w);off=vec2(q.x*c-q.y*n,q.x*n+q.y*c)*s;}
 mv.xy+=off;gl_Position=projectionMatrix*mv;vUv=uv;vCol=aCol;vTex=aTex;vLit=dot(off,uSun)/max(s,1e-4);}`,
 // puffs (vTex 1) are shaded like soft balls: warm towards the sun, cool and dark away from it
 fragmentShader:`uniform sampler2D tGlow,tPuff;varying vec2 vUv;varying vec4 vCol;varying float vTex,vLit;
void main(){float m=mix(texture2D(tGlow,vUv).a,texture2D(tPuff,vUv).a,vTex);
 vec3 sh=mix(vec3(1.),mix(vec3(.34,.37,.46),vec3(1.75,1.4,1.05),clamp(.5+vLit*1.25,0.,1.)),vTex);gl_FragColor=vec4(vCol.rgb*sh,vCol.a)*m;}`},PREMUL)),12);
// Particle presets. l=life range, s=start size range, grow=end/start size, a=peak alpha, bl=0 additive..1 alpha-blended,
// str=stretch seconds along velocity, fin=fade-in fraction, fp=fade-out power, bnc=bounces on the ground, rv=spin
const P={
 flash:{tex:0,bl:0,l0:.1,l1:.14,s0:1,s1:1,grow:1.75,c0:C.hot,c1:C.fire0,a:1,grav:0,drag:0,str:0,fin:0,fp:2,bnc:0,rv:0},
 halo:{tex:0,bl:0,l0:.22,l1:.3,s0:1,s1:1,grow:1.35,c0:C.fire0,c1:C.fire1,a:.4,grav:0,drag:0,str:0,fin:0,fp:1.6,bnc:0,rv:0},
 glow:{tex:0,bl:0,l0:.18,l1:.26,s0:1,s1:1,grow:1.5,c0:C.hot,c1:C.hot,a:.8,grav:0,drag:0,str:0,fin:0,fp:1.5,bnc:0,rv:0},
 fire:{tex:0,bl:0,l0:.26,l1:.52,s0:1,s1:1.6,grow:2.1,c0:C.fire0,c1:C.fire1,a:.9,grav:2.5,drag:4.5,str:0,fin:0,fp:1.3,bnc:0,rv:0},
 spark:{tex:0,bl:0,l0:.3,l1:.75,s0:.34,s1:.52,grow:.45,c0:C.hot,c1:C.ember,a:1,grav:-24,drag:1.2,str:.05,fin:0,fp:.8,bnc:1,rv:0},
 zip:{tex:0,bl:0,l0:.18,l1:.4,s0:.3,s1:.46,grow:.4,c0:C.hot,c1:C.hot,a:1,grav:-5,drag:2.5,str:.05,fin:0,fp:1,bnc:0,rv:0},
 ember:{tex:0,bl:0,l0:.8,l1:1.7,s0:.22,s1:.36,grow:.5,c0:C.fire0,c1:C.fire1,a:.95,grav:1.2,drag:1.6,str:0,fin:0,fp:1,bnc:0,rv:0},
 smoke:{tex:1,bl:1,l0:.9,l1:1.7,s0:1.1,s1:1.7,grow:2.3,c0:C.smoke0,c1:C.smoke1,a:.6,grav:1.5,drag:1.7,str:0,fin:.12,fp:1.2,bnc:0,rv:1.2},
 black:{tex:1,bl:1,l0:1.6,l1:2.7,s0:1.1,s1:1.7,grow:2.3,c0:C.black0,c1:C.black1,a:1,grav:.9,drag:.5,str:0,fin:.08,fp:.8,bnc:0,rv:.9},
 rubble:{tex:1,bl:.85,l0:1.1,l1:2,s0:1.1,s1:1.8,grow:2.1,c0:C.rub0,c1:C.dust0,a:.62,grav:.25,drag:2.2,str:0,fin:.1,fp:1.1,bnc:0,rv:1},
 dust:{tex:1,bl:.8,l0:.8,l1:1.5,s0:1,s1:1.6,grow:2.2,c0:C.dust0,c1:C.dust1,a:.34,grav:.35,drag:2.2,str:0,fin:.14,fp:1.2,bnc:0,rv:1},
 mote:{tex:0,bl:0,l0:2.4,l1:4,s0:.95,s1:1.6,grow:.6,c0:C.cream,c1:C.cream,a:1,grav:0,drag:.15,str:0,fin:.22,fp:1,bnc:0,rv:0}
};
function emit(k,x,y,z,vx,vy,vz,sm,c0,c1){
 const i=pCur;pCur=i+1===PN?0:i+1;if(pLife[i]<=0)pAlive++;
 const i3=i*3,i6=i*6;if(!c0){c0=k.c0;c1=k.c1;}else if(!c1)c1=c0;
 pPos[i3]=x;pPos[i3+1]=y;pPos[i3+2]=z;pVel[i3]=vx;pVel[i3+1]=vy;pVel[i3+2]=vz;
 pAge[i]=-1;pLife[i]=k.l0+rnd()*(k.l1-k.l0);const s=(k.s0+rnd()*(k.s1-k.s0))*sm;pS0[i]=s;pS1[i]=s*k.grow;
 pCol[i6]=c0[0];pCol[i6+1]=c0[1];pCol[i6+2]=c0[2];pCol[i6+3]=c1[0];pCol[i6+4]=c1[1];pCol[i6+5]=c1[2];
 pA[i]=k.a;pBl[i]=k.bl;pGrav[i]=k.grav;pDrag[i]=k.drag;pStr[i]=k.str;pRot[i]=rnd()*6.283;pRotV[i]=(rnd()-.5)*k.rv;pFin[i]=k.fin;pFp[i]=k.fp;pBnc[i]=k.bnc;
 pBuf[i*PS+12]=k.tex;
}
function stepParticles(dt){
 if(!pAlive){pMesh.visible=warm>0;return;}
 pMesh.visible=true;
 for(let i=0;i<PN;i++){
  const life=pLife[i];if(life<=0)continue;
  const o=i*PS;let age=pAge[i];age=age<0?0:age+dt;   // a new item is always drawn once at full strength
  if(age>=life){pLife[i]=0;pBuf[o+3]=0;pAlive--;continue;}
  pAge[i]=age;const i3=i*3,dr=1/(1+pDrag[i]*dt);
  let vx=pVel[i3]*dr,vy=pVel[i3+1]*dr+pGrav[i]*dt,vz=pVel[i3+2]*dr;
  let x=pPos[i3]+vx*dt,y=pPos[i3+1]+vy*dt;const z=pPos[i3+2]+vz*dt;
  if(pBnc[i]&&y<GY&&vy<0){y=GY;vy*=-.42;vx*=.6;vz*=.6;}
  pVel[i3]=vx;pVel[i3+1]=vy;pVel[i3+2]=vz;pPos[i3]=x;pPos[i3+1]=y;pPos[i3+2]=z;
  const k=age/life,e=1-(1-k)*(1-k),fp=pFp[i],fin=pFin[i];
  let f=1-k;f=fp===1?f:fp===2?f*f:Math.pow(f,fp);if(k<fin)f*=k/fin;
  const a=pA[i]*f,i6=i*6,st=pStr[i];
  pBuf[o]=x;pBuf[o+1]=y;pBuf[o+2]=z;pBuf[o+3]=pS0[i]+(pS1[i]-pS0[i])*e;
  pBuf[o+4]=vx*st;pBuf[o+5]=vy*st;pBuf[o+6]=vz*st;pBuf[o+7]=pRot[i]+=pRotV[i]*dt;
  pBuf[o+8]=(pCol[i6]+(pCol[i6+3]-pCol[i6])*k)*a;pBuf[o+9]=(pCol[i6+1]+(pCol[i6+4]-pCol[i6+1])*k)*a;pBuf[o+10]=(pCol[i6+2]+(pCol[i6+5]-pCol[i6+2])*k)*a;pBuf[o+11]=a*pBl[i];
 }
 pMesh.userData.ib.needsUpdate=true;
}

/* ---------- ribbons: camera-facing stretched quads for tracers, lances, streaks and flash columns ---------- */
const RN=32,RS=16,S_BOLT=0,S_LANCE=1,S_COLUMN=2,S_STREAK=3;
const rBuf=new Float32Array(RN*RS),rAge=new Float32Array(RN),rLife=new Float32Array(RN),rW=new Float32Array(RN),rA=new Float32Array(RN),rStyle=new Uint8Array(RN);
let rCur=0,rAlive=0;
const rMesh=instanced(rBuf,RS,['aA','aB','aCol','aWin'],[4,4,4,4],new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
 vertexShader:`attribute vec4 aA,aB,aCol,aWin;varying vec2 vUv;varying vec4 vCol,vWin;varying float vHot;
void main(){vec3 a=aA.xyz,b=aB.xyz,p=mix(a,b,uv.x);vec3 sd=cross(b-a,cameraPosition-p);float l=length(sd);sd=l>1e-5?sd/l:vec3(0.,1.,0.);
 p+=sd*position.y*aA.w;vUv=uv;vCol=aCol;vWin=aWin;vHot=aB.w;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
 // vWin: x = where the visible part starts (the tail is eaten towards the target), y = tail feather, z = head feather
 fragmentShader:`varying vec2 vUv;varying vec4 vCol,vWin;varying float vHot;
void main(){float v=abs(vUv.y*2.-1.),h=1.-v;float halo=h*h*h,core=smoothstep(.22,.04,v);
 float al=smoothstep(vWin.x,vWin.x+vWin.y,vUv.x)*smoothstep(1.,1.-vWin.z,vUv.x);
 vec3 c=vCol.rgb*halo*1.3+mix(vCol.rgb,vec3(1.,.97,.9),.6)*core*vHot;gl_FragColor=vec4(c*al*(.6+.4*vUv.x)*vCol.a,1.);}`}),14);
function ribbon(style,ax,ay,az,bx,by,bz,w,life,c,hot,alpha){
 const i=rCur;rCur=i+1===RN?0:i+1;if(rLife[i]<=0)rAlive++;const o=i*RS;
 rBuf[o]=ax;rBuf[o+1]=ay;rBuf[o+2]=az;rBuf[o+4]=bx;rBuf[o+5]=by;rBuf[o+6]=bz;rBuf[o+7]=hot;rBuf[o+8]=c[0];rBuf[o+9]=c[1];rBuf[o+10]=c[2];
 rAge[i]=-1;rLife[i]=life;rW[i]=w;rA[i]=alpha;rStyle[i]=style;
}
function stepRibbons(dt){
 if(!rAlive){rMesh.visible=warm>0;return;}
 rMesh.visible=true;
 for(let i=0;i<RN;i++){
  const life=rLife[i];if(life<=0)continue;
  const o=i*RS;let age=rAge[i];age=age<0?0:age+dt;
  if(age>=life){rLife[i]=0;rBuf[o+3]=0;rBuf[o+11]=0;rAlive--;continue;}
  rAge[i]=age;const k=age/life,s=rStyle[i];let w=rW[i],a=rA[i],u0=0,tf=.25,hf=.03;
  if(s===S_BOLT){u0=k*Math.sqrt(k)*.9;a*=1-k*k;w*=1-.35*k;}
  else if(s===S_LANCE){a*=(1-k)*(1-k*.5);w*=1-.55*k;tf=.12;hf=.3;}
  else if(s===S_COLUMN){a*=(1-k)*(1-k);w*=1+.7*k;tf=.6;hf=.04;}
  else{u0=k*.95;a*=1-k;w*=1-.4*k;tf=.3;hf=.06;}
  rBuf[o+3]=w;rBuf[o+11]=a;rBuf[o+12]=u0-tf*(1-k)*.5;rBuf[o+13]=tf;rBuf[o+14]=hf;
 }
 rMesh.userData.ib.needsUpdate=true;
}

/* ---------- ground decals: flat quads on the lane (scorch marks, shock rings, ground flashes, bands across the lane) ---------- */
const DN=46,SCN=14,DS=13,D_DISC=0,D_RING=1,D_SCORCH=2,D_BAND=3;
const dBuf=new Float32Array(DN*DS),dAge=new Float32Array(DN),dLife=new Float32Array(DN),dSx0=new Float32Array(DN),dSx1=new Float32Array(DN),dSz0=new Float32Array(DN),dSz1=new Float32Array(DN),
 dCol=new Float32Array(DN*3),dA=new Float32Array(DN),dBl=new Float32Array(DN),dFin=new Float32Array(DN),dHold=new Float32Array(DN);
let dCur=SCN,sCur=0,dAlive=0;
const dMesh=instanced(dBuf,DS,['aPR','aSz','aCol','aP2'],[4,4,4,1],new THREE.ShaderMaterial(Object.assign({side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
 uniforms:{tScorch:{value:texScorch}},
 vertexShader:`attribute vec4 aPR,aSz,aCol;attribute float aP2;varying vec2 vUv;varying vec4 vCol;varying vec3 vSh;
void main(){vec2 q=position.xy*aSz.xy;float c=cos(aPR.w),s=sin(aPR.w);
 gl_Position=projectionMatrix*viewMatrix*vec4(aPR.x+q.x*c-q.y*s,aPR.y,aPR.z+q.x*s+q.y*c,1.);vUv=uv;vCol=aCol;vSh=vec3(aSz.zw,aP2);}`,
 fragmentShader:`uniform sampler2D tScorch;varying vec2 vUv;varying vec4 vCol;varying vec3 vSh;
void main(){vec2 c=vUv*2.-1.;float r=length(c),sh=vSh.x;
 float disc=max(0.,1.-r);disc*=disc;
 float ring=smoothstep(vSh.z,0.,abs(r-vSh.y))+.07*max(0.,1.-r/vSh.y);
 float sc=texture2D(tScorch,vUv).a;
 float band=smoothstep(1.,.1,abs(c.x))*smoothstep(1.,.78,abs(c.y));
 float m=sh<.5?disc:sh<1.5?ring:sh<2.5?sc:band;gl_FragColor=vCol*m;}`},PREMUL)),10);
// sizes are full widths in world units: sx along the lane (world x), sz across it. bl as for particles. fin/hold = fade-in / hold fractions of life.
function decal(shape,x,z,sx0,sx1,sz0,sz1,rot,life,c,a,bl,fin,hold){
 let i;if(shape===D_SCORCH){i=sCur;sCur=i+1===SCN?0:i+1;}else{i=dCur;dCur=i+1===DN?SCN:i+1;}
 if(dLife[i]<=0)dAlive++;const o=i*DS,i3=i*3;
 dBuf[o]=x;dBuf[o+1]=shape===D_SCORCH?GY-.02:GY;dBuf[o+2]=z;dBuf[o+3]=rot;dBuf[o+6]=shape;dBuf[o+7]=.78;
 dAge[i]=-1;dLife[i]=life;dSx0[i]=sx0;dSx1[i]=sx1;dSz0[i]=sz0;dSz1[i]=sz1;dCol[i3]=c[0];dCol[i3+1]=c[1];dCol[i3+2]=c[2];dA[i]=a;dBl[i]=bl;dFin[i]=fin;dHold[i]=hold;
}
function stepDecals(dt){
 if(!dAlive){dMesh.visible=warm>0;return;}
 dMesh.visible=true;
 for(let i=0;i<DN;i++){
  const life=dLife[i];if(life<=0)continue;
  const o=i*DS;let age=dAge[i];age=age<0?0:age+dt;
  if(age>=life){dLife[i]=0;dBuf[o+4]=0;dBuf[o+5]=0;dAlive--;continue;}
  dAge[i]=age;const k=age/life,e=1-(1-k)*(1-k)*(1-k),fin=dFin[i],hold=dHold[i],i3=i*3;
  let f=1;if(k<fin)f=k/fin;else if(k>hold){f=1-(k-hold)/(1-hold);f*=Math.sqrt(f);}
  const a=dA[i]*f;
  dBuf[o+4]=dSx0[i]+(dSx1[i]-dSx0[i])*e;dBuf[o+5]=dSz0[i]+(dSz1[i]-dSz0[i])*e;
  dBuf[o+8]=dCol[i3]*a;dBuf[o+9]=dCol[i3+1]*a;dBuf[o+10]=dCol[i3+2]*a;dBuf[o+11]=a*dBl[i];dBuf[o+12]=.22*(1-.65*k);   // ring gets thinner as it grows
 }
 dMesh.userData.ib.needsUpdate=true;
}

/* ---------- debris: lit low-poly chunks with gravity (one InstancedMesh) ---------- */
const BN=56;
const bPos=new Float32Array(BN*3),bVel=new Float32Array(BN*3),bRot=new Float32Array(BN*3),bSpin=new Float32Array(BN*3),bScl=new Float32Array(BN*3),bAge=new Float32Array(BN),bLife=new Float32Array(BN),bHot=new Float32Array(BN);
let bCur=0,bAlive=0;
const bMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.55,.75),new THREE.MeshStandardMaterial({flatShading:true,roughness:.8,metalness:.15}),BN);
bMesh.frustumCulled=false;bMesh.matrixAutoUpdate=false;bMesh.raycast=noRay;bMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_c=new THREE.Color(),ZERO=new THREE.Matrix4().makeScale(0,0,0);
for(let i=0;i<BN;i++){bMesh.setMatrixAt(i,ZERO);bMesh.setColorAt(i,_c.setRGB(1,1,1));}
bMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);scene.add(bMesh);
function chunk(x,y,z,vx,vy,vz,size,c,life,hot){
 const i=bCur;bCur=i+1===BN?0:i+1;if(bLife[i]<=0)bAlive++;const i3=i*3;
 bPos[i3]=x;bPos[i3+1]=y;bPos[i3+2]=z;bVel[i3]=vx;bVel[i3+1]=vy;bVel[i3+2]=vz;
 bRot[i3]=rnd()*6.283;bRot[i3+1]=rnd()*6.283;bRot[i3+2]=rnd()*6.283;bSpin[i3]=(rnd()-.5)*18;bSpin[i3+1]=(rnd()-.5)*18;bSpin[i3+2]=(rnd()-.5)*18;
 bScl[i3]=size*(.7+rnd()*.7);bScl[i3+1]=size*(.6+rnd()*.8);bScl[i3+2]=size*(.7+rnd()*.7);bAge[i]=-1;bLife[i]=life;bHot[i]=hot;
 const d=.75+rnd()*.4;bMesh.setColorAt(i,_c.setRGB(c[0]*d,c[1]*d,c[2]*d,THREE.SRGBColorSpace));bMesh.instanceColor.needsUpdate=true;
}
// n chunks thrown out from a point; colour alternates between two triples
function chunks(n,x,y,z,spread,speed,size,cA,cB,hot){
 for(let i=0;i<n;i++){const a=rnd()*6.283,h=speed*(.35+rnd()*.75);
  chunk(x+(rnd()-.5)*spread,y+(rnd()-.3)*spread*.6,z+(rnd()-.5)*spread,Math.cos(a)*h,speed*(.55+rnd()*.9),Math.sin(a)*h,size*(.7+rnd()*.6),i&1?cB:cA,1.5+rnd()*1.1,hot&&i%3===0?.5:0);}
}
function stepDebris(dt){
 if(!bAlive){bMesh.visible=warm>0;return;}
 bMesh.visible=true;
 for(let i=0;i<BN;i++){
  const life=bLife[i];if(life<=0)continue;
  let age=bAge[i];age=age<0?0:age+dt;
  if(age>=life){bLife[i]=0;bMesh.setMatrixAt(i,ZERO);bAlive--;continue;}
  bAge[i]=age;const i3=i*3;
  let vx=bVel[i3],vy=bVel[i3+1]-30*dt,vz=bVel[i3+2];
  let x=bPos[i3]+vx*dt,y=bPos[i3+1]+vy*dt;const z=bPos[i3+2]+vz*dt,floor=GY-.12+bScl[i3+1]*.3;
  if(y<floor&&vy<0){y=floor;vy=vy<-3?-vy*.34:0;vx*=.55;vz*=.55;bSpin[i3]*=.4;bSpin[i3+1]*=.4;bSpin[i3+2]*=.4;}
  bVel[i3]=vx;bVel[i3+1]=vy;bVel[i3+2]=vz;bPos[i3]=x;bPos[i3+1]=y;bPos[i3+2]=z;
  bRot[i3]+=bSpin[i3]*dt;bRot[i3+1]+=bSpin[i3+1]*dt;bRot[i3+2]+=bSpin[i3+2]*dt;
  // burning chunks leave a short trail of embers
  if(bHot[i]>0&&Q>0){bHot[i]-=dt;if(rnd()<dt*34)emit(P.ember,x,y,z,(rnd()-.5)*.8,.6+rnd(),(rnd()-.5)*.8,.9);}
  const left=life-age,sh=left<.35?left/.35:1;   // shrink away at the end instead of popping
  _m.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(bRot[i3],bRot[i3+1],bRot[i3+2])),_s.set(bScl[i3]*sh,bScl[i3+1]*sh,bScl[i3+2]*sh));bMesh.setMatrixAt(i,_m);
 }
 bMesh.instanceMatrix.needsUpdate=true;
}

/* ---------- overload shockwave: two arches racing along the lane plus the hot lane surface between them (one mesh) ---------- */
const WAVE_H=2.1,wave=(()=>{
 const NS=16,NR=5,GR=8,vp=[],idx=[];
 const grid=(dir,kind,rows)=>{const base=vp.length/4;for(let r=0;r<=rows;r++)for(let s=0;s<=NS;s++)vp.push(dir,s/NS,r/rows,kind);
  for(let r=0;r<rows;r++)for(let s=0;s<NS;s++){const a=base+r*(NS+1)+s,b=a+1,c=a+NS+1,d=c+1;idx.push(a,c,b,b,c,d);}};
 for(const dir of [-1,1]){grid(dir,1,NR);grid(dir,0,GR);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vp.length/4*3),3));g.setAttribute('aP',new THREE.BufferAttribute(new Float32Array(vp),4));g.setIndex(idx);
 const m=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{uO:{value:new THREE.Vector3()},uF:{value:0},uTrail:{value:3.2},uHW:{value:A.laneW/2-.08},uH:{value:WAVE_H},uA:{value:0},uG:{value:0},uT:{value:0},
   uC0:{value:new THREE.Vector3(1,.86,.5)},uC1:{value:new THREE.Vector3(1,.5,.13)}},
  // aP = (direction along the lane, position across it 0..1, 0 front .. 1 tail, 1 arch / 0 ground strip)
  vertexShader:`attribute vec4 aP;uniform vec3 uO;uniform float uF,uTrail,uHW,uH;varying vec3 vK;
void main(){float s=aP.y,v=aP.z;vec3 p;
 if(aP.w>.5){float a=s*3.14159265,sn=sin(a);p=vec3(uO.x+aP.x*max(uF-(v-.16)*uTrail*(.55+.75*sn),0.),uO.y+pow(sn,.6)*uH*(1.-.5*v),uO.z-cos(a)*uHW);}
 else p=vec3(uO.x+aP.x*uF*(1.-v),uO.y,uO.z+(s*2.-1.)*uHW);
 vK=vec3(s,v,aP.w);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
  fragmentShader:`uniform vec3 uC0,uC1;uniform float uA,uG,uF,uT;varying vec3 vK;
void main(){float s=vK.x,v=vK.y,a;vec3 c;
 if(vK.z>.5){float d=v-.16,lead=d<0.?smoothstep(-.16,0.,d):exp(-d*7.),body=d>0.?(1.-v)*(1.-v)*.6:0.;   // soft glow ahead of the front, hot line, fading wake
  a=(lead+body)*uA;c=mix(uC1,uC0,lead)*a+vec3(1.,.95,.85)*lead*lead*lead*uA*.8;}
 else{float edge=smoothstep(0.,.06,s)*smoothstep(1.,.94,s),front=exp(-v*6.),scan=.84+.16*sin(v*uF*5.-uT*34.);
  float rail=smoothstep(.05,.015,abs(s-.05))+smoothstep(.05,.015,abs(s-.95));                              // bright rails along the lane edges
  a=((front*.95+.3)*scan+rail*(.35+front))*edge*uG;c=mix(uC1,uC0,front)*a;}
 gl_FragColor=vec4(c,1.);}`}));
 m.frustumCulled=false;m.matrixAutoUpdate=false;m.raycast=noRay;m.renderOrder=11;scene.add(m);return m;
})();
const wU=wave.material.uniforms,waveTime=r=>.24+r*.006;   // seconds the front needs to cover the range
let wOn=false,wT=0,wR=0,wDur=.3,wX=0,wZ=0,wAcc=0,wEnd=false;

/* ---------- two pooled point lights, reused for the brightest current effects ---------- */
const lights=[0,1].map(()=>{const l=new THREE.PointLight(0xffffff,0,48,1.7);l.position.set(0,6,0);scene.add(l);return l;});
const lI=new Float32Array(2),lTau=new Float32Array(2);
function light(x,y,z,c,intensity,tau){
 if(!(x===x&&y===y&&z===z&&intensity>0))return;   // a light at NaN would black out every lit surface
 const i=lI[0]<=lI[1]?0:1;if(lI[i]>intensity)return;   // never steal a light from a brighter effect
 lI[i]=intensity;lTau[i]=tau;const l=lights[i];l.position.set(x,y,z);l.color.setRGB(c[0],c[1],c[2],THREE.SRGBColorSpace);l.intensity=intensity;
}
function stepLights(dt){
 for(let i=0;i<2;i++){if(lI[i]<=0)continue;let v=lI[i]*Math.exp(-dt/lTau[i]);if(v<.4)v=0;lI[i]=v;lights[i].intensity=v;}
}

/* ---------- delayed steps (multi-stage blasts) and short emitters (smoke columns, victory motes) ---------- */
const TN=40,K_POP=1,K_BOSS=2,K_FAC=3,K_ZAP=4,K_ARRIVE=5,K_HUBTOP=6;
const tK=new Uint8Array(TN),tT=new Float32Array(TN),tX=new Float32Array(TN),tY=new Float32Array(TN),tZ=new Float32Array(TN),tS=new Float32Array(TN),tRef=new Array(TN).fill(null);
function after(t,k,x,y,z,s,ref){
 let j=-1,low=-1;for(let i=0;i<TN;i++){const q=tK[i];if(!q){j=i;break;}if(q===K_ZAP||q===K_POP)low=i;}
 if(j<0){if(k===K_ZAP||k===K_POP||k===K_ARRIVE||low<0)return;j=low;}   // table full: a big blast may take the place of a small pop, never the other way round
 tK[j]=k;tT[j]=t;tX[j]=x;tY[j]=y;tZ[j]=z;tS[j]=s;tRef[j]=ref||null;
}
const EN=6,E_SMOKE=1,E_MOTES=2;
const eK=new Uint8Array(EN),eT=new Float32Array(EN),eDur=new Float32Array(EN),eAcc=new Float32Array(EN),eX=new Float32Array(EN),eY=new Float32Array(EN),eZ=new Float32Array(EN),eS=new Float32Array(EN);
let eCur=0;
function emitter(k,x,y,z,s,dur){const i=eCur;eCur=(i+1)%EN;eK[i]=k;eT[i]=0;eDur[i]=dur;eAcc[i]=0;eX[i]=x;eY[i]=y;eZ[i]=z;eS[i]=s;}
function stepEmitters(dt){
 for(let i=0;i<EN;i++){
  const k=eK[i];if(!k)continue;
  const t=eT[i]+=dt;if(t>=eDur[i]){eK[i]=0;continue;}
  const left=1-t/eDur[i],x=eX[i],y=eY[i],z=eZ[i],s=eS[i];
  let n=eAcc[i]+dt*(k===E_SMOKE?24*(.3+.7*left):26)*(Q?1:.5);const m=Math.min(6,n|0);eAcc[i]=n-(n|0);
  if(k===E_MOTES&&(eS[i]-=dt)<=0){
   // a slow signal ring and a soft beam from the top of the tower, repeating while the motes rise
   eS[i]=1.7;decal(D_RING,x,z,3,20,3,20,0,1.7,C.teal,.45,0,0,.15);ribbon(S_COLUMN,x,27,z,x,10.5,z,2.4,1.7,C.tealHot,.5,.6);
  }
  for(let j=0;j<m;j++){
   if(k===E_SMOKE){
    emit(P.black,x+(rnd()-.5)*1.8*s,y+rnd()*.6,z+(rnd()-.5)*1.8*s,-1.1+(rnd()-.5),3+rnd()*2.4,.3+(rnd()-.5),s);
    if(left>.45&&rnd()<.6)emit(P.fire,x+(rnd()-.5)*2.4*s,y-.3+rnd()*.5,z+(rnd()-.5)*2.4*s,(rnd()-.5)*1.5,2.5+rnd()*3,(rnd()-.5)*1.5,.9*s);
   }else{
    // calm motes rising around the relay tower
    const a=rnd()*6.283,r=2.7+rnd()*2.6,c=j%3===0?C.amber:j%3===1?C.teal:C.cream;
    emit(P.mote,x+Math.cos(a)*r,y+.4+rnd()*8,z+Math.sin(a)*r,(rnd()-.5)*.3,.7+rnd()*1.3,(rnd()-.5)*.3,1,c);
   }
  }
 }
}

/* ---------- effect recipes ---------- */
const vS=new THREE.Vector3(),vE=new THREE.Vector3(),vT=new THREE.Vector3();
// a point d units from (x,z) towards the camera on the ground plane, so blasts are not buried inside a building
function towardCam(x,z,d,out){const cx=L.camPos.x-x,cz=L.camPos.z-z,l=Math.hypot(cx,cz)||1;out.x=x+cx/l*d;out.z=z+cz/l*d;return out;}
// the core recipe of every explosion: flash, fireball, sparks, smoke, shock ring, ground flash, scorch, light
function blast(x,y,z,s,red,ground){
 const f0=red?C.red0:C.fire0,f1=red?C.red1:C.fire1;let n;
 // smoke goes first: instances are drawn in pool order, so the fire is added on top of it instead of being greyed out
 if(Q>0||s>1.1){n=cnt(1+2.2*s);for(let i=0;i<n;i++)emit(P.smoke,x+(rnd()-.5)*s,y+(rnd()-.2)*.8*s,z+(rnd()-.5)*s,-.5+(rnd()-.5)*1.4,1.1+rnd()*1.8,(rnd()-.5)*1.4,s);}
 emit(P.halo,x,y,z,0,0,0,7.5*s,f0,f1);                                                   // wide soft bloom
 emit(P.flash,x,y,z,0,0,0,3.4*s,C.hot,f0);
 for(let i=0;i<2;i++)emit(P.fire,x,y,z,(rnd()-.5)*s,.8+rnd()*s,(rnd()-.5)*s,1.7*s,C.hot,f1);   // core that lingers
 n=cnt(4+6*s);
 for(let i=0;i<n;i++){const a=rnd()*6.283,u=rnd()*1.2-.2,h=Math.sqrt(Math.max(0,1-u*u*.6)),sp=(1.5+rnd()*4.5)*s;
  emit(P.fire,x+Math.cos(a)*h*.35*s,y+u*.3*s,z+Math.sin(a)*h*.35*s,Math.cos(a)*h*sp,u*sp+1.2,Math.sin(a)*h*sp,s,f0,f1);}
 n=cnt(5+8*s);
 for(let i=0;i<n;i++){const a=rnd()*6.283,u=rnd()*1.1-.1,h=Math.sqrt(Math.max(0,1-u*u*.7)),sp=(6+rnd()*12)*(.6+.4*s);
  emit(P.spark,x,y,z,Math.cos(a)*h*sp,u*sp+2,Math.sin(a)*h*sp,.8+.25*s);}
 if(ground){
  decal(D_RING,x,z,1.6*s,7.2*s,1.6*s,7.2*s,0,.34,f0,.85,0,0,.2);
  decal(D_DISC,x,z,5.5*s,7.5*s,5.5*s,7.5*s,0,.3,red?C.red0:C.ember,.75,0,0,.1);
  const sc=(2.7+rnd()*.8)*s;decal(D_SCORCH,x,z,sc,sc,sc,sc,rnd()*6.283,Q?9:5,C.scorch,.66,1,.02,.55);
 }
 light(x,y+1.2,z,f0,26*s*s+10,.13+.05*s);
}
// small secondary pop used by the multi-stage blasts
function pop(x,y,z,s,red){
 const f0=red?C.red0:C.fire0,f1=red?C.red1:C.fire1;
 emit(P.flash,x,y,z,0,0,0,2.2*s,C.hot,f0);
 let n=cnt(3+2*s);for(let i=0;i<n;i++){const a=rnd()*6.283,sp=(1+rnd()*3)*s;emit(P.fire,x,y,z,Math.cos(a)*sp,(rnd()-.2)*sp+1,Math.sin(a)*sp,.8*s,f0,f1);}
 n=cnt(4+3*s);for(let i=0;i<n;i++){const a=rnd()*6.283,sp=5+rnd()*9;emit(P.spark,x,y,z,Math.cos(a)*sp,rnd()*sp,Math.sin(a)*sp,.85);}
 light(x,y+1,z,f0,22*s*s,.12);
}
function impact(x,y,z,dx,dy,dz,c,s){
 emit(P.flash,x,y,z,0,0,0,1.25*s,C.hot,c);
 const n=cnt(3);for(let i=0;i<n;i++){const sp=4+rnd()*8;emit(P.spark,x,y,z,-dx*sp+(rnd()-.5)*7,-dy*sp+2+rnd()*5,-dz*sp+(rnd()-.5)*7,.75,C.hot,c);}
}
const KILL_S={runner:.62,grunt:.9,brute:1.28,boss:1.45},MUZZLE=3.19;   // MUZZLE: distance from ctx.turretPos to the muzzle of the turret model (base.js)
function kill(e){
 ctx.enemyPos(e,vE);const d=ENEMY[e.type]||ENEMY.grunt,x=vE.x,y=vE.y,z=vE.z,s=KILL_S[e.type]||.9,col=ENEMY_COL[e.type]||ENEMY_COL.grunt;
 blast(x,y,z,s,false,true);
 chunks(cnt(2+s*4.5),x,y,z,d.r,6+s*3,.3+.16*s,col,C.dark,s>1.2);
 if(e.type==='boss'){
  // stage 1 now, a string of pops across the hull, then the big one
  ctx.shake(.28);
  for(let i=0;i<5;i++)after(.07+i*.085,K_POP,x+(rnd()-.5)*d.r*1.7,y+(rnd()-.35)*d.h*.6,z+(rnd()-.5)*d.r*1.7,.75+rnd()*.4);
  after(.5,K_BOSS,x,y,z,2.4);
 }
}
function bossFinal(x,y,z,s){
 let n=cnt(5);for(let i=0;i<n;i++)emit(P.black,x+(rnd()-.5)*3,y+rnd()*2,z+(rnd()-.5)*3,-.5+(rnd()-.5),1.6+rnd()*2,(rnd()-.5),1.1);
 blast(x,y,z,s,false,true);
 decal(D_RING,x,z,3,22,3,22,0,.5,C.fire0,.55,0,0,.15);
 n=cnt(12);for(let i=0;i<n;i++){const a=rnd()*6.283,r=rnd()*1.6;emit(P.fire,x+Math.cos(a)*r,y+rnd()*1.5,z+Math.sin(a)*r,Math.cos(a)*2,7+rnd()*9,Math.sin(a)*2,1.7);}   // rising fire column
 n=cnt(14);for(let i=0;i<n;i++){const a=rnd()*6.283,sp=2+rnd()*5;emit(P.ember,x,y+1,z,Math.cos(a)*sp,2+rnd()*6,Math.sin(a)*sp,1.3);}
 chunks(cnt(16),x,y+.5,z,3,13,.62,ENEMY_COL.boss,C.dark,true);
 light(x,y+2.5,z,C.fire0,420,.3);ctx.shake(.8);
}
function facilityBlast(lane,x,z){
 towardCam(x,z,3.6,vT);const fx=vT.x,fz=vT.z,acc=LANE_COL[lane]||C.amber;
 blast(fx,3,fz,2.2,true,false);
 decal(D_RING,x,z,6,26,6,26,0,.55,C.red0,.8,0,0,.15);decal(D_DISC,x,z,14,20,14,20,0,.5,C.red0,.6,0,0,.1);
 let n=cnt(12);for(let i=0;i<n;i++){const a=rnd()*6.283,r=rnd()*2.6;emit(P.fire,x+Math.cos(a)*r,5.6+rnd(),z+Math.sin(a)*r,Math.cos(a)*2.5,5+rnd()*8,Math.sin(a)*2.5,1.9,C.red0,C.red1);}   // fire through the roof
 n=cnt(12);for(let i=0;i<n;i++){const a=rnd()*6.283,sp=3+rnd()*6;emit(P.ember,x,6,z,Math.cos(a)*sp,3+rnd()*7,Math.sin(a)*sp,1.3);}
 chunks(cnt(8),fx,4.5,fz,3,12,.6,C.cream,C.steel,true);chunks(cnt(6),x,6.2,z,3,11,.55,acc,C.stoneDark,true);
 for(let i=0;i<4;i++){towardCam(x+(rnd()-.5)*5,z+(rnd()-.5)*5,3.2,vT);after(.14+i*.13,K_POP,vT.x,2+rnd()*4,vT.z,1+rnd()*.5);}
 emitter(E_SMOKE,x,6,z,1.25,Q?5.5:3.5);
 light(fx,6.5,fz,C.red0,460,.34);ctx.shake(.9);
}
function hubBlast(){
 const x=A.hubX;towardCam(x,0,3,vT);
 blast(vT.x,4.5,vT.z,2.3,true,false);
 decal(D_RING,x,0,5,26,5,26,0,.6,C.red0,.8,0,0,.15);decal(D_DISC,x,0,12,18,12,18,0,.5,C.red0,.6,0,0,.1);
 chunks(cnt(14),vT.x,6,vT.z,3,12,.6,C.cream,C.steel,true);
 for(let i=0;i<5;i++){towardCam(x+(rnd()-.5)*2,(rnd()-.5)*2,2.6,vT);after(.12+i*.12,K_POP,vT.x,2.5+i*1.9,vT.z,1.1+rnd()*.4);}
 after(.75,K_HUBTOP,x,10.5,0,2);
 emitter(E_SMOKE,x,9,0,1.3,6);
 light(vT.x,7,vT.z,C.red0,460,.4);ctx.shake(.8);
}

/* ---------- event handlers ---------- */
// events come from the game untouched: anything that is not a lane or a number is ignored instead of becoming NaN in a buffer or a light
const isLane=l=>l===0||l===1,okEnemy=e=>!!e&&isLane(e.lane)&&e.y===e.y;
function onHit(ev){
 const e=ev.e,src=ev.src;if(!okEnemy(e))return;
 const d=ENEMY[e.type]||ENEMY.grunt;ctx.enemyPos(e,vE);
 if(src==='pulse'){
  // the surge reaches each enemy when the shockwave front does
  if(!ev.kill){const R=Math.min(60,Math.max(1,ctx.G.effects.pulseRange*U||0)),f=Math.min(1,Math.abs(vE.x-A.droneX)/R);after((1-Math.pow(1-f,1/2.2))*waveTime(R),K_ZAP,0,0,0,1,e);}
 }else{
  let c=C.amber,style=S_BOLT,w=1.25,life=.15,hot=1,alpha=1;
  if(src==='turret')ctx.turretPos(e.lane,vS);
  else if(src==='drone'){ctx.dronePos(vS);c=C.teal;w=1.05;life=.13;}
  else if(src==='echo'){vS.set(A.droneX,A.droneH,L.laneZ[e.lane]);c=C.ghost;w=1.2;life=.19;hot=.45;alpha=.62;}
  else if(src==='pierce'&&ev.sy===ev.sy){vS.set(ctx.wx(ev.sy),d.cy,L.laneZ[e.lane]);c=C.lance;style=S_LANCE;w=.95;life=.24;hot=1.6;}
  else{if(ev.kill)kill(e);return;}   // unknown source: no tracer
  let dx=vE.x-vS.x,dy=vE.y-vS.y,dz=vE.z-vS.z;const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;
  // stop at the hull on the side of the shooter, nudged towards the camera so the flash is not buried in the model
  const hr=Math.min(d.r*.7,l*.5);let hx=vE.x-dx*hr,hy=vE.y-dy*hr,hz=vE.z-dz*hr;
  vT.copy(L.camPos).sub(vE).normalize();hx+=vT.x*d.r*.45;hy+=vT.y*d.r*.45;hz+=vT.z*d.r*.45;
  // base.js draws the muzzle flash; the tracer only has to leave from the muzzle (never from behind the hull it hits)
  if(src==='turret'){const mz=Math.max(0,Math.min(MUZZLE,l-hr-.4));vS.x+=dx*mz;vS.y+=dy*mz;vS.z+=dz*mz;}
  else if(src==='echo')emit(P.glow,vS.x,vS.y,vS.z,0,0,0,2.2,c);
  if(style===S_LANCE){
   // the lance carries on through the second target
   ribbon(style,vS.x,vS.y,vS.z,vE.x+dx*3.2,vE.y+dy*3.2,vE.z+dz*3.2,w,life,c,hot,alpha);
   ribbon(S_LANCE,vS.x,vS.y,vS.z,vE.x+dx*3.2,vE.y+dy*3.2,vE.z+dz*3.2,1.5,.14,C.amber,0,.5);
  }else ribbon(style,vS.x,vS.y,vS.z,hx,hy,hz,w,life,c,hot,alpha);
  if(!ev.kill)impact(hx,hy,hz,dx,dy,dz,c,src==='echo'?.8:1);
 }
 if(ev.kill)kill(e);
}
function onPulse(ev){
 if(!isLane(ev.lane))return;
 const z=L.laneZ[ev.lane],x=A.droneX,y=A.droneH,range=ev.range>0?ev.range:ctx.G.effects.pulseRange;
 wOn=true;wT=-1;wR=Math.min(60,Math.max(1,range*U||0));wDur=waveTime(wR);wX=x;wZ=z;wAcc=0;wEnd=false;wU.uO.value.set(x,GY+.02,z);
 ribbon(S_COLUMN,x,y+8,z,x,GY,z,4.2,.26,C.amber,1.3,1.25);          // vertical flash through the drone
 emit(P.flash,x,y,z,0,0,0,5.2,C.white,C.amber);emit(P.glow,x,y,z,0,0,0,7,C.amber);
 decal(D_RING,x,z,2,A.laneW*1.25,2,A.laneW*1.25,0,.36,C.amberHot,.9,0,0,.2);
 decal(D_DISC,x,z,9,13,9,13,0,.42,C.amber,.85,0,0,.15);              // hot ground under the drone
 const n=cnt(18);for(let i=0;i<n;i++){const sg=i&1?1:-1,sp=10+rnd()*26;emit(P.zip,x,y-.4,z+(rnd()-.5)*2,sg*sp,-4+rnd()*8,(rnd()-.5)*7,1,C.hot,C.amber);}
 light(x,2.6,z,C.amber,330,.2);ctx.shake(.42);
}
function onLeak(ev){
 if(!isLane(ev.lane))return;
 const z=L.laneZ[ev.lane],s=ev.type==='boss'?1.8:ev.type==='brute'?1.45:ev.type==='runner'?1:1.2,x=.5,y=1.2;
 blast(x,y,z,s,true,true);
 decal(D_BAND,0,z,2.2,4.4,A.laneW+1,A.laneW+1.6,0,.5,C.red0,.95,0,0,.15);   // the leak line flares
 let n=cnt(8+6*s);for(let i=0;i<n;i++)emit(P.spark,x,y,z+(rnd()-.5)*5,-(5+rnd()*15),2+rnd()*9,(rnd()-.5)*8,1,C.hot,C.red0);   // momentum carries on into the base
 n=cnt(4);for(let i=0;i<n;i++)emit(P.fire,x-.5,y,z+(rnd()-.5)*4,-(3+rnd()*6),1+rnd()*3,(rnd()-.5)*2,1.1*s,C.red0,C.red1);
 chunks(cnt(3+2*s),x,y,z,2,7,.34,ENEMY_COL[ev.type]||ENEMY_COL.grunt,C.dark,false);
 light(x,2.5,z,C.red0,90*s,.22);ctx.shake(.4);
 if(ev.down)after(.18,K_FAC,A.facX,0,z,ev.lane);
}
function onMove(ev){
 if(!isLane(ev.from)||!isLane(ev.to)||ev.from===ev.to)return;
 const z0=L.laneZ[ev.from],z1=L.laneZ[ev.to],x=A.droneX,y=A.droneH,sg=z1>z0?1:-1;
 ribbon(S_STREAK,x,y,z0,x,y,z1,2.1,.36,C.teal,1,1);
 emit(P.glow,x,y,z0,0,0,0,3,C.tealHot,C.teal);
 let n=cnt(8);for(let i=0;i<n;i++)emit(P.zip,x+(rnd()-.5)*.8,y+(rnd()-.5)*.6,z0,(rnd()-.5)*6,(rnd()-.4)*5,-sg*(4+rnd()*10),1,C.tealHot,C.teal);   // thruster kick
 n=cnt(3);for(let i=0;i<n;i++)emit(P.dust,x+(rnd()-.5),y-.2,z0-sg*rnd(),(rnd()-.5)*2,.5+rnd(),-sg*(2+rnd()*3),.8,C.cream,C.steel);
 after(.3,K_ARRIVE,x,y,z1,1);
 light(x,y,z0+sg*2,C.teal,46,.16);
 if(ev.rubble){
  // dust and debris dropped onto the lane the drone just left, rolling out along it both ways
  const reach=Math.min(A.droneX-1,A.spawnX-A.droneX)*2;
  decal(D_BAND,x,z0,6,reach,A.laneW*.94,A.laneW*.94,0,1.5,C.rub0,.5,.45,.05,.25);
  decal(D_RING,x,z0,2,A.laneW*1.1,2,A.laneW*1.1,0,.4,C.rub0,.8,.3,0,.2);
  n=cnt(30);for(let i=0;i<n;i++){const d=i&1?1:-1,sp=4+rnd()*46;emit(P.rubble,x+d*rnd()*1.5,GY+.5+rnd()*.7,z0+(rnd()-.5)*6.4,d*sp,.3+rnd()*1.6,(rnd()-.5)*1.4,1+rnd()*.5);}
  n=cnt(5);for(let i=0;i<n;i++)emit(P.rubble,x+(rnd()-.5)*2,y-.5-rnd()*2,z0+(rnd()-.5)*2,(rnd()-.5)*3,-5-rnd()*4,(rnd()-.5)*3,1.1);
  n=cnt(16);for(let i=0;i<n;i++)chunk(x+(rnd()-.5)*2,y-.6-rnd(),z0+(rnd()-.5)*4.5,(rnd()-.5)*36,-3+rnd()*5,(rnd()-.5)*5,.34+rnd()*.4,i&1?C.rock:C.stone,1.8+rnd()*1.2,0);
 }
}
function onSpawn(ev){
 const e=ev.e;if(!okEnemy(e))return;
 const d=ENEMY[e.type]||ENEMY.grunt;ctx.enemyPos(e,vE);
 emit(P.glow,vE.x,vE.y,vE.z,0,0,0,d.r*2.6,C.eye);
 decal(D_DISC,vE.x,vE.z,d.r*3,d.r*5,d.r*3,d.r*5,0,.45,C.eye,.5,0,0,.1);
 const n=cnt(2+d.r*1.6);for(let i=0;i<n;i++)emit(P.dust,vE.x+rnd()*1.4,GY+.4+rnd()*.4,vE.z+(rnd()-.5)*d.r*2,1.5+rnd()*4,.5+rnd()*1.3,(rnd()-.5)*2.4,.55+d.r*.28);
 if(e.type==='boss'){decal(D_RING,vE.x,vE.z,2,11,2,11,0,.5,C.eye,.7,0,0,.2);light(vE.x,3,vE.z,C.eye,120,.3);}
}
function onWave(){
 for(let lane=0;lane<2;lane++){const z=L.laneZ[lane],x=A.spawnX;
  ribbon(S_COLUMN,x,8,z,x,GY,z,2.6,.55,C.eye,.6,.9);
  decal(D_BAND,x,z,3,8,A.laneW,A.laneW,0,.6,C.eye,.8,0,0,.2);decal(D_RING,x,z,2,10,2,10,0,.5,C.eye,.7,0,0,.2);
  emit(P.glow,x,1.5,z,0,0,0,5,C.eye);
  lI[lane]=0;light(x,3,z,C.eye,150,.3);
 }
}
function onFinish(ev){
 if(ev.victory){
  emitter(E_MOTES,A.hubX,0,0,0,10);
  light(A.hubX,8,0,C.cream,90,1.1);
 }else hubBlast();
}
function fire(k,i,ref){
 const x=tX[i],y=tY[i],z=tZ[i],s=tS[i];
 if(k===K_POP)pop(x,y,z,s,false);
 else if(k===K_BOSS)bossFinal(x,y,z,s);
 else if(k===K_FAC)facilityBlast(s|0,x,z);
 else if(k===K_HUBTOP){blast(x,y,z,s,true,false);chunks(cnt(8),x,y,z,2,10,.5,C.steel,C.cream,true);ctx.shake(.5);}
 else if(k===K_ARRIVE){emit(P.glow,x,y,z,0,0,0,2.4,C.teal);decal(D_RING,x,z,1.5,5,1.5,5,0,.3,C.teal,.45,0,0,.2);}
 else if(k===K_ZAP&&ref&&ref.hp>0&&okEnemy(ref)){
  // an enemy caught by the overload: a bolt strikes its top, sparks fly and a ring marks its feet (all kept outside the hull so the model does not hide them)
  const d=ENEMY[ref.type]||ENEMY.grunt;ctx.enemyPos(ref,vE);const top=d.h+.15;
  ribbon(S_COLUMN,vE.x,top+3.6,vE.z,vE.x,top,vE.z,1.4,.2,C.amber,1.2,1);
  emit(P.flash,vE.x,top,vE.z,0,0,0,d.r*2.3,C.hot,C.amber);
  decal(D_RING,vE.x,vE.z,d.r*2,d.r*4.4,d.r*2,d.r*4.4,0,.3,C.amberHot,.8,0,0,.2);
  const n=cnt(5);for(let j=0;j<n;j++)emit(P.zip,vE.x,top,vE.z,(rnd()-.5)*12,2+rnd()*8,(rnd()-.5)*12,.9,C.hot,C.amber);
 }
}
function stepTimers(dt){
 for(let i=0;i<TN;i++){const k=tK[i];if(!k)continue;if((tT[i]-=dt)<=0){tK[i]=0;const ref=tRef[i];tRef[i]=null;fire(k,i,ref);}}
}
function stepWave(dt,t){
 if(!wOn){wave.visible=warm>0;return;}
 wave.visible=true;wT=wT<0?0:wT+dt;
 const k=wT/wDur,f=k>=1?1:1-Math.pow(1-k,2.2),front=wR*f;
 wU.uF.value=front;wU.uT.value=t;wU.uTrail.value=Math.min(3.4,front*.6+.4);
 wU.uA.value=k<1?1:Math.max(0,1-(wT-wDur)/.2);wU.uG.value=Math.exp(-wT*3.4)*(wT>.75?Math.max(0,1-(wT-.75)/.2):1);
 if(k<1){
  // sparks kicked up where the two fronts are
  let n=wAcc+dt*(Q?70:35);const m=Math.min(8,n|0);wAcc=n-(n|0);
  for(let j=0;j<m;j++){const sg=j&1?1:-1;emit(P.zip,wX+sg*front,GY+.2+rnd()*.8,wZ+(rnd()-.5)*A.laneW*.9,sg*(5+rnd()*9),3+rnd()*7,(rnd()-.5)*3,.9,C.hot,C.amber);}
 }else if(!wEnd){
  // the wave stops at the edge of its range: mark both limits with a line across the lane
  wEnd=true;
  decal(D_BAND,wX+wR,wZ,1.4,2.6,A.laneW,A.laneW,0,.32,C.amberHot,.9,0,0,.1);decal(D_BAND,wX-wR,wZ,1.4,2.6,A.laneW,A.laneW,0,.32,C.amberHot,.9,0,0,.1);
 }
 if(wT>.95){wOn=false;wave.visible=false;}
}
function findSun(o){if(o.isDirectionalLight)vS.copy(o.position).sub(o.target.position);}
// The decals must sit just above the road, whose height belongs to env.js: probe it with a few short rays down onto both lanes.
const ray=new THREE.Raycaster(),hits=[];
function measureGround(){
 let top=-1;
 try{
  scene.updateMatrixWorld();   // env.js has just moved the lanes in its own layout(); the matrices are normally refreshed only by the next render
  ray.camera=ctx.camera;ray.far=1.2;
  for(let lane=0;lane<2;lane++)for(let k=0;k<3;k++){
   ray.ray.origin.set(9+k*14,.62,L.laneZ[lane]+(k-1)*1.5);ray.ray.direction.set(0,-1,0);hits.length=0;ray.intersectObjects(scene.children,true,hits);
   for(let i=0;i<hits.length;i++){const o=hits[i].object;   // nearest opaque surface: skip dust points, glow layers and sprites
    if(o.isMesh&&o.visible&&o.material&&!o.material.transparent){if(hits[i].point.y>top)top=hits[i].point.y;break;}}
  }
  hits.length=0;
 }catch(err){top=-1;}
 GY=top<0?.3:Math.min(.66,top+.07);
}
function clearAll(){
 for(let i=0;i<PN;i++)pBuf[i*PS+3]=0;pLife.fill(0);pAlive=0;pMesh.userData.ib.needsUpdate=true;
 for(let i=0;i<RN;i++){rBuf[i*RS+3]=0;rBuf[i*RS+11]=0;}rLife.fill(0);rAlive=0;rMesh.userData.ib.needsUpdate=true;
 for(let i=0;i<DN;i++){dBuf[i*DS+4]=0;dBuf[i*DS+5]=0;}dLife.fill(0);dAlive=0;dMesh.userData.ib.needsUpdate=true;
 for(let i=0;i<BN;i++)bMesh.setMatrixAt(i,ZERO);bLife.fill(0);bAlive=0;bMesh.instanceMatrix.needsUpdate=true;
 tK.fill(0);tRef.fill(null);eK.fill(0);wOn=false;wU.uA.value=0;wU.uG.value=0;
 for(let i=0;i<2;i++){lI[i]=0;lights[i].intensity=0;}
}

// Last resort (rule: never throw). A failure drops the live effects; repeated failures switch this part off and the game goes on without it.
let errs=0,dead=false;
function fail(err){
 try{console.warn('2.5D fx: effect dropped after an error.',err);}catch(e){}
 try{clearAll();}catch(e){}
 if(++errs>=3){dead=true;pMesh.visible=rMesh.visible=dMesh.visible=bMesh.visible=wave.visible=false;lights[0].intensity=lights[1].intensity=0;}
}

return{
 layout(){
  if(lastMode!==L.mode){if(lastMode)clearAll();lastMode=L.mode;measureGround();}   // lane positions moved: drop effects placed for the old layout
  // where the sun is on screen, for the shading of smoke puffs (env.js owns the light; fall back to a low sun on the enemy side)
  vS.set(.75,.55,-.3);scene.traverse(findSun);
  vS.transformDirection(ctx.camera.matrixWorldInverse);const l=Math.hypot(vS.x,vS.y)||1;pMesh.material.uniforms.uSun.value.set(vS.x/l,vS.y/l);
 },
 quality(q){Q=q;bMesh.castShadow=q>1;},
 event(ev){
  if(dead||!ev)return;
  try{
   switch(ev.t){
    case 'hit':onHit(ev);break;
    case 'pulse':onPulse(ev);break;
    case 'leak':onLeak(ev);break;
    case 'move':onMove(ev);break;
    case 'spawn':onSpawn(ev);break;
    case 'wave':onWave();break;
    case 'stage':clearAll();break;
    case 'finish':onFinish(ev);break;
   }
  }catch(err){fail(err);}
 },
 update(dt,t,G){
  if(dead||!(dt>=0)||(G.paused&&G.phase==='battle'))return;   // paused: the world is frozen, hold every effect where it is
  try{
   stepTimers(dt);stepEmitters(dt);stepWave(dt,t);stepParticles(dt);stepRibbons(dt);stepDecals(dt);stepDebris(dt);stepLights(dt);
   if(warm>0)warm--;   // everything is drawn (empty) for the first frames so shaders and buffers are ready before the first shot
  }catch(err){fail(err);}
 }
};
});})();
