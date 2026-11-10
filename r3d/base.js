/* base.js (임시 뼈대) — 시설·송신소·포탑 */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('base',ctx=>{const {scene,A,pal,G}=ctx;const v=new THREE.Vector3();
 const fac=[0,1].map(i=>{const m=new THREE.Mesh(new THREE.BoxGeometry(5,4,6),new THREE.MeshStandardMaterial({color:i?pal.tealDeep:pal.amberDeep,flatShading:true}));m.castShadow=m.receiveShadow=true;scene.add(m);return m;});
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(1.2,2,8,8),new THREE.MeshStandardMaterial({color:pal.metal,flatShading:true}));hub.position.set(A.hubX,4,0);hub.castShadow=true;scene.add(hub);
 const tur=[0,1].map(i=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.1,A.turretH,8),new THREE.MeshStandardMaterial({color:pal.steel,flatShading:true}));m.castShadow=true;scene.add(m);return m;});
 return{layout(L){for(let i=0;i<2;i++){fac[i].position.set(A.facX,2,L.laneZ[i]);ctx.turretPos(i,v);tur[i].position.set(v.x,A.turretH/2,v.z);}},
  update(dt,t,G){for(let i=0;i<2;i++)fac[i].material.emissive.setHex(G.facilities[i]>0?0x000000:0x330000);}};
});})();
