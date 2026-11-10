/* hud.js (임시 뼈대) — 3D 장면 위에 겹쳐 그리는 2D 표시 */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('hud',ctx=>{const c=ctx.hud.ctx,L=ctx.L,v=new THREE.Vector3(),p={x:0,y:0,z:0};
 return{update(dt,t,G){const s=L.hudScale;c.setTransform(s,0,0,s,0,0);c.clearRect(0,0,L.w,L.h);
   for(const e of G.enemies){if(e.hp<=0)continue;ctx.enemyPos(e,v);v.y=ctx.ENEMY[e.type].h+.6;ctx.project(v,p);const w=26;c.fillStyle='#142225';c.fillRect(p.x-w/2,p.y-2,w,4);c.fillStyle='#f1c37c';c.fillRect(p.x-w/2+1,p.y-1,(w-2)*Math.max(0,e.hp/e.maxHp),2);}
   c.fillStyle='#e8ddd0';c.font='800 11px system-ui,sans-serif';c.textBaseline='top';c.fillText('작전 '+String(G.op).padStart(2,'0')+' / 05',8,6);}};
});})();
