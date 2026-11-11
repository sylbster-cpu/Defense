/* env.js — 전장의 배경과 분위기: 지형·두 전선 도로·돌파구·중앙 분리대·주변 지물·해질녘 조명·안개·먼지·빛줄기 */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('env',ctx=>{
 const {scene,camera,renderer,pal,util}=ctx,{lerp,mat,merge,canvasTex}=util;
 const PI=Math.PI,sm=t=>t*t*(3-2*t),sat=v=>v<0?0:v>1?1:v;

 /* ================= helpers ================= */
 // deterministic random stream (mulberry32) for everything built once
 function RNG(s){let a=(s*2654435761)>>>0||1;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 const hash=(x,y)=>{const h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h);};
 function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=sm(x-xi),yf=sm(y-yi),a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*xf+(c-a)*yf+(a-b-c+d)*xf*yf;}
 const fbm=(x,y)=>vnoise(x,y)*.55+vnoise(x*2.1+7.3,y*2.1+1.7)*.3+vnoise(x*4.3+3.1,y*4.3+9.2)*.15;
 const css=(h,a)=>'rgba('+(h>>16&255)+','+(h>>8&255)+','+(h&255)+','+(a===undefined?1:a)+')';
 const mixHex=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t).getHex();
 // primitive -> part list for util.merge
 const B=(P,w,h,d,x,y,z,c,ry,rx,rz)=>P.push({g:new THREE.BoxGeometry(w,h,d),m:mat(x,y,z,rx||0,ry||0,rz||0),c});
 const CY=(P,rt,rb,h,seg,x,y,z,c,ry,rx,rz)=>P.push({g:new THREE.CylinderGeometry(rt,rb,h,seg),m:mat(x,y,z,rx||0,ry||0,rz||0),c});
 // lumpy boulder: a dodecahedron with every corner pushed in or out
 function rock(P,x,y,z,sx,sy,sz,c,seed){
  const g=new THREE.DodecahedronGeometry(1,0),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const X=p.getX(i),Y=p.getY(i),Z=p.getZ(i),k=.7+.55*hash(seed+Math.round(X*40)+Math.round(Y*90)*3.1,Math.round(Z*50)*1.7+seed*.37);p.setXYZ(i,X*k,Y*k,Z*k);}
  g.computeVertexNormals();
  P.push({g,m:mat(x,y,z,hash(seed,1)*.5,hash(seed,2)*6.28,hash(seed,3)*.5,sx,sy,sz),c});
 }
 // sagging cable made of short straight boxes
 function cable(P,x0,y0,z0,x1,y1,z1,sag,n,th,c){
  let px=x0,py=y0,pz=z0;
  for(let k=1;k<=n;k++){const u=k/n,x=lerp(x0,x1,u),z=lerp(z0,z1,u),y=lerp(y0,y1,u)-sag*4*u*(1-u),dx=x-px,dy=y-py,dz=z-pz,l=Math.hypot(dx,dy,dz);
   P.push({g:new THREE.BoxGeometry(l+.03,th,th),m:mat((x+px)/2,(y+py)/2,(z+pz)/2,0,Math.atan2(-dz,dx),Math.atan2(dy,Math.hypot(dx,dz))),c});px=x;py=y;pz=z;}
 }
 // Per-triangle tone jitter and a darker foot near the ground: a hand-painted low-poly look and fake contact shadow.
 function paintFacets(g,amt,seed,foot){
  const p=g.attributes.position.array,c=g.attributes.color.array,R=RNG(seed);
  for(let i=0;i<p.length;i+=9){const k=1+(R()-.5)*amt;
   for(let j=0;j<9;j+=3){const y=p[i+j+1],f=foot?lerp(.62,1,sat(y/foot)):1;c[i+j]*=k*f;c[i+j+1]*=k*f;c[i+j+2]*=k*f;}}
  return g;
 }
 const stdMat=()=>new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.92,metalness:.04});
 function solid(parts,seed,opt){const o=opt||{},m=new THREE.Mesh(paintFacets(merge(parts),o.jitter===undefined?.16:o.jitter,seed,o.foot===undefined?1.1:o.foot),o.mat||propMat);m.castShadow=o.cast!==false;m.receiveShadow=true;return m;}
 const propMat=stdMat();

 /* ================= light, shadow, fog ================= */
 // Low warm sun from the enemy side (+X), a little towards -Z so faces turned to either camera still catch light.
 const SUN_EL=29*PI/180,SUN_AZ=23*PI/180;
 const sunDir=new THREE.Vector3(Math.cos(SUN_EL)*Math.cos(SUN_AZ),Math.sin(SUN_EL),-Math.cos(SUN_EL)*Math.sin(SUN_AZ));
 const hemi=new THREE.HemisphereLight(0x8cc0cc,0x3b2c22,1.3);
 const sun=new THREE.DirectionalLight(pal.sun,3.5);
 sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.bias=-.00035;sun.shadow.normalBias=.045;
 scene.add(hemi,sun,sun.target);
 // Tight orthographic shadow frustum around a ground box, worked out in light space.
 const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_c=new THREE.Vector3(),_d=new THREE.Vector3();
 function fitShadow(x0,x1,z0,z1,yTop){
  sun.target.position.set((x0+x1)/2,0,(z0+z1)/2);sun.position.copy(sun.target.position).addScaledVector(sunDir,120);
  sun.target.updateMatrixWorld();sun.updateMatrixWorld();
  const ax=_a.set(0,1,0).cross(sunDir).normalize(),ay=_b.copy(sunDir).cross(ax).normalize();
  let l=1e9,r=-1e9,b=1e9,t=-1e9,n=1e9,f=-1e9;
  for(let i=0;i<8;i++){const p=_c.set(i&1?x1:x0,i&2?yTop:0,i&4?z1:z0).sub(sun.position),u=p.dot(ax),v=p.dot(ay),w=-p.dot(sunDir);
   l=Math.min(l,u);r=Math.max(r,u);b=Math.min(b,v);t=Math.max(t,v);n=Math.min(n,w);f=Math.max(f,w);}
  const sc=sun.shadow.camera;sc.left=l-.5;sc.right=r+.5;sc.bottom=b-.5;sc.top=t+.5;sc.near=Math.max(1,n-45);sc.far=f+2;sc.updateProjectionMatrix();
 }
 const FOG_SIDE=mixHex(pal.fog,pal.haze,.2),FOG_BEHIND=mixHex(pal.fog,pal.haze,.42);
 const fog=new THREE.Fog(FOG_SIDE,110,150);scene.fog=fog;scene.background=new THREE.Color(FOG_SIDE);

 /* ================= textures ================= */
 const TILE=26; // world size of one repeat of the dirt texture
 const dirtTex=canvasTex(512,512,(c,W,H)=>{
  // tileable mottling from periodic value noise, drawn small and scaled up
  const n=128,im=c.createImageData(n,n),d=im.data;
  const pn=(x,y,p)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=sm(x-xi),yf=sm(y-yi),h=(a,b)=>hash((a%p+p)%p,(b%p+p)%p+p*7.13),a=h(xi,yi),b=h(xi+1,yi),cc=h(xi,yi+1),dd=h(xi+1,yi+1);return a+(b-a)*xf+(cc-a)*yf+(a-b-cc+dd)*xf*yf;};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=x/n,v=y/n,a=pn(u*4,v*4,4),b=pn(u*9,v*9,9),g=pn(u*40,v*40,40),k=.74+.34*b+.22*(g-.5),i=(y*n+x)*4;
   d[i]=(50+22*a)*k;d[i+1]=(52+15*a)*k;d[i+2]=(54+2*a)*k;d[i+3]=255;}
  const t=document.createElement('canvas');t.width=t.height=n;t.getContext('2d').putImageData(im,0,0);c.drawImage(t,0,0,W,H);
  // details are drawn nine times, shifted by one tile, so everything wraps across the edges
  for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
   c.save();c.translate(ox*W,oy*H);const R=RNG(31);
   for(let i=0;i<16;i++){const x=R()*W,y=R()*H,r=18+R()*44,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(14,18,20,.16)');g.addColorStop(1,'rgba(14,18,20,0)');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
   c.lineCap='round';
   for(let i=0;i<26;i++){const x=R()*W,y=R()*H,l=30+R()*90;c.strokeStyle='rgba(168,150,124,'+(.035+R()*.05)+')';c.lineWidth=3+R()*6;c.beginPath();c.moveTo(x,y);c.lineTo(x+l,y+(R()-.5)*14);c.stroke();}
   for(let i=0;i<18;i++){let x=R()*W,y=R()*H,a=R()*6.28;c.strokeStyle='rgba(10,13,14,'+(.25+R()*.2)+')';c.lineWidth=.7+R()*.8;c.beginPath();c.moveTo(x,y);for(let k=0,m=3+(R()*5|0);k<m;k++){a+=(R()-.5)*1.5;const l=6+R()*16;x+=Math.cos(a)*l;y+=Math.sin(a)*l;c.lineTo(x,y);}c.stroke();}
   for(let i=0;i<900;i++){c.fillStyle=R()>.4?'rgba(8,10,10,.22)':'rgba(190,176,150,.14)';c.fillRect(R()*W,R()*H,1+R(),1+R());}
   for(let i=0;i<420;i++){const x=R()*W,y=R()*H,r=.8+R()*R()*3.6,sh=72+R()*40|0;
    c.fillStyle='rgba(6,8,9,.4)';c.beginPath();c.ellipse(x-r*.6,y-r*.25,r*1.1,r*.8,0,0,6.3);c.fill();
    c.fillStyle='rgba('+sh+','+(sh-8)+','+(sh-22)+',.85)';c.beginPath();c.ellipse(x,y,r,r*(.6+R()*.4),R()*3,0,6.3);c.fill();}
   c.restore();}
 },{repeat:[1,1]});

 // One painted strip per lane: x from RX0 to RX1, RHW to either side of the lane centre. Drawn in world units.
 // Half size when the game starts at the lowest quality (a phone screen does not resolve more).
 const RX0=-15.5,RX1=60.5,RHW=4.4,ROADW=ctx.quality>0?2048:1024;
 function roadTex(lane){
  const acc=lane?pal.teal:pal.amber;
  return canvasTex(ROADW,ROADW/8,(c,W,H)=>{
   const R=RNG(lane*91+7),sx=W/(RX1-RX0),sz=H/(2*RHW),px=W/2048;
   c.fillStyle='#4b585c';c.fillRect(0,0,W,H);
   for(let i=0;i<7000;i++){const s=(1+R()*2.4)*px;c.fillStyle=R()>.5?'rgba(255,255,255,'+(.015+.05*R())+')':'rgba(0,0,0,'+(.04+.1*R())+')';c.fillRect(R()*W,R()*H,s,s);}
   c.setTransform(sx,0,0,sz,-RX0*sx,RHW*sz);
   const blot=(x,z,r,rgb,a)=>{const g=c.createRadialGradient(x,z,0,x,z,r);g.addColorStop(0,'rgba('+rgb+','+a+')');g.addColorStop(1,'rgba('+rgb+',0)');c.fillStyle=g;c.fillRect(x-r,z-r,2*r,2*r);};
   // forecourt of the facility: paler slabs
   c.fillStyle='rgba(126,134,128,.2)';c.fillRect(RX0,-RHW,-1-RX0,2*RHW);
   for(let i=0;i<46;i++)blot(lerp(RX0,RX1,R()),lerp(-RHW,RHW,R()),1+R()*3.2,R()>.45?'16,22,24':'150,150,132',R()>.45?.15:.06);   // faint: the lane stays the most even surface on screen
   // paler wheel paths
   for(const z of [-1.75,1.75]){const g=c.createLinearGradient(0,z-1.2,0,z+1.2);g.addColorStop(0,'rgba(156,156,142,0)');g.addColorStop(.5,'rgba(156,156,142,.11)');g.addColorStop(1,'rgba(156,156,142,0)');c.fillStyle=g;c.fillRect(-1,z-1.2,RX1+1,2.4);}
   // slab joints
   c.lineWidth=.08;c.strokeStyle='rgba(10,16,18,.42)';c.beginPath();for(let x=-12;x<RX1;x+=4){c.moveTo(x,-RHW);c.lineTo(x,RHW);}c.stroke();
   c.lineWidth=.05;c.strokeStyle='rgba(176,186,180,.12)';c.beginPath();for(let x=-12;x<RX1;x+=4){c.moveTo(x+.1,-RHW);c.lineTo(x+.1,RHW);}c.stroke();
   c.strokeStyle='rgba(10,16,18,.28)';c.beginPath();c.moveTo(-1,0);c.lineTo(RX1,0);c.stroke();
   c.beginPath();for(let x=-14;x<-1;x+=2){c.moveTo(x,-RHW);c.lineTo(x,RHW);}for(const z of [-2.2,0,2.2]){c.moveTo(RX0,z);c.lineTo(-1,z);}c.stroke();
   // tyre and track marks
   for(let i=0;i<10;i++){const z0=lerp(-3.1,1.4,R()),x0=lerp(1,46,R()),len=7+R()*18,gap=1.5+R()*.6;c.strokeStyle='rgba(12,16,18,'+(.1+R()*.13)+')';c.lineWidth=.24+R()*.2;
    for(const o of [0,gap]){c.beginPath();for(let k=0;k<=12;k++){const x=x0+len*k/12,z=z0+o+Math.sin(k*.55+i*2)*.22;k?c.lineTo(x,z):c.moveTo(x,z);}c.stroke();}}
   // cracks
   c.lineCap='round';
   for(let i=0;i<32;i++){let x=lerp(-14,RX1,R()),z=lerp(-RHW,RHW,R()),a=R()*6.28;c.strokeStyle='rgba(6,10,12,'+(.28+R()*.26)+')';c.lineWidth=.035+R()*.045;c.beginPath();c.moveTo(x,z);for(let k=0,m=3+(R()*5|0);k<m;k++){a+=(R()-.5)*1.6;const l=.3+R()*.9;x+=Math.cos(a)*l;z+=Math.sin(a)*l;c.lineTo(x,z);}c.stroke();}
   c.lineCap='butt';
   // painted edge lines in the lane colour
   for(const z of [-3.6,3.6])for(let x=1;x<53.6;x+=.8){if(R()<.06)continue;c.fillStyle=css(acc,.5+R()*.4);c.fillRect(x,z-.13,R()<.14?.5:.82,.26);}
   // distance ticks every 5 units, longer every 10
   for(let x=5;x<=50;x+=5){const l=x%10?.55:1;c.fillStyle=css(pal.cream,.45+R()*.3);c.fillRect(x-.09,-3.4,.18,l);c.fillRect(x-.09,3.4-l,.18,l);}
   // chevrons pointing to the base
   c.lineWidth=.36;c.strokeStyle='rgba(158,184,186,.36)';
   for(let x=6.4;x<50;x+=7.25){c.beginPath();c.moveTo(x+.8,-1.55);c.lineTo(x-.8,0);c.lineTo(x+.8,1.55);c.stroke();}
   // hazard threshold on the leak line
   c.save();c.beginPath();c.rect(-.62,-RHW,1.24,2*RHW);c.clip();c.fillStyle='#121618';c.fillRect(-1,-RHW,2,2*RHW);c.fillStyle=css(pal.amberDeep,.95);
   for(let z=-RHW-1.4;z<RHW+1;z+=.92){c.beginPath();c.moveTo(-.62,z);c.lineTo(.62,z+.62);c.lineTo(.62,z+1.08);c.lineTo(-.62,z+.46);c.fill();}
   c.restore();
   c.fillStyle=css(pal.cream,.6);c.fillRect(.78,-3.9,.13,7.8);c.fillStyle=css(acc,.7);c.fillRect(-1.02,-3.9,.22,7.8);
   // brackets around the facility footprint
   c.strokeStyle=css(acc,.6);c.lineWidth=.22;
   for(const [bx,dx] of [[-9.2,1],[-1.6,-1]])for(const [bz,dz] of [[-3.95,1],[3.95,-1]]){c.beginPath();c.moveTo(bx+dx*1.5,bz);c.lineTo(bx,bz);c.lineTo(bx,bz+dz*1.5);c.stroke();}
   // wear over the paint
   for(let i=0;i<520;i++){c.fillStyle='rgba(70,82,86,'+(.3+R()*.5)+')';const r=.05+R()*.22;c.beginPath();c.ellipse(lerp(-10,54,R()),lerp(-RHW,RHW,R()),r*(1+R()*2),r,0,0,6.3);c.fill();}
   // scorch and sand where the column breaks through: only behind the spawn point (x > 53), machines walk on clean road
   for(let i=0;i<8;i++)blot(lerp(46,53,R()),lerp(-4,4,R()),.5+R()*1.4,'10,10,10',.12+R()*.12);
   for(let i=0;i<16;i++)blot(lerp(53.5,60,R()),lerp(-4,4,R()),.6+R()*2.2,'10,10,10',.2+R()*.25);
   let g=c.createLinearGradient(53,0,RX1,0);g.addColorStop(0,'rgba(170,120,76,0)');g.addColorStop(.45,'rgba(170,120,76,.34)');g.addColorStop(1,'rgba(190,136,84,.75)');c.fillStyle=g;c.fillRect(53,-RHW,RX1-53,2*RHW);
   // dirt creeping in from the verges and the far ends
   for(let i=0;i<150;i++){const s=R()>.5?1:-1;blot(lerp(-1,RX1,R()),s*lerp(3.5,4.5,R()),.3+R()*.9,'60,56,48',.3+R()*.3);}
   for(const s of [-1,1]){g=c.createLinearGradient(0,s*3.75,0,s*RHW);g.addColorStop(0,'rgba(58,54,46,0)');g.addColorStop(1,'rgba(58,54,46,.9)');c.fillStyle=g;c.fillRect(RX0,Math.min(s*3.75,s*RHW),RX1-RX0,RHW-3.75);}
   g=c.createLinearGradient(RX0,0,RX0+2.2,0);g.addColorStop(0,'rgba(58,54,46,.95)');g.addColorStop(1,'rgba(58,54,46,0)');c.fillStyle=g;c.fillRect(RX0,-RHW,2.2,2*RHW);
  });
 }

 /* ================= ground ================= */
 // Flat inside the outpost shelf, low mounds further out. The same in both layouts.
 function groundH(x,z){const d=Math.hypot(Math.max(-38-x,x-70,0),Math.max(-23-z,z-20,0));return d<=0?0:sm(sat(d/16))*(fbm(x*.06+3,z*.06+5)*5.5-1.2)*lerp(.3,1,sm(sat((x+14)/6)));}   // kept low behind the base
 function axis(a0,a1,step,ext){const v=[];for(let x=a0;x<=a1+1e-6;x+=step)v.push(x);let s=step,x=a1;while(x<a1+ext){s*=1.7;x+=s;v.push(x);}s=step;x=a0;while(x>a0-ext){s*=1.7;x-=s;v.unshift(x);}return v;}
 const gxs=axis(-42,84,2,220),gzs=axis(-46,58,2,220),GNX=gxs.length,GNZ=gzs.length;
 const ground=(()=>{
  const n=GNX*GNZ,pos=new Float32Array(n*3),uv=new Float32Array(n*2),col=new Float32Array(n*3),idx=[];
  for(let j=0;j<GNZ;j++)for(let i=0;i<GNX;i++){const k=j*GNX+i,x=gxs[i],z=gzs[j];pos[k*3]=x;pos[k*3+1]=groundH(x,z);pos[k*3+2]=z;uv[k*2]=x/TILE;uv[k*2+1]=z/TILE;}
  for(let j=0;j<GNZ-1;j++)for(let i=0;i<GNX-1;i++){const a=j*GNX+i,b=a+1,c=a+GNX,d=c+1;idx.push(a,c,b,b,c,d);}
  // coarse version for the lowest quality: every other row and column (a quarter of the triangles)
  const pick=n=>{const v=[];for(let i=0;i<n-1;i+=2)v.push(i);v.push(n-1);return v;},ci=pick(GNX),cj=pick(GNZ),lo=[];
  for(let j=0;j<cj.length-1;j++)for(let i=0;i<ci.length-1;i++){const a=cj[j]*GNX+ci[i],b=cj[j]*GNX+ci[i+1],c=cj[j+1]*GNX+ci[i],d=cj[j+1]*GNX+ci[i+1];lo.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:dirtTex,vertexColors:true,flatShading:true,roughness:1,metalness:0}));m.receiveShadow=true;m.frustumCulled=false;scene.add(m);
  m.userData.hi=g.index;m.userData.lo=new THREE.BufferAttribute(new Uint16Array(lo),1);return m;
 })();
 // Large-scale tint of the ground: warm and cool patches, dust along the roads, glow towards the sun, dark foreground.
 function paintGround(L){
  const side=L.mode==='side',LZ=L.LZ,col=ground.geometry.attributes.color,cz=side?CLIFF_SIDE:CLIFF_BEHIND;
  for(let j=0;j<GNZ;j++)for(let i=0;i<GNX;i++){
   const x=gxs[i],z=gzs[j],n=fbm(x*.05+11,z*.05+3),n2=vnoise(x*.17+5,z*.17+8);
   let r=lerp(.8,1.08,n),g=lerp(.9,1.02,n),b=lerp(1.1,.9,n),v=.62+.3*n2;
   const far=sm(sat((x-34)/30)),br=sm(sat((x-45)/10));r*=(1+far*.3)*(1+br*.4);g*=(1+far*.16)*(1+br*.18);v*=(1+far*.15)*(1+br*.3);   // sunlit dust towards the breach end (the roads lie on top and stay clean)
   const dl=Math.min(Math.abs(z-L.laneZ[0]),Math.abs(z-L.laneZ[1]));if(x>-16&&x<62)v*=1+(1-sm(sat((dl-4)/3.5)))*.14;
   v*=1-sm(sat((z-cz+4.5)/4.5))*.38*(side?1:sm(sat((x+16)/8)));   // grounded cliff foot
   if(side)v*=1-sm(sat((-LZ-4.6-z)/8))*.42;                   // dark near foreground
   else{v*=1-sm(sat((-z-LZ-5)/16))*.3;v*=1-sm(sat((-6-x)/9))*.18;}
   col.setXYZ(j*GNX+i,r*v,g*v,b*v);}
  col.needsUpdate=true;
 }

 /* ================= lanes: road, kerbs, lamps, breach ================= */
 const LAMPX=[1.6,6.6,17.4,23.4,29.4,35.4,41.4,47.4,52.7],LAMPZ=4.78,KERBZ=4.22;
 const C1=0x565d5d,C2=0x4a5153,C3=0x646660,CD=0x33393b; // concrete tones
 const roadGeo=(()=>{const g=new THREE.BufferGeometry(),NS=152,pos=[],nor=[],uv=[],idx=[];   // 0.5 unit pieces, so the strip can follow a bent lane
  for(let k=0;k<=NS;k++){const u=k/NS,x=RX0+(RX1-RX0)*u;pos.push(x,0,-RHW,x,0,RHW);nor.push(0,1,0,0,1,0);uv.push(u,1,u,0);if(k<NS){const a=k*2;idx.push(a,a+3,a+2,a,a+1,a+3);}}
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));g.setIndex(idx);return g;})();
 function laneParts(lane){
  const P=[],R=RNG(lane*53+11),acc=lane?pal.tealDeep:pal.amberDeep,edge=mixHex(pal.roadEdge,pal.steel,.35);
  // kerbs: low enough to stay under the keep-clear corridor
  // (the stretch beside the turret bunker is left open here; its outer side is filled per layout by kerbFill)
  for(const s of [-1,1])for(const [x0,x1] of [[.9,7.5],[16.5,53.3]])for(let x=x0,k=0;x<x1-.6;x+=4,k++){if(R()<.09)continue;const len=Math.min(3.7,x1-x)*(R()<.14?.5:1);
   B(P,len,.2,.34,x+len/2,.1,s*KERBZ,k%4===1?mixHex(acc,0x2a2a2a,.25):edge,(R()-.5)*.02);}
  // lamp posts just outside the corridor
  for(const s of [-1,1])for(const x of LAMPX){B(P,.3,.1,.3,x,.05,s*LAMPZ,CD);B(P,.11,.74,.11,x,.42,s*LAMPZ,pal.metalDark);B(P,.4,.07,.4,x,.985,s*LAMPZ,CD);}
  // short runs of guard rail on the verge
  for(const [x0,n,s] of lane?[[19.4,3,1],[38,2,-1]]:[[25.4,2,1],[43.4,3,-1]]){for(let k=0;k<=n;k++)B(P,.12,.62,.12,x0+k*2,.31,s*5.05,pal.metalDark);B(P,n*2+.3,.16,.07,x0+n,.52,s*5.05,pal.metal,0,0,(R()-.5)*.02);}
  // --- the breach (x >= 54). Tall pillar on +z, broken stump on -z: in 'side' the -z side faces the camera and must stay low.
  B(P,2.7,2.2,2.6,55.35,1.1,5.95,C1,.03);B(P,2.4,2.0,2.3,55.3,3.2,5.9,C2,-.05);B(P,2.1,1.5,2.0,55.4,4.95,5.85,C1,.08);B(P,2.5,.3,2.4,55.35,5.85,5.9,C3,.02);
  B(P,2.0,1.0,3.3,55.3,4.9,3.3,C2);B(P,1.8,.85,1.2,55.25,4.72,1.25,C1,.1,.3,0);                 // lintel stub hanging over the road
  B(P,.06,.06,1,55.6,4.75,.5,CD,0,.5);B(P,.06,.06,.8,54.9,4.9,.55,CD,.2,.35);                  // torn rebar
  B(P,.07,.5,2.2,53.99,2.0,5.95,mixHex(acc,0x202020,.2));                                      // painted lane band facing the base
  B(P,2.2,3.6,2.3,55.5,1.8,8.35,C3,.04);B(P,1.9,1.1,1.6,55.6,4.15,8.1,C1,-.1);                 // wing
  B(P,2.7,1.2,2.6,55.35,.6,-5.95,C1,-.04);B(P,1.2,.3,1,55.7,1.22,-6.3,C2,.4,0,.06);             // stump
  B(P,1.1,.5,.8,53.5,.25,-5.5,C2,.5);B(P,.8,.42,.7,54.3,.2,-7.7,C1,1.1);B(P,.7,.3,.6,52.4,.15,-5.3,C3,.8);
  B(P,1.3,.7,3.4,56.7,.33,-1.5,C2,.25,0,.08);B(P,1,.5,1.2,55.2,.25,1.6,C1,.7);B(P,.7,.36,.6,54.6,.18,-2.6,C3,1.9);B(P,.6,.3,.9,57.6,.15,2.4,C2,.3);
  for(let i=0;i<9;i++)B(P,.25+R()*.4,.16+R()*.2,.25+R()*.4,54.3+R()*4,.1,(R()-.5)*8,i%2?C1:C3,R()*3);
  return P;
 }
 const lampGeo=(()=>{const P=[];for(const s of [-1,1])for(const x of LAMPX)B(P,.3,.16,.3,x,.87,s*LAMPZ,0xffffff);B(P,.06,1.5,.34,53.95,3.4,5.95,0xffffff);return merge(P);})();
 const lanes=[0,1].map(i=>{
  const g=new THREE.Group(),acc=i?pal.teal:pal.amber;
  const road=new THREE.Mesh(roadGeo,new THREE.MeshStandardMaterial({map:roadTex(i),roughness:.9,metalness:0}));
  g.userData.road=road;road.position.y=.03;   // plain height, no polygon offset: a slope-scaled offset would bury other parts' ground pools (y = .1) at low pixel ratiosroad.receiveShadow=true;
  const lampMat=new THREE.MeshBasicMaterial({color:acc,fog:false});
  g.add(road,solid(laneParts(i),i*7+3,{foot:.9}),new THREE.Mesh(lampGeo,lampMat));scene.add(g);g.userData.lampMat=lampMat;g.userData.acc=new THREE.Color(acc);g.userData.glow=new THREE.Color(i?0x46d6c6:0xffa53e);return g;
 });

 // Maps bend the lanes: every lane mesh gets its own geometry and its vertices are shifted sideways by ctx.off(lane, x).
 const bendable=[];lanes.forEach((g,i)=>g.children.forEach(m=>{if(!m.geometry||!m.geometry.attributes.position)return;m.geometry=m.geometry.clone();const pos=m.geometry.attributes.position;bendable.push({lane:i,pos,base:pos.array.slice(),geo:m.geometry});}));
 function bendLanes(){for(const b of bendable){const a=b.pos.array,o=b.base;for(let k=0;k<a.length;k+=3)a[k+2]=o[k+2]+ctx.off(b.lane,o[k]);b.pos.needsUpdate=true;b.geo.computeBoundingSphere();}}
 // kerb along the outer edge of each road beside the turret bunker (the inner edge there belongs to base.js)
 const kerbFill=[0,1].map(i=>{const P=[],e=mixHex(pal.roadEdge,pal.steel,.35);B(P,3.7,.2,.34,9.6,.1,0,e);B(P,3.7,.2,.34,13.6,.1,0,e,.012);const m=solid(P,40+i,{cast:false,foot:0});scene.add(m);return m;});

 /* ================= median strip (stays inside |z| < 2.4 so it fits both layouts; x 8..16 is left to the turret bunker) ================= */
 const median=solid((()=>{
  const P=[],R=RNG(91),cA=0x5b6466,cB=0x6c7473;
  const run=(x0,x1)=>{for(let x=x0,k=0;x<x1-.6;x+=3.2,k++){const len=Math.min(3,x1-x);
   if(R()<.1){B(P,len,.34,.6,x+len/2,.17,(R()-.5)*.8,cA,(R()-.5)*.5);continue;}
   B(P,len,.34,.72,x+len/2,.17,0,cA);B(P,len-.12,.56,.36,x+len/2,.62,0,cB);if(k%3===0)B(P,len-.6,.04,.2,x+len/2,.92,0,0xb4b1a2);}};
  run(.9,7.5);run(16.7,53.4);
  for(const s of [-1,1]){B(P,6.4,.16,.4,4.2,.08,s*1.15,pal.metalDark);B(P,36.4,.16,.4,35,.08,s*1.15,pal.metalDark);
   for(let x=17.4;x<53;x+=3.6)B(P,.2,.24,.54,x,.12,s*1.15,pal.metal);
   for(const x of s>0?[21,33.8,46.6]:[27.4,40.2])B(P,.7,.74,.5,x,.37,s*1.72,x%2>1?pal.metal:0x3c4a4e,0);}
  return P;})(),5,{foot:.7});scene.add(median);

 /* ================= scenery ================= */
 const CLIFF_SIDE=24.4,CLIFF_BEHIND=13.6; // world z of the cliff foot line in each layout
 // Rock wall: a strip of displaced rows climbing away from the foot line (local z >= 0), with bays and buttresses.
 const cliff=(()=>{
  // rows alternate steep rises and narrow ledges; three columns share one block so the face breaks into chunky pillars
  const X0=-52,X1=98,NB=50,NX=NB*3,prof=[[0,0],[.45,2.3],[1.5,2.7],[2,5.4],[3.2,5.9],[3.7,8.7],[5.1,9.3],[5.6,12.1],[9,12.9],[13,13.2],[18,13.9],[24,14.2],[31,15],[40,15.5],[52,16.5]],NV=prof.length,pts=[];
  const foot=x=>{const s=x/15,t=Math.abs(s-Math.floor(s)-.5)*2;return .2+2.6*sm(t)+1.4*vnoise(x*.13,4.2);};
  for(let i=0;i<NX;i++){const blk=Math.floor(i/3),bw=(X1-X0)/NB,x=X0+(blk+[.07,.5,.93][i%3])*bw,xc=X0+(blk+.5)*bw,f=foot(xc)+(hash(blk,5)-.5)*1.5,hk=(.84+.3*vnoise(xc*.045+2,.5)+(hash(blk,9)-.5)*.16)*lerp(.09,1,sm(sat((xc+15.5)/8))),row=[];
   for(let j=0;j<NV;j++){const mid=j>0&&j<NV-1,top=j>8?2.4:1;   // the plateau behind the rim is rougher
    row.push([x+(mid?(hash(i,j+20)-.5)*.5*top:0),Math.max(0,prof[j][1]*hk+(mid?(hash(i*1.7,j*3.1)-.5)*.5*top:0)),Math.max(0,f*(j<8?1:.4)+prof[j][0]+(mid?(hash(i*2.3,j*5.7)-.5)*.6*top:0))]);}
   pts.push(row);}
  const pos=[],col=[],nor=[],steep=[new THREE.Color(0x46433f),new THREE.Color(0x3b3b3c),new THREE.Color(0x4e4944),new THREE.Color(0x363738)],ledge=new THREE.Color(0x625a51),cool=new THREE.Color(0x2b3236),c=new THREE.Color();
  // The wall is a backdrop: it must stay quieter than the lanes. Facet normals are pulled halfway towards one common
  // direction (less light/dark chatter between neighbouring facets) and the rock gets darker and cooler towards the rim.
  const N0=new THREE.Vector3(0,.45,-.89).normalize();
  const tri=(a,b,d,k)=>{const cy=(a[1]+b[1]+d[1])/3,cx=(a[0]+b[0]+d[0])/3;
   _a.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);_b.set(d[0]-a[0],d[1]-a[1],d[2]-a[2]);_a.cross(_b).normalize();const ny=Math.abs(_a.y);
   if(ny>.8)c.copy(ledge);else{c.copy(steep[(Math.floor(cy/1.5+vnoise(cx*.06,1.3)*1.8)+8)%4]);_a.lerp(N0,.5).normalize();}
   c.multiplyScalar(.9+.2*hash(k,3)).lerp(cool,sm(sat((cy-3.5)/9))*.55).multiplyScalar(lerp(.55,1,sat(cy/2.2))*lerp(1,.32,sm(sat((cy-1.5)/8.5))));
   pos.push(a[0],a[1],a[2],b[0],b[1],b[2],d[0],d[1],d[2]);for(let q=0;q<3;q++){col.push(c.r,c.g,c.b);nor.push(_a.x,_a.y,_a.z);}};
  for(let i=0;i<NX-1;i++)for(let j=0;j<NV-1;j++){const a=pts[i][j],b=pts[i+1][j],d=pts[i][j+1],e=pts[i+1][j+1],k=i*NV+j;if((i+j)&1){tri(a,d,b,k);tri(b,d,e,k+.5);}else{tri(a,d,e,k);tri(a,e,b,k+.5);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(col),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0}));m.receiveShadow=true;m.frustumCulled=false;scene.add(m);return m;
 })();

 const RK=[0x47443f,0x3b3b3b,0x504a42,0x403d3a];
 function pylon(P,x,z,h,dark){
  const c1=dark?0x171d20:pal.metalDark,c2=dark?0x1c2326:0x36494f,ins=dark?0x30363a:0x8d928a;
  B(P,1.3,.36,1.3,x,.18,z,dark?0x202426:0x575d5c);CY(P,.15,.42,h,4,x,h/2+.3,z,c1,PI/4);
  B(P,.2,.18,3.5,x,h-.45,z,c2);B(P,.18,.16,2.5,x,h-2.1,z,c2);B(P,.1,.1,1.9,x,h-1.3,z+.85,c2,0,.72);B(P,.1,.1,1.9,x,h-1.3,z-.85,c2,0,-.72);
  for(const s of [-1,1]){B(P,.14,.46,.14,x,h-.78,z+s*1.62,ins);B(P,.12,.4,.12,x,h-2.4,z+s*1.12,ins);}
 }
 function cables(P,xs,z,h,dark,th){const c=dark?0x14191b:0x1f2c30;
  for(let i=0;i<xs.length-1;i++)for(const s of [-1,1]){cable(P,xs[i],h-1,z+s*1.62,xs[i+1],h-1,z+s*1.62,1.5,6,th,c);if(s>0)cable(P,xs[i],h-2.6,z+1.12,xs[i+1],h-2.6,z+1.12,1.2,6,th,c);}
 }
 // dead hostile machine, half buried
 function wreck(P,x,z,s,ry,R){
  const r1=0x6a4236,r2=0x513936,dk=pal.enemyDark,cs=Math.cos(ry),sn=Math.sin(ry);
  P.push({g:new THREE.BoxGeometry(3*s,1.3*s,2*s),m:mat(x,.5*s,z,.12,ry,.2),c:r1});
  P.push({g:new THREE.BoxGeometry(1.7*s,.9*s,1.5*s),m:mat(x+.35*s*cs,1.3*s,z-.35*s*sn,.2,ry+.35,.28),c:r2});
  P.push({g:new THREE.BoxGeometry(.32*s,2.3*s,.32*s),m:mat(x-1.5*s*cs,.9*s,z+1.5*s*sn,.5,ry,-.55),c:dk});
  P.push({g:new THREE.BoxGeometry(.3*s,1.7*s,.3*s),m:mat(x+1.3*s*cs+.6*s*sn,.6*s,z-1.3*s*sn+.6*s*cs,-.7,ry,.4),c:dk});
  P.push({g:new THREE.BoxGeometry(1.2*s,.5*s,.4*s),m:mat(x+1.2*s*cs,1.5*s,z-1.2*s*sn,0,ry,-.2),c:0x2a2c2e});
  for(let i=0;i<4;i++)P.push({g:new THREE.BoxGeometry((.6+R())*s,.08,(.5+R()*.7)*s),m:mat(x+(R()-.5)*5*s,.05,z+(R()-.5)*4*s,0,R()*3,0),c:i%2?r2:0x2a2c2e});
 }
 function tank(P,x,z,r,h){CY(P,r,r,h,10,x,h/2,z,0x5f6e6f);CY(P,r*1.05,r*1.05,.2,10,x,h*.68,z,0x475658);CY(P,r*.55,r*.96,.34,10,x,h+.17,z,0x6f7d7c);B(P,.16,h,.16,x-r-.12,h/2,z,pal.metalDark);}
 function crate(P,x,z,w,h,d,ry,c){B(P,w,h,d,x,h/2,z,c,ry);B(P,w+.08,.1,d+.08,x,h*.3,z,pal.metalDark,ry);B(P,w+.08,.1,d+.08,x,h*.75,z,pal.metalDark,ry);}
 // rough wall of stacked blocks running along z
 function wallRun(P,x,z0,z1,h0,h1,R){
  for(let z=z0;z<z1-.4;){const w=Math.min(1.7+R()*1.3,z1-z),h=lerp(h0,h1,R()),d=2+R()*.8,c=[C1,C2,C3][R()*3|0];
   B(P,d,h,w-.06,x+(R()-.5)*.5,h/2,z+w/2,c,(R()-.5)*.08);if(R()<.5)B(P,d*.7,.5+R()*.9,w*.6,x+(R()-.5)*.4,h+.3,z+w/2,[C1,C2,C3][R()*3|0],(R()-.5)*.3);z+=w;}
 }

 // Ground decals (soot, tracks, soft contact shade, cracks): one alpha-blended mesh per layout, darkening only.
 const decalTex=canvasTex(256,256,c=>{
  const R=RNG(64);c.lineCap='round';
  let g=c.createRadialGradient(64,64,3,64,64,62);g.addColorStop(0,'rgba(7,7,8,.82)');g.addColorStop(.4,'rgba(9,9,10,.5)');g.addColorStop(1,'rgba(9,9,10,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
  for(let i=0;i<26;i++){const a=R()*6.28,r0=8+R()*14,r1=28+R()*30;c.strokeStyle='rgba(5,5,6,'+(.12+R()*.25)+')';c.lineWidth=1+R()*3.5;c.beginPath();c.moveTo(64+Math.cos(a)*r0,64+Math.sin(a)*r0);c.lineTo(64+Math.cos(a)*r1,64+Math.sin(a)*r1);c.stroke();}
  g=c.createRadialGradient(64,192,0,64,192,62);g.addColorStop(0,'rgba(4,6,8,.7)');g.addColorStop(.5,'rgba(4,6,8,.38)');g.addColorStop(1,'rgba(4,6,8,0)');c.fillStyle=g;c.fillRect(0,128,128,128);
  for(let i=0;i<9;i++){let x=192+(R()-.5)*30,y=192+(R()-.5)*30,a=R()*6.28;c.strokeStyle='rgba(5,6,7,.6)';c.lineWidth=1+R()*1.4;c.beginPath();c.moveTo(x,y);for(let k=0;k<5;k++){a+=(R()-.5)*1.3;const l=6+R()*10;x+=Math.cos(a)*l;y+=Math.sin(a)*l;c.lineTo(x,y);}c.stroke();}
  c.save();c.beginPath();c.rect(128,0,128,128);c.clip();   // tracks: two tread bands along v, faded at both ends
  for(const x of [154,214]){c.fillStyle='rgba(7,8,9,.36)';c.fillRect(x-10,0,20,128);c.fillStyle='rgba(3,4,5,.42)';for(let y=2;y<128;y+=7)c.fillRect(x-10,y,20,3);}
  c.globalCompositeOperation='destination-in';g=c.createLinearGradient(0,0,0,128);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.22,'rgba(0,0,0,1)');g.addColorStop(.78,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(128,0,128,128);
  c.restore();
 });
 const decalMat=new THREE.MeshBasicMaterial({map:decalTex,vertexColors:true,transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3});
 // list rows: [cell (0 soot, 1 tracks, 2 soft shade, 3 cracks), x, z, length, width, turn, alpha]
 function decalMesh(list){
  const n=list.length,pos=new Float32Array(n*12),uv=new Float32Array(n*8),col=new Float32Array(n*16),idx=[],K=[-1,-1,1,-1,1,1,-1,1];
  for(let i=0;i<n;i++){const d=list[i],cs=Math.cos(d[5]),sn=Math.sin(d[5]),u0=(d[0]&1)*.5+.012,v0=(d[0]<2?.5:0)+.012,u1=u0+.476,v1=v0+.476;
   for(let k=0;k<4;k++){const a=K[k*2]*d[3]/2,b=K[k*2+1]*d[4]/2,o=i*12+k*3;pos[o]=d[1]+a*cs+b*sn;pos[o+1]=.05;pos[o+2]=d[2]-a*sn+b*cs;col[i*16+k*4]=col[i*16+k*4+1]=col[i*16+k*4+2]=1;col[i*16+k*4+3]=d[6];}
   uv.set([u0,v0,u0,v1,u1,v1,u1,v0],i*8);idx.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('color',new THREE.BufferAttribute(col,4));g.setIndex(idx);
  const m=new THREE.Mesh(g,decalMat);m.renderOrder=-3;return m;
 }

 // --- 'side' set: outpost yard, pylons and wreckage between the far lane and the cliff; low dark foreground on the camera side
 const sideSet=new THREE.Group(),behindSet=new THREE.Group();scene.add(sideSet,behindSet);
 const SIDE_PYL=[-16,10,36,62],BEH_PYL=[1,26,51],BUNKX=-1;   // BUNKX: a bay of the cliff in 'side' (the cliff is slid 16 along -x there)
 (()=>{
  const P=[],R=RNG(201);
  for(const x of SIDE_PYL)pylon(P,x,16.5,8.4);cables(P,[-42].concat(SIDE_PYL,[88]),16.5,8.4,false,.11);
  tank(P,-9.6,19.6,1.7,3.2);tank(P,-5.7,20.6,1.35,2.5);crate(P,-2.2,17.6,3.2,1.5,1.5,.12,0x3f4c4d);crate(P,2.6,16.9,1.1,.9,1.1,.5,0x5a5346);crate(P,3.7,17.6,.9,.7,.9,.2,0x4b5758);
  for(let x=-13;x<=4;x+=2.8)B(P,.12,.9,.12,x,.45,15.1,pal.metalDark);B(P,17,.08,.06,-4.6,.8,15.1,pal.metal);B(P,17,.08,.06,-4.6,.45,15.1,pal.metal);
  // old survey dish
  CY(P,.14,.2,2.2,5,21.4,1.1,21.3,pal.metalDark);CY(P,1.6,.25,.55,8,21.2,2.5,21.2,0x687574,0,.5,.55);B(P,1.1,.3,1.1,21.4,.15,21.3,0x565c5b);
  wreck(P,30.5,19.7,1.25,.5,R);wreck(P,46.5,20.6,.9,2.1,R);
  for(let i=0;i<20;i++){const x=lerp(-24,64,i/19)+(R()-.5)*3,s=.5+R()*R()*1.9;rock(P,x,s*.25,CLIFF_SIDE-.6+R()*2.4,s*(1+R()*.5),s*.8,s,RK[i%4],i+300);}
  rock(P,16.8,.15,15.2,.55,.4,.5,RK[1],321);rock(P,41.6,.2,18,.9,.6,.8,RK[2],322);rock(P,51.5,.3,16.4,1.2,.8,1,RK[0],323);rock(P,8.5,.2,19.6,.8,.5,.7,RK[3],324);rock(P,-19,.4,18.6,1.5,1,1.3,RK[0],325);
  wallRun(P,56.3,18.3,27,3.8,6.2,R);B(P,2.4,2.2,2.6,55.4,1.1,.1,C2,.05);B(P,1.6,.8,1.5,55.5,2.6,.2,C1,.3);
  // service bunker dug into a bay of the cliff (the search radar turns on its roof)
  const bx=BUNKX;
  B(P,.8,3.3,5.4,bx-2.7,1.65,26.9,C1);B(P,.8,3.3,5.4,bx+2.7,1.65,26.9,C1);B(P,6.6,.8,5.8,bx,3.7,26.9,C3);B(P,4.6,3.3,.4,bx,1.65,25.6,0x1a1f21);
  B(P,2.2,2.5,.14,bx,1.25,25.36,0x39474b);B(P,5.2,.1,2.6,bx,.05,23.3,C2);B(P,1.4,.3,.3,bx,3.05,24.3,pal.metalDark);
  B(P,6.7,.24,.3,bx,4.2,24.15,C1);B(P,1.3,.16,1.3,bx-1.9,4.18,28.2,CD);B(P,.8,.5,.8,bx+2.1,4.35,25.3,pal.metal);   // parapet, hatch, vent
  // pipeline along the cliff foot, diving underground either side of the bunker
  for(const [x0,x1] of [[-23,bx-3.4],[bx+3.4,53.6]]){CY(P,.3,.3,x1-x0,6,(x0+x1)/2,.78,23.5,0x56646a,0,0,PI/2);
   for(let x=x0+1.5;x<x1-1;x+=5.2){B(P,.3,.6,.8,x,.3,23.5,C2);CY(P,.37,.37,.22,6,x+1.4,.78,23.5,0x3a474b,0,0,PI/2);}}
  CY(P,.3,.3,.9,6,bx-3.4,.4,23.5,0x56646a);CY(P,.3,.3,.9,6,bx+3.4,.4,23.5,0x56646a);
  sideSet.add(solid(P,7));
  // near foreground: nothing above 1.5 between the camera and the near lane; taller silhouettes only further out
  const Q=[],dkc=[0x23282a,0x1e2224,0x2a2a28];
  for(let x=1,k=0;x<50;x+=3.3,k++){if(R()<.3)continue;const len=2.2+R()*.9;B(Q,len,.5+R()*.16,.5,x+len/2,.3,-15.5+(R()-.5)*.2,dkc[k%3],(R()-.5)*.05);}
  for(let i=0;i<12;i++){const s=.45+R()*.55;rock(Q,lerp(-10,50,R()),s*.2,lerp(-21.5,-16.8,R()),s*1.3,s*.75,s,dkc[i%3],i+400);}
  CY(Q,.7,.7,.9,10,31,.7,-18.2,0x2a2f30,0,PI/2);crate(Q,9,-17.6,1,.8,1,.4,0x2c3231);crate(Q,10.3,-18,.8,.6,.8,.1,0x262b2b);
  rock(Q,47.5,1,-25,2.2,3.6,2,dkc[1],420);rock(Q,-9,.8,-25.4,2.4,3.4,2.2,dkc[0],421);rock(Q,-3.5,.2,-24.6,1.4,1.8,1.3,dkc[2],422);
  pylon(Q,22,-25.6,9.4,true);cables(Q,[-34,22,78],-25.6,9.4,true,.12);
  sideSet.add(solid(Q,9,{cast:false,jitter:.1,foot:.6}));
  const D=[[0,30.5,19.4,8,6.5,.4,.9],[0,46.5,20.5,5.5,4.5,1,.8],[0,15,15.2,3.4,2.8,.2,.6],[0,39,-15.6,4,3,.7,.6],[0,30,2.7,2.6,2,.3,.55],[0,45,-2.3,3,2.4,1.2,.55],[0,6,19,3,3,0,.5],
   [2,-9.6,19.4,6.5,5.5,0,.8],[2,-5.7,20.4,5,4.4,0,.8],[2,-2.2,17.5,5.5,3.4,.12,.7],[2,21.4,21.2,4,3.6,0,.6],[2,55.6,22,5,11,0,.7],
   [3,24,15.6,5,5,.5,.7],[3,43,16.5,6,6,2,.6],[3,12,22,6,6,1,.6],[3,20,-17,5,5,.3,.6],[3,37,2.4,3.2,3.2,2.2,.5],[3,-18,20,6,6,1.4,.6]];
  for(let x=-18;x<52;x+=11.5)D.push([1,x+5.5,19.6+Math.sin(x*.3)*.5,12.5,2.3,Math.sin(x*.7)*.04,.75]);
  for(let x=-6;x<50;x+=11.5)D.push([1,x+5.5,-18.6+Math.sin(x*.4)*.4,12.5,2.2,Math.sin(x*.5)*.04,.6]);
  for(let i=0;i<12;i++)D.push([2,lerp(-10,50,R()),lerp(-21.5,-16.8,R()),2.6,2.2,0,.55]);
  sideSet.add(decalMesh(D));
 })();
 // --- 'behind' set: power line and outcrops on the open left flank, wall across the far end, scree at the cliff foot
 (()=>{
  const P=[],R=RNG(501);
  for(const x of BEH_PYL)pylon(P,x,-15.5,8.4);cables(P,BEH_PYL.concat([77]),-15.5,8.4,false,.11);
  tank(P,-8.6,-16.9,1.6,3);tank(P,-4.5,-18.3,1.3,2.4);crate(P,-12.6,-14.5,3,1.5,1.5,-.1,0x3f4c4d);crate(P,5,-13.6,1,.8,1,.4,0x5a5346);
  wreck(P,31,-17.6,1.2,-.6,R);wreck(P,43.6,-14.4,.75,1.2,R);
  CY(P,.12,.2,2.6,5,17,1.3,-18.6,pal.metalDark);B(P,.9,.3,.9,17,.15,-18.6,0x565c5b);   // radar mast
  const big=[[12,-20.6,2.5],[21.5,-23.4,3.1],[36,-20,2.3],[45.5,-24,3.3],[53,-18.6,2.1],[-3,-22.4,2.1],[28,-26.5,2.6],[9,-28,3],[17,-35,3.4],[35,-31.5,2.8],[49,-37,3.6],[1,-34,2.6],[27,-43,3.8],[43,-46,3],[-9,-39,2.4],[58,-30,2.6]];   // the far ones only show in wide windows
  for(let i=0;i<big.length;i++){const b=big[i];rock(P,b[0],b[2]*.2,b[1],b[2]*1.2,b[2]*.95,b[2],RK[i%4],i+600);}
  for(let i=0;i<14;i++){const s=.35+R()*.5;rock(P,lerp(.5,52,R()),s*.2,lerp(-14.6,-12.9,R())-(i%3)*2.2,s*1.2,s*.8,s,RK[i%4],i+620);}
  for(let i=0;i<16;i++){const s=.4+R()*.5;rock(P,lerp(1.5,53,i/15)+(R()-.5)*2,s*.2,CLIFF_BEHIND-.4+R()*.5,s*1.2,s*.8,s*.8,RK[i%4],i+650);}
  wallRun(P,58.3,-62,-11.8,3.6,6.4,R);wallRun(P,58.6,-2.3,2.4,4.6,7,R);wallRun(P,58.3,11.8,17,4.6,6.6,R);
  behindSet.add(solid(P,11));
  const D=[[0,31,-17.4,8,6.5,-.5,.9],[0,43.6,-14.3,4.5,3.6,1,.75],[0,19,-13.6,3,2.4,.3,.55],[0,38,0,2.2,1.6,.2,.5],[0,49,.2,2.4,1.7,1.4,.5],[0,8,-17.5,3.4,3,2,.5],
   [2,-8.6,-16.9,6,5.4,0,.8],[2,-4.5,-18.3,5,4.4,0,.8],[2,-12.6,-14.5,5.4,3.2,-.1,.7],[2,58.4,-20,5.5,22,0,.7],
   [3,14,-14.4,5,5,.4,.7],[3,40,-18,6,6,1.9,.6],[3,25,-22,7,7,1,.6],[3,2,-19.5,6,6,2.6,.6],[3,27,.1,2.6,2.6,.7,.5]];
  for(const b of big)D.push([2,b[0]-b[2]*.5,b[1]+b[2]*.3,b[2]*4.4,b[2]*3.4,-.4,.85]);
  for(let x=-2;x<52;x+=11.5)D.push([1,x+5.5,-13.5+Math.sin(x*.3)*.25,12.5,2,Math.sin(x*.7)*.03,.7]);
  behindSet.add(decalMesh(D));
 })();

 // search radar: the one moving piece of scenery (on the bunker roof in 'side', on a mast on the open flank in 'behind')
 const radar=(()=>{const P=[];B(P,2.6,.62,.12,0,.6,0,0x7d8c8c);B(P,2.2,.1,.5,0,.34,.2,pal.metal);B(P,.3,.3,.5,0,.55,.25,pal.metalDark);CY(P,.13,.17,.5,6,0,0,0,pal.metalDark);const m=solid(P,61,{foot:0});scene.add(m);return m;})();

 /* ================= additive glow batch: lamp pools and halos, breach glow, beacons, light shafts (one draw call) ================= */
 // k: 'b' billboard, 'f' flat on the ground, 's' light shaft (see SHAFT_SIDE / SHAFT_BEHIND). lane>=0: z is relative to that lane. mode: 0 both, 1 side, 2 behind.
 // a: 0 static, 1 lamp, 2 breach, 3 shaft, 4 beacon, 5 dust puff. lo: decoration that is dropped at the lowest quality.
 const GQ=[],sunC=new THREE.Color(pal.sun),hazeC=new THREE.Color(pal.haze),amberC=new THREE.Color(pal.amber),creamC=new THREE.Color(0xffe6bf);
 const glowQ=(k,lane,mode,x,y,z,w,h,c,i,a,ph,len,lo)=>GQ.push({k,lane,mode,x,y,z,w,h,c,i,a,ph:ph||0,len:len||0,lo:!!lo,on:false});
 const PUFF_RUN=4.2;   // how far a dust puff rolls out of the breach before it has faded
 (()=>{
  const R=RNG(77);
  for(let lane=0;lane<2;lane++){const acc=lanes[lane].userData.glow,kl=lane?.8:1;   // teal reads brighter than amber on this ground
   // Lane lamps are identity accents, not light sources: a small halo on the head and a faint pool on the verge (not on the road).
   for(const s of [-1,1])for(const x of LAMPX){const ph=R();glowQ('f',lane,0,x,.07,s*4.95,2.8,2.4,acc,.2*kl,1,ph);glowQ('b',lane,0,x,.9,s*LAMPZ,.9,.9,acc,.5*kl,1,ph);}
   glowQ('b',lane,0,53.9,3.4,5.95,1.3,2.6,acc,.4,1,.3);
   // The breach glows BEHIND the spawn point (x > 54) and on the verges either side of the mouth, never on the road the machines walk on.
   glowQ('f',lane,0,58,.08,0,8,9.4,hazeC,.26,2,.1+lane*.4);              // lit dust on the ground inside the breach
   glowQ('f',lane,0,54,.07,7,12,4.4,hazeC,.4,2,.3+lane*.4);              // spill on the ground either side of the mouth (verge and median)
   glowQ('f',lane,0,54,.07,-7,12,4.4,hazeC,.4,2,.7+lane*.4);
   glowQ('b',lane,1,55.4,1.2,0,3.6,7.4,sunC,.85,2,.6+lane*.3);           // 'side' shows the mouth only as a sliver at the screen edge: a tight hot glow there
   glowQ('b',lane,0,59,2.4,0,9.6,8.4,hazeC,.5,2,.5+lane*.3);
   glowQ('b',lane,0,56.8,1.6,0,5.4,6.2,sunC,.75,2,.2+lane*.3);
   for(let i=0;i<4;i++)glowQ('b',lane,0,59.4+i*.8,.8+R()*1.4,(R()-.5)*6,3.6+R()*1.4,2.4+R()*1,hazeC,.15,5,i/4+R()*.1,0,1);
  }
  for(const x of SIDE_PYL)glowQ('b',-1,1,x,9,16.5,1.1,1.1,amberC,.8,4,R());
  glowQ('b',-1,1,BUNKX,2.9,24.1,2.2,1.3,creamC,.5,0);glowQ('f',-1,1,BUNKX,.07,23.2,5,3.4,creamC,.16,0,0,0,1);   // bunker door light
  glowQ('b',-1,1,22,10,-25.6,1.2,1.2,amberC,.7,4,R());
  for(const x of BEH_PYL)glowQ('b',-1,2,x,9,-15.5,1.1,1.1,amberC,.8,4,R());
  // shafts: x,z is where the beam meets the ground. They stay over the scenery, never across a lane.
  for(const [x,z,w,l,i] of [[21,17.6,3,34,.15],[36,20.5,2.4,28,.13],[5,16.2,2.2,38,.09]])glowQ('s',-1,1,x,0,z,w,0,sunC,i,3,R(),l,1);
  for(const [x,z,w,l,i] of [[27,-17.5,3.6,34,.16],[44,-22,4,30,.12],[33,15.6,3,30,.11]])glowQ('s',-1,2,x,0,z,w,0,sunC,i,3,R(),l,1);
 })();
 // Direction a shaft climbs in, per layout: a fake chosen for the picture. In 'side' the true sun direction would lie almost flat across
 // the screen and smear over the lanes; here the beams lean away up the cliff. In 'behind' they stay inside their own flank.
 const SHAFT_SIDE=new THREE.Vector3(.8,.45,.2).normalize(),SHAFT_BEHIND=new THREE.Vector3(.84,.54,0).normalize();
 // atlas: left half = soft round glow, right half = beam (soft across, fading towards both ends)
 const glowTex=canvasTex(128,64,c=>{
  c.save();c.beginPath();c.rect(64,0,64,64);c.clip();   // the clip keeps 'destination-in' from wiping the other half
  let g=c.createLinearGradient(0,0,0,64);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.3,'rgba(255,255,255,1)');g.addColorStop(.62,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(64,0,64,64);
  c.globalCompositeOperation='destination-in';g=c.createLinearGradient(66,0,126,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(64,0,64,64);
  c.restore();
  g=c.createRadialGradient(32,32,0,32,32,31);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,64,64);
 });
 const GN=GQ.length,gPos=new Float32Array(GN*12),gCol=new Float32Array(GN*12),gBase=new Float32Array(GN*4);
 const glow=(()=>{
  const uv=new Float32Array(GN*8),idx=[];for(let i=0;i<GN;i++){uv.set(GQ[i].k==='s'?[.53,.02,.97,.02,.97,.98,.53,.98]:[.01,.01,.49,.01,.49,.99,.01,.99],i*8);idx.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(gPos,3));g.setAttribute('color',new THREE.BufferAttribute(gCol,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:glowTex,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  m.frustumCulled=false;m.renderOrder=-1;scene.add(m);return m;
 })();
 const setQuadCol=(i,c,f)=>{const r=c.r*f,g=c.g*f,b=c.b*f,o=i*12;gCol[o]=gCol[o+3]=gCol[o+6]=gCol[o+9]=r;gCol[o+1]=gCol[o+4]=gCol[o+7]=gCol[o+10]=g;gCol[o+2]=gCol[o+5]=gCol[o+8]=gCol[o+11]=b;};
 const setV=(o,x,y,z)=>{gPos[o]=x;gPos[o+1]=y;gPos[o+2]=z;};
 // The camera never turns, so billboards are simply laid out against its axes once per layout.
 function layoutGlow(L){
  const e=camera.matrixWorld.elements,rx=e[0],ry=e[1],rz=e[2],ux=e[4],uy=e[5],uz=e[6],md=L.mode==='side'?1:2,sh=md===1?SHAFT_SIDE:SHAFT_BEHIND;
  const sd=_d.set(e[8],e[9],e[10]).cross(sh).normalize();  // across a shaft, facing the camera
  for(let i=0;i<GN;i++){const q=GQ[i],o=i*12;
   if((q.mode&&q.mode!==md)||(q.lo&&lowQ)){for(let k=0;k<12;k+=3)setV(o+k,0,-60,0);setQuadCol(i,q.c,0);q.on=false;continue;}   // not part of this layout (or cut at low quality): collapsed, costs no fill
   const z=q.z+(q.lane>=0?ctx.laneZAt(q.lane,q.x):0),w=q.w/2,h=q.h/2;
   if(q.k==='f'){setV(o,q.x-w,q.y,z-h);setV(o+3,q.x+w,q.y,z-h);setV(o+6,q.x+w,q.y,z+h);setV(o+9,q.x-w,q.y,z+h);}
   else if(q.k==='b'){setV(o,q.x-rx*w-ux*h,q.y-ry*w-uy*h,z-rz*w-uz*h);setV(o+3,q.x+rx*w-ux*h,q.y+ry*w-uy*h,z+rz*w-uz*h);setV(o+6,q.x+rx*w+ux*h,q.y+ry*w+uy*h,z+rz*w+uz*h);setV(o+9,q.x-rx*w+ux*h,q.y-ry*w+uy*h,z-rz*w+uz*h);}
   else{const x1=q.x+sh.x*q.len,y1=q.y+sh.y*q.len,z1=z+sh.z*q.len;setV(o,q.x-sd.x*w,q.y-sd.y*w,z-sd.z*w);setV(o+3,q.x+sd.x*w,q.y+sd.y*w,z+sd.z*w);setV(o+6,x1+sd.x*w,y1+sd.y*w,z1+sd.z*w);setV(o+9,x1-sd.x*w,y1-sd.y*w,z1-sd.z*w);}
   setQuadCol(i,q.c,q.i);q.on=true;gBase[i*4]=gPos[o];gBase[i*4+1]=gPos[o+3];gBase[i*4+2]=gPos[o+6];gBase[i*4+3]=gPos[o+9];}
  glow.geometry.attributes.position.needsUpdate=true;glow.geometry.attributes.color.needsUpdate=true;
 }
 let lowQ=ctx.quality===0;
 const pulse=[0,0],live=[1,1]; // breach flare per lane (set by 'spawn' events); how alive each lane's lamps are (they die with the facility)
 function animGlow(t){
  let moved=false;
  for(let i=0;i<GN;i++){const q=GQ[i];if(!q.a||!q.on)continue;let f=1;
   if(q.a===1){f=.9+.1*Math.sin(t*6.3+q.ph*40);if(q.ph>.9&&Math.sin(t*2.1+q.ph*50)+Math.sin(t*17+q.ph*9)*.5>1.15)f*=.2;   // a few faulty lamps drop out
    const lv=live[q.lane];if(lv<.99)f*=lerp(Math.sin(t*(9+q.ph*7)+q.ph*30)>.6?.45:.1,1,lv);}
   else if(q.a===2)f=.8+.2*Math.sin(t*1.1+q.ph*6.28)+pulse[q.lane]*1.1;
   else if(q.a===3)f=.7+.3*Math.sin(t*.33+q.ph*6.28);
   else if(q.a===4){const u=t*.45+q.ph;f=u-Math.floor(u)<.14?1:.07;}
   else{const u=t*.11+q.ph,w=u-Math.floor(u),dx=-w*PUFF_RUN,o=i*12;f=Math.sin(w*PI)*(1+pulse[q.lane]*1.4);   // dust rolling out of the breach
    gPos[o]=gBase[i*4]+dx;gPos[o+3]=gBase[i*4+1]+dx;gPos[o+6]=gBase[i*4+2]+dx;gPos[o+9]=gBase[i*4+3]+dx;moved=true;}
   setQuadCol(i,q.c,q.i*f);}
  glow.geometry.attributes.color.needsUpdate=true;if(moved)glow.geometry.attributes.position.needsUpdate=true;
 }

 /* ================= haze sheets: additive vertex-coloured cards layered behind the play area (one draw call) ================= */
 const SH_N=5,SH_U=14,SH_V=6,SH_VERT=(SH_U+1)*(SH_V+1),hPos=new Float32Array(SH_N*SH_VERT*3),hCol=new Float32Array(SH_N*SH_VERT*3);
 const hazeMesh=(()=>{
  const idx=[];for(let s=0;s<SH_N;s++)for(let v=0;v<SH_V;v++)for(let u=0;u<SH_U;u++){const a=s*SH_VERT+v*(SH_U+1)+u,b=a+1,c=a+SH_U+1,d=c+1;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(hPos,3));g.setAttribute('color',new THREE.BufferAttribute(hCol,3));g.setIndex(idx);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}));
  m.frustumCulled=false;m.renderOrder=-2;scene.add(m);return m;
 })();
 // sheet s spans the bilinear patch p00..p11 (u across, v up); f(u,v) gives its strength, the edges are faded so no border shows
 function sheet(s,ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz,col,f){
  for(let v=0;v<=SH_V;v++)for(let u=0;u<=SH_U;u++){const fu=u/SH_U,fv=v/SH_V,o=(s*SH_VERT+v*(SH_U+1)+u)*3,k=f?f(fu,fv)*sm(sat(fu*5))*sm(sat((1-fu)*5))*sm(sat(fv*3.5))*sm(sat((1-fv)*3.5)):0;
   hPos[o]=lerp(lerp(ax,bx,fu),lerp(cx,dx,fu),fv);hPos[o+1]=lerp(lerp(ay,by,fu),lerp(cy,dy,fu),fv);hPos[o+2]=lerp(lerp(az,bz,fu),lerp(cz,dz,fu),fv);
   hCol[o]=col.r*k;hCol[o+1]=col.g*k;hCol[o+2]=col.b*k;}
 }
 const hazeWarm=new THREE.Color(pal.haze).lerp(new THREE.Color(pal.sun),.25),hazeDim=hazeWarm.clone().lerp(new THREE.Color(0x8c8480),.45);
 function layoutHaze(L){
  if(L.mode==='side'){const z=CLIFF_SIDE;
   // The cliff is the top band of the phone screen: a thin, greyed veil that is strongest low on the sun side, so the wall darkens upwards.
   sheet(0,90,.2,z-2.2,-50,.2,z-2.2,90,17,z+7.5,-50,17,z+7.5,hazeDim,(u,v)=>(.085-.06*v)*(1.2-.8*u));        // veil on the cliff face
   sheet(1,90,0,z-9,-50,0,z-9,90,3.2,z-3,-50,3.2,z-3,hazeDim,(u,v)=>.07*(1.2-.8*u));                           // ground mist in front of it
   sheet(2,0,0,0,0,0,0,0,0,0,0,0,0,hazeWarm,null);
   sheet(3,88,.12,-34,44,.12,-34,88,.12,34,44,.12,34,hazeWarm,(u,v)=>.5*Math.pow(sat((88-44*u-54)/11),1.4));     // sunlit dust on the ground behind the breach line (x > 54)
   sheet(4,0,0,0,0,0,0,0,0,0,0,0,0,hazeWarm,null);
  }else{const z=CLIFF_BEHIND;
   sheet(0,61.5,0,-75,61.5,0,75,61.5,19,-75,61.5,19,75,hazeWarm,(u,v)=>.7*(1-v*.55));                        // bright dust beyond the far wall
   sheet(1,-20,.2,z-1.2,66,.2,z-1.2,-20,17,z+8,66,17,z+8,hazeDim,(u,v)=>.34*u*u*(.3+.7*v));                 // veil on the cliff, thicker with distance
   sheet(2,-10,2.5,-70,66,2.5,-70,-10,2.5,-17,66,2.5,-17,hazeWarm,(u,v)=>.36*u*u*(1-v*.8));                   // haze pooling over the open flank
   sheet(3,88,.12,-70,44,.12,-70,88,.12,70,44,.12,70,hazeWarm,(u,v)=>.45*Math.pow(sat((88-44*u-54)/11),1.4));
   sheet(4,54.8,1.5,-80,54.8,1.5,80,58.5,5.5,-80,58.5,5.5,80,hazeWarm,(u,v)=>.7*v);                                      // the far wall and the gate tops melt into the dust
  }
  hazeMesh.geometry.attributes.position.needsUpdate=true;hazeMesh.geometry.attributes.color.needsUpdate=true;
 }

 /* ================= drifting dust motes (one Points object, animated in the vertex shader) ================= */
 const DUST=320;
 const dust=(()=>{
  const R=RNG(9),p=new Float32Array(DUST*3),s=new Float32Array(DUST*4);
  for(let i=0;i<DUST;i++){p[i*3]=R();p[i*3+1]=R()*R();p[i*3+2]=R();s[i*4]=R();s[i*4+1]=R();s[i*4+2]=.14+R()*R()*.3;s[i*4+3]=R();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('aSeed',new THREE.BufferAttribute(s,4));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
   uniforms:{uTime:{value:0},uScale:{value:700},uMin:{value:new THREE.Vector3(-24,.3,-27)},uSize:{value:new THREE.Vector3(90,10,60)},uColor:{value:new THREE.Color(1,.78,.52)}},
   vertexShader:'attribute vec4 aSeed;uniform float uTime,uScale;uniform vec3 uMin,uSize;varying float vA;void main(){vec3 p=position;'+
    'p.x=fract(p.x-uTime*(.006+aSeed.y*.012));float e=p.x;p=uMin+p*uSize;'+                                  // wind blows from the breach towards the base and wraps
    'p.y+=sin(uTime*.4+aSeed.x*6.28)*.5;p.z+=sin(uTime*.23+aSeed.x*12.)*1.3;'+
    'vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;float s=aSeed.z*uScale/-mv.z;'+
    'vA=(.3+.7*abs(sin(uTime*(.4+aSeed.w)+aSeed.x*40.)))*min(1.,s/1.6)*smoothstep(0.,.1,e)*(1.-smoothstep(.9,1.,e))*(.55+.6*e);gl_PointSize=max(s,1.6);}',
   fragmentShader:'uniform vec3 uColor;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(0.,1.,d);gl_FragColor=vec4(uColor*vA*a*a*.75,1.);}'});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;scene.add(pts);return pts;
 })();

 /* ================= part interface ================= */
 let q=ctx.quality,frame=0,laidKey='';
 const big=[{mesh:ground,k:1.6},{mesh:cliff,k:1.5},{mesh:lanes[0].userData.road,k:1.3},{mesh:lanes[1].userData.road,k:1.3}];   // full-screen surfaces, see quality()
 for(const b of big){b.hi=b.mesh.material;b.lo=null;}
 // In 'behind' the cliff is the whole right flank of the picture, right beside a lane: it is toned down a little more there.
 let cliffK=1;
 const toneCliff=()=>{const b=big[1];b.hi.color.setScalar(cliffK);if(b.lo)b.lo.color.setScalar(cliffK*b.k);};
 const fwd=new THREE.Vector3();
 return{
  layout(L){
   const side=L.mode==='side',key=L.mode+'|'+L.laneZ[0]+'|'+L.laneZ[1]+'|'+(L.map||'');
   // Everything below depends only on the layout mode (the camera never turns inside a mode), so a plain resize skips it.
   if(key!==laidKey){laidKey=key;
    for(let i=0;i<2;i++)lanes[i].position.z=L.laneZ[i];
    bendLanes();median.visible=!L.map||L.map==='straight';   // bent lanes run over the median strip, so it is cleared on those maps
    sideSet.visible=side;behindSet.visible=!side;
    cliff.position.set(side?-16:0,0,side?CLIFF_SIDE:CLIFF_BEHIND);   // in 'side' the low end of the ridge is slid off screen
    cliffK=side?1:.8;toneCliff();
    if(side)radar.position.set(BUNKX,4.35,27.2);else radar.position.set(17,2.85,-18.6);
    for(let i=0;i<2;i++)kerbFill[i].position.z=(i?-1:1)*(L.LZ+KERBZ);
    paintGround(L);layoutGlow(L);layoutHaze(L);
    // Shadows cover the play area plus the scenery strip that is on screen in this layout.
    if(side)fitShadow(-18,60,-18,27,12);else fitShadow(-18,60,-22,18,12);
   }
   // Fog is measured along the view axis: it starts just past the far edge of the play area and thickens behind it.
   fwd.copy(L.camTarget).sub(L.camPos).normalize();
   const T=L.camTarget,dep=(x,y,z)=>L.dist+(x-T.x)*fwd.x+(y-T.y)*fwd.y+(z-T.z)*fwd.z;   // view depth of a world point (L.dist at the camera target)
   if(side){fog.near=dep(20,0,L.LZ+5.5);fog.far=dep(20,0,L.LZ+36);fog.color.setHex(FOG_SIDE);}
   else{fog.near=dep(50.5,0,0);fog.far=dep(73,0,0);fog.color.setHex(FOG_BEHIND);}
   if(!(fog.near>1))fog.near=L.dist+6;if(!(fog.far>fog.near+5))fog.far=fog.near+30;
   scene.background.copy(fog.color);
  },
  update(dt,t,G){
   frame++;
   const u=dust.material.uniforms;u.uTime.value=t;u.uScale.value=renderer.domElement.height/(2*Math.tan(camera.fov*PI/360));
   for(let i=0;i<2;i++){pulse[i]=Math.max(0,pulse[i]-dt*1.7);const fac=G.facilities;live[i]=util.damp(live[i],fac&&fac[i]<=0?0:1,5,dt);}
   // decorative flicker: every frame at high quality, every third frame at the lowest
   if(q>0||frame%3===0)animGlow(t);
   if(q>0)radar.rotation.y=t*.7;
   for(let i=0;i<2;i++){const k=(1.08+.08*Math.sin(t*6.3+i*2))*(.22+.78*live[i]);lanes[i].userData.lampMat.color.copy(lanes[i].userData.acc).multiplyScalar(k);}
  },
  event(ev){
   if(ev.t==='spawn'&&ev.e&&(ev.e.lane===0||ev.e.lane===1))pulse[ev.e.lane]=1;
   else if(ev.t==='stage'){pulse[0]=pulse[1]=0;}
  },
  quality(nq){
   q=nq;
   // The big surfaces (ground, roads, cliff) fill the whole screen: at the lowest quality they are shaded with the cheaper
   // Lambert model, the ground uses its coarse index and the road paint is halved (pixel ratio is 1 there anyway).
   const low=nq===0;
   if(low&&!big[0].lo){for(const b of big){const m=b.hi;b.lo=new THREE.MeshLambertMaterial({map:m.map,vertexColors:m.vertexColors,flatShading:m.flatShading});b.lo.color.setScalar(b.k);}toneCliff();}   // k: makes up for the broad sheen the standard model adds on dark rough surfaces
   if(big[0].lo)for(const b of big)b.mesh.material=low?b.lo:b.hi;
   ground.geometry.setIndex(low?ground.userData.lo:ground.userData.hi);
   if(low)for(let i=0;i<2;i++){const t=lanes[i].userData.road.material.map,im=t.image;
    if(im&&im.width>1024){const c=document.createElement('canvas');c.width=1024;c.height=Math.round(im.height*1024/im.width);c.getContext('2d').drawImage(im,0,0,c.width,c.height);t.dispose();t.image=c;t.needsUpdate=true;}}
   const size=nq>=2?1536:1024,sh=sun.shadow;
   if(sh.map&&(sh.mapSize.x!==size||nq===0)){sh.map.dispose();sh.map=null;}   // also frees the shadow map when shadows are switched off
   sh.mapSize.set(size,size);
   sun.castShadow=nq>0;
   dust.geometry.setDrawRange(0,nq>0?DUST:DUST/2);
   // ...and no light shafts or rolling dust puffs (large additive quads = fill rate on a weak phone)
   if(low!==lowQ){lowQ=low;if(laidKey)layoutGlow(ctx.L);}
  }
 };
});})();
