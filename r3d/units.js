/* units.js (임시 뼈대) — 지원 기체·적 */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('units',ctx=>{const {scene,pal,ENEMY}=ctx;const v=new THREE.Vector3();
 const drone=new THREE.Mesh(new THREE.OctahedronGeometry(1.3),new THREE.MeshStandardMaterial({color:pal.teal,emissive:0x113330,flatShading:true}));drone.castShadow=true;scene.add(drone);
 const pool=new Map();const geo={};for(const k in ENEMY){const d=ENEMY[k];geo[k]=new THREE.BoxGeometry(d.r*1.7,d.h,d.r*1.7);}
 return{update(dt,t,G){ctx.dronePos(v);drone.position.copy(v);drone.rotation.y=t;
   const seen=new Set();for(const e of G.enemies){if(e.hp<=0)continue;seen.add(e);let m=pool.get(e);if(!m){m=new THREE.Mesh(geo[e.type],new THREE.MeshStandardMaterial({color:pal.enemy[e.type],flatShading:true}));m.castShadow=true;scene.add(m);pool.set(e,m);}
    ctx.enemyPos(e,v);m.position.set(v.x,ENEMY[e.type].h/2,v.z);m.material.emissive.setHex(e.flash>0?0x886644:0);}
   for(const [e,m] of pool)if(!seen.has(e)){scene.remove(m);m.material.dispose();pool.delete(e);}}};
});})();
