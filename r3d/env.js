/* env.js (임시 뼈대) — 지형·전선·조명 */
(function(){'use strict';const R3D=window.R3D,THREE=window.THREE;
R3D.register('env',ctx=>{const {scene,A,pal}=ctx;
 scene.background=new THREE.Color(pal.fog);scene.fog=new THREE.Fog(pal.fog,70,240);
 scene.add(new THREE.HemisphereLight(0x9fc4c8,0x2a2420,1.2));
 const sun=new THREE.DirectionalLight(pal.sun,3);sun.position.set(70,40,-22);sun.target.position.set(20,0,0);scene.add(sun,sun.target);
 sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);const sc=sun.shadow.camera;sc.left=-48;sc.right=48;sc.top=30;sc.bottom=-30;sc.near=10;sc.far=160;sun.shadow.bias=-.0006;sun.shadow.normalBias=.04;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:pal.ground,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const lanes=[0,1].map(i=>{const len=A.spawnX-A.leakX+4;const m=new THREE.Mesh(new THREE.BoxGeometry(len,.2,A.laneW),new THREE.MeshStandardMaterial({color:pal.road,roughness:.9}));m.position.set(A.leakX+len/2-1,.1,0);m.receiveShadow=true;const g=new THREE.Group();g.add(m);scene.add(g);return g;});
 return{layout(L){lanes[0].position.z=L.laneZ[0];lanes[1].position.z=L.laneZ[1];},quality(q){sun.castShadow=q>0;}};
});})();
