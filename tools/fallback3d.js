// 2.5D 화면이 실패했을 때 2D 화면으로 넘어가는지 확인. node fallback3d.js <게임 폴더> <출력 폴더>
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
const [dir,out]=process.argv.slice(2);
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
const f=path.join(dir,'_fb_'+process.pid+'.html');fs.writeFileSync(f,s);fs.mkdirSync(out,{recursive:true});
const state=p=>p.evaluate(()=>({active:window.__relay.active,cls:document.getElementById('field').className,gameVis:getComputedStyle(document.getElementById('game')).visibility,
  g3:document.getElementById('game3d')?getComputedStyle(document.getElementById('game3d')).display:'none',hud:document.getElementById('hud3d')?getComputedStyle(document.getElementById('hud3d')).display:'none'}));
(async()=>{const b=await chromium.launch();let bad=0;
 for(const [name,act] of [['throw',"G3.renderer.frame=()=>{throw new Error('test failure')};"],['ctxlost',"document.getElementById('game3d').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();"]]){
  for(const [w,h] of [[700,318],[390,844]]){const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
   await p.goto('file://'+f+'?q=1');await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
   await p.evaluate(()=>window.__t('$(\'title\').hidden=true;mute=true;reset();newStage(2);for(let i=0;i<300;i++)update(1/60);'));await p.waitForTimeout(500);
   const before=await state(p);
   try{await p.evaluate(a=>window.__t(a),act);}catch(e){errs.push('act: '+e.message.slice(0,120));}
   await p.waitForTimeout(1500);const after=await state(p);
   // 2D 화면에서도 터치로 이동이 되는지
   const box=await p.locator('#field').boundingBox();const l0=await p.evaluate(()=>window.__t('drone.moveCooldown=0;drone.lane'));
   if(w>h)await p.touchscreen.tap(box.x+box.width/2,box.y+box.height*(l0?0.25:0.75));else await p.touchscreen.tap(box.x+box.width*(l0?0.25:0.75),box.y+box.height/2);
   await p.waitForTimeout(300);const l1=await p.evaluate(()=>window.__t('drone.lane'));
   await p.screenshot({path:path.join(out,`fb_${name}_${w}x${h}.png`)});
   const ok=before.active&&before.g3==='block'&&before.hud==='block'&&!after.active&&after.gameVis==='visible'&&after.g3==='none'&&after.hud==='none'&&l1!==l0&&!errs.length;if(!ok)bad++;
   console.log(name,w+'x'+h,ok?'OK':'PROBLEM',JSON.stringify({before,after,tap:[l0,l1],errs}));await c.close();}}
 await b.close();fs.unlinkSync(f);console.log(bad?`FAIL (${bad})`:'PASS');})();
