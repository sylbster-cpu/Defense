// 터치 판정 동일성 기록: 화면을 촘촘히 찍은 점마다 게임이 그 터치를 어느 전선의 어디로 보는지, 어떤 아이템을 줍는지, 어느 전선으로 옮기는지를 적는다.
// 2D·2.5D, 화면 크기 다섯, 맵 다섯. 두 판의 결과 파일을 cmp로 비교한다(바이트가 같아야 한다).
// node tools/same/touch.js <게임 폴더 절대 경로> <결과.json>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');const U=require('./states.js');
const dir=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
const PROBE=`(()=>{const res=[];const r6=v=>Math.round(v*1e4)/1e4;
 drops=[{id:1,item:'wall',lane:0,y:200,life:5},{id:2,item:'jam',lane:1,y:350,life:5},{id:3,item:'chain',lane:0,y:480,life:5}];
 for(let x=3;x<innerWidth;x+=17)for(let y=3;y<innerHeight;y+=13){const ev={clientX:x,clientY:y};const q=tapSpot(ev),d=dropUnder(ev);res.push([x,y,q.lane,r6(q.y),d?d.id:0]);}
 const keep=drops;drops=[];const lanes=[];
 for(let x=3;x<innerWidth;x+=17)for(let y=3;y<innerHeight;y+=13){drone.lane=0;drone.x=LANES[0];drone.moveCooldown=0;fieldTap({clientX:x,clientY:y});const a=drone.lane;drone.lane=1;drone.x=LANES[1];drone.moveCooldown=0;fieldTap({clientX:x,clientY:y});lanes.push(a+''+drone.lane);}
 drops=keep;return JSON.stringify({spots:res,lanes:lanes.join('')});})()`;
(async()=>{const b=await chromium.launch();const file=U.hooked(dir,'ptr');const res={};
 for(const mode of ['2d','3d'])for(const vp of ['844x390','390x844','568x320','360x640','1024x768']){const p=await U.open(b,file,vp,mode);
  await p.evaluate(()=>window.__t("__ui.base();__ui.battle(3,60);enemies=[];pattern=[[1e9,0,'runner']];nextSpawn=0;0"));
  for(const map of ['straight','pinch','detour','wave','cross']){await p.evaluate(m=>window.__t("map=MAPS.find(q=>q.id==='"+m+"');__ui.run(2);0"),map);res[mode+' '+vp+' '+map]=JSON.parse(await p.evaluate(c=>window.__t(c),PROBE));}
  if(p.__errs.length)console.log('PAGE ERRORS',mode,vp,p.__errs.slice(0,2));await p.context().close();}
 await b.close();fs.writeFileSync(out,JSON.stringify(res));console.log('pointer cases',Object.keys(res).length,'points',Object.values(res).reduce((a,v)=>a+v.spots.length,0));})();
