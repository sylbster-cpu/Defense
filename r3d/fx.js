/* fx.js (임시 뼈대) — 사격·폭발 등 순간 효과 */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('fx',ctx=>{const {scene}=ctx;const a=new THREE.Vector3(),b=new THREE.Vector3();const lines=[];
 function tracer(from,to,color){const g=new THREE.BufferGeometry().setFromPoints([from.clone(),to.clone()]);const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true}));l.userData.life=.12;scene.add(l);lines.push(l);}
 return{event(ev,G){if(ev.t==='hit'){ctx.enemyPos(ev.e,b);if(ev.src==='turret')ctx.turretPos(ev.e.lane,a);else ctx.dronePos(a);tracer(a,b,ev.src==='turret'?0xf0c47b:0x9ff0e0);}},
  update(dt){for(let i=lines.length-1;i>=0;i--){const l=lines[i];l.userData.life-=dt;l.material.opacity=Math.max(0,l.userData.life/.12);if(l.userData.life<=0){scene.remove(l);l.geometry.dispose();l.material.dispose();lines.splice(i,1);}}}};
});})();
