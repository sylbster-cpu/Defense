// 품질 자동 조절 확인: ?q 없이 열고 전투를 돌리며 품질 단계와 2D 전환 여부를 기록. node adapt3d.js <게임 폴더> [WxH] [초]
const { chromium } = require('playwright');const path=require('path'),fs=require('fs');
const [dir,vp,secs]=process.argv.slice(2);const [w,h]=(vp||'700x318').split('x').map(Number);
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
const f=path.join(dir,'_ad_'+process.pid+'.html');fs.writeFileSync(f,s);
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();const logs=[];
 p.on('pageerror',e=>logs.push('ERR '+e.message));p.on('console',m=>{if(/2\.5D/.test(m.text()))logs.push(m.text());});
 await p.goto('file://'+f);await p.waitForFunction(()=>window.R3D&&window.R3D.ready&&window.__relay.active,null,{timeout:20000});
 await p.evaluate(()=>{window.__t('$(\'title\').hidden=true;mute=true;reset();newStage(3);showOverlay(false);phase="battle";');window.__fr=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>{window.__fr++;cb(t);});});
 let prev=0;for(let i=0;i<(+secs||14);i++){await p.waitForTimeout(1000);const st=await p.evaluate(()=>({fr:window.__fr,active:window.__relay.active,q:window.R3D.api.quality,phase:window.__relay.phase}));console.log(`t=${i+1}s fps=${st.fr-prev} active=${st.active} q=${st.q} phase=${st.phase}`);prev=st.fr;}
 console.log(logs.join('\n')||'(no messages)');await b.close();fs.unlinkSync(f);})();
