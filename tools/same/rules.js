// 규칙 동일성 기록: 난수를 고정한 판을 게임의 실제 loop()로 끝까지 돌리며(가짜 시계) 프레임마다의 게임 상태, 모든 이벤트·알림 글·안내 글·화면 HTML,
// DOM, 2D 캔버스 픽셀의 해시를 적는다. 훈련부터 하는 판, 안내가 나오는 판, 지는 판, 장마다 아이템을 받는 판, 설정 창을 여닫는 판이 들어 있다.
// 두 판을 각각 기록한 뒤 cmp.js로 비교한다. 결과가 같으면 규칙, 글, 2D 화면이 같다. 판 번호(BUILD)가 다르면 결과 화면의 글이 달라지므로 같은 번호로 비교한다.
// node tools/same/rules.js <게임 폴더 절대 경로> <결과.json> [진행 이름들]      COVRAW=<폴더>면 실행되지 않은 코드 범위를 남긴다(cov.js, uncovered.js)
// DENSE=1이면 2D 캔버스를 프레임마다 적는다(평소에는 5초마다). 이때 봇은 조준 아이템을 한 박자 조준한 채 두고, 아이템 안내를 받기 전에는 떨어진 아이템을 줍지 않는다
// (조준 강조 그림과 "아이템이 떨어졌습니다" 안내가 나오게 하려는 것이다). 그리는 진행만 돌리면 된다: drill,live,lose,grant,grant2,ui
// SOUND=1이면 소리를 켠 채 돌린다: 게임이 소리 장치(Web Audio)에 시키는 일을 모두 적어 그 해시를 결과에 넣는다(어떤 소리를 언제, 어떤 크기와 높이로, 어느 묶음으로 트는지,
// 배경 바람 소리, 제목 화면 음악, 음량 조절). 장치는 기록만 하는 가짜라서 실제 소리는 나지 않는다. 음악 파일을 읽어야 해서 이때는 폴더를 http로 연다. ALOG=<폴더>면 기록 전체를 남긴다.
const { chromium } = require('playwright');const path=require('path'),fs=require('fs'),http=require('http'),cov=require('./cov.js');
const dir=path.resolve(process.argv[2]),outFile=path.resolve(process.argv[3]),ONLY=process.argv[4]?process.argv[4].split(','):null,SOUND=process.env.SOUND==='1',DENSE=process.env.DENSE==='1',ALOG=process.env.ALOG;
let s=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
if(!s.includes('__t'))throw new Error('hook line not found in index.html');
const f=path.join(dir,'_same_rules_'+process.pid+'.html');fs.writeFileSync(f,s);process.on('exit',()=>{try{fs.unlinkSync(f);}catch(e){}});
const INIT=`(()=>{let now=10000,tid=1,timers=[];const raf=[];
 const mk=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 window.__mk=mk;Math.random=mk(4242);
 window.__clock={get now(){return now;},step(ms){now+=ms;for(;;){timers.sort((a,b)=>a.t-b.t||a.id-b.id);if(!timers.length||timers[0].t>now)break;timers.shift().f();}const q=raf.splice(0);for(const g of q)g(now);}};
 performance.now=()=>now;Date.now=()=>1700000000000+now;
 window.requestAnimationFrame=g=>{raf.push(g);return raf.length;};window.cancelAnimationFrame=()=>{};
 window.setTimeout=(g,ms)=>{const id=tid++;timers.push({t:now+(+ms||0),f:g,id});return id;};window.clearTimeout=id=>{timers=timers.filter(k=>k.id!==id);};
 window.setInterval=()=>{throw new Error('setInterval is not faked');};
 try{localStorage.clear();}catch(e){}
})();`;
// 기록만 하는 소리 장치. 게임이 만드는 것(묶음, 압축기, 재생기)과 시키는 일(값 넣기, 예약, 연결, 시작, 멈춤)을 순서대로 적는다. 시간은 가짜 시계의 것이다.
const AUDIO=`(()=>{let n=0,h=2166136261,count=0;const kinds={},head=[],all=${ALOG?'[]':'null'};
 const rec=e=>{const q=JSON.stringify(e);for(let i=0;i<q.length;i++){h^=q.charCodeAt(i);h=Math.imul(h,16777619);}count++;kinds[e[0]]=(kinds[e[0]]||0)+1;if(head.length<400)head.push(q);if(all)all.push(q);};
 const num=v=>typeof v==='number'?+v.toFixed(6):v,hb=new WeakMap();
 const bufId=b=>{let k=hb.get(b);if(k===undefined){const a=b.getChannelData(0),u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let x=2166136261;for(let i=0;i<u.length;i++){x^=u[i];x=Math.imul(x,16777619);}k=b.numberOfChannels+'ch:'+b.length+':'+b.sampleRate+':'+(x>>>0);hb.set(b,k);}return k;};
 const param=(name,v)=>({get value(){return v;},set value(x){v=x;rec(['value',name,num(x)]);},
  setTargetAtTime(a,b,c){rec(['target',name,num(a),num(b),num(c)]);},setValueAtTime(a,b){rec(['setAt',name,num(a),num(b)]);},
  linearRampToValueAtTime(a,b){rec(['ramp',name,num(a),num(b)]);},cancelScheduledValues(a){rec(['cancel',name,num(a)]);}});
 const node=(kind,extra)=>{const id=kind+'#'+(++n);rec(['new',id]);return Object.assign({__id:id,connect(d){rec(['connect',id,d&&d.__id||String(d)]);return d;},disconnect(){rec(['disconnect',id]);}},extra(id));};
 class Ctx{constructor(){rec(['ctx']);this.state='suspended';this.destination={__id:'out'};this.sampleRate=44100;}
  get currentTime(){return performance.now()/1000;}
  resume(){rec(['resume',this.state]);this.state='running';return Promise.resolve();}
  createGain(){return node('gain',id=>({gain:param(id+'.gain',1)}));}
  createDynamicsCompressor(){return node('comp',id=>({threshold:param(id+'.threshold',-24),knee:param(id+'.knee',30),ratio:param(id+'.ratio',12),attack:param(id+'.attack',.003),release:param(id+'.release',.25)}));}
  createBufferSource(){return node('src',id=>({buffer:null,loop:false,loopStart:0,loopEnd:0,playbackRate:param(id+'.rate',1),
   start(t){rec(['start',id,num(t),this.buffer?bufId(this.buffer):'none',this.loop,num(this.loopStart),num(this.loopEnd),num(this.playbackRate.value)]);},stop(t){rec(['stop',id,num(t)]);}}));}
  createBuffer(ch,len,sr){return new AudioBuffer({numberOfChannels:ch,length:len,sampleRate:sr});}
  decodeAudioData(d,ok,no){const p=new OfflineAudioContext(1,1,44100).decodeAudioData(d);p.then(ok,no);return p;}}
 window.AudioContext=window.webkitAudioContext=Ctx;window.__audio=()=>({n:count,h:h>>>0,kinds,head,all});
})();`;
const RUN=`window.__trace=function*(o){
 Math.random=__mk(o.seed);mute=!o.sound;best=0;Object.assign(learned,{drill:false,pulse:false,item:false,maps:{},items:{},combo:false});if(o.learned)Object.assign(learned,{drill:true,pulse:true,item:true,combo:true}),MAPS.forEach(m=>learned.maps[m.id]=true),Object.keys(ITEMS).forEach(k=>learned.items[k]=true);
 if(o.speed){prefs.speed=o.speed;applyPrefs();}
 let h=2166136261,h2=2166136261,h3=2166136261,h4=2166136261;
 const F=(x,s)=>{for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619);}return x>>>0;};
 const evN={},toasts={},coachs=[],screens=[],chapters=[],marks=[];
 const SKIP={item:1,drop:1,take:1,field:1};let inLeak=false;const l0=enemyLeak;enemyLeak=function(e){inLeak=true;l0(e);inLeak=false;};   // a comboEnd counts only when a breach broke the combo (the other kind had no listener)
 const e0=ev3;ev3=function(x){if(SKIP[x.t]||(x.t==='comboEnd'&&!inLeak)){e0(x);return;}evN[x.t]=(evN[x.t]||0)+1;let q='E';for(const k of Object.keys(x).sort()){if(k==='broken')continue;const v=x[k];if(v===null||typeof v!=='object'&&typeof v!=='function')q+=k+'='+v+';';else if(v&&typeof v.y==='number')q+=k+'.y='+v.y.toFixed(3)+';';}h2=F(h2,q);e0(x);};
 const t0=showToast;showToast=function(m,d){toasts[String(m).replace(/[0-9.]+/g,'#')]=1;h2=F(h2,'T'+m+'|'+d);t0(m,d);};
 const c0=setCoach;setCoach=function(a,b,c,d){coachs.push(a+' | '+b+' | '+c);h2=F(h2,'C'+a+'|'+b+'|'+c+'|'+d);c0(a,b,c,d);};
 const r0=renderOverlay;renderOverlay=function(c,sc){screens.push(sc+':'+c.length+':'+F(2166136261,c));h2=F(h2,'O'+sc+'|'+c);r0(c,sc);};
 const tick=o.bot==='weak'?60:24,react=o.bot==='weak'?2:1,pulseAt=o.bot==='weak'?3:2,ids=Object.keys(ITEMS),aimed=id=>typeof AIMED!=='undefined'?AIMED.includes(id):!!ITEMS[id].aim;
 let fr=0,n=0,pick=0,lastOp=0,script=o.ui?0:-1;
 const act=()=>{
  if(holdState){const need=holdState.need;if(performance.now()-holdState.t0<500)return;
   if(need==='tap')releaseHold();else if(need==='pulse')pulse();else if(need.slice(0,4)==='move')switchLane(+need.slice(4));else if(need==='pick'){if(drops.length&&takeDrop(drops[0]))releaseHold();}else throw new Error('unknown hold '+need);return;}
  if(phase==='upgrade'){const c=offeredUpgrades;chapters.push(JSON.stringify({op,score,kills,leaks,core:+core.toFixed(2),fac:facilities.map(v=>+v.toFixed(2)),stars:stars.slice(),bestCombo,bag:bag.slice(),ranks:Object.assign({},upgradeRanks),gift:stageGift,offered:c.slice()}));choose(c[(pick++)%c.length]);return;}
  if(phase!=='battle'||paused||drill)return;
  if(op!==lastOp){lastOp=op;if(o.grant){bag=[ids[(op*2-2+(o.rot||0))%ids.length],ids[(op*2-1+(o.rot||0))%ids.length]];updateControls();}}
  fr++;if(o.bot==='none')return;
  if(o.ui&&fr%400===200){$('gearBtn').click();marks.push('settings '+settingsOpen);return;}
  for(const d of drops.slice())if(DROP_LIFE-d.life>=react&&bag.length<BAG_MAX&&(!o.dense||learned.item))takeDrop(d);
  if(fr%tick===0){const c=[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-190&&!map.cover(e.lane,e.y)).reduce((a,e)=>a+TYPES[e.type].value,0));
   if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane])switchLane(1-drone.lane);
   const inR=enemies.filter(e=>e.hp>0&&(e.lane===drone.lane||map.near(e.y))&&!map.cover(e.lane,e.y)&&Math.abs(e.y-drone.y)<effects.pulseRange).length;
   if(drone.pulseCooldown<=.01&&inR>=pulseAt){if(o.ui)$('pulseBtn').click();else pulse();}
   if(bag.length&&(o.grant||c[0]+c[1]>=5||facilities[0]<60||facilities[1]<60)){const id=bag[0];
    if(aimed(id)){if(aim!==0){if(o.ui)$('itemBtn').click();else useItem(0);if(o.dense)return;}
     if(aim===0){if(id==='magnet')useAim(drone.lane,DRONE_Y-30);else{const l=c[1]>c[0]?1:0;let lead=null;for(const e of enemies)if(e.hp>0&&e.lane===l&&(!lead||e.y>lead.y))lead=e;useAim(l,lead?lead.y-20:DRONE_Y);}}}
    else if(o.ui)$('itemBtn').click();else useItem(0);}}
 };
 const dom=()=>{let q='';for(const el of document.body.children)if(el.tagName!=='SCRIPT')q+=el.outerHTML;return q.replace(/\\s*<div class="field-sticker">[^<]*<\\/div>/,'');};   // the page without its script text (and without the hidden sticker line that build 2026.11.13-1 removed)
 const uiStep=()=>{   // the settings panel: opened by the bot above, worked through here, one control per step
  if(!settingsOpen)return false;script++;const k=script%(o.sound?10:7);
  const btn=q=>{const b=document.querySelector(q);if(b)b.click();marks.push(q+' '+!!b);},rng=(id,v)=>{const el=$(id);el.value=v;el.dispatchEvent(new Event('input'));marks.push(id+'='+v);};
  if(k===1)btn('#setSpeed [data-v="2"]');else if(k===2)btn('#setSpeed [data-v="1"]');else if(k===3)btn('#setVib [data-v="0"]');else if(k===4)btn('#setVib [data-v="1"]');else if(k===5)rng('setBright',120);else if(k===6)rng('setBright',100);else if(k>=7){rng('setVol',[0,35,100][k-7]);$('setVol').dispatchEvent(new Event('change'));}else btn('#setClose');
  return true;};
 const state=()=>{let q=phase+'|'+op+'|'+wave+'|'+core.toFixed(3)+'|'+facilities[0].toFixed(3)+','+facilities[1].toFixed(3)+'|'+score+'|'+combo+'|'+kills+'|'+leaks+'|'+drone.lane+'|'+drone.x.toFixed(2)+'|'+drone.pulseCooldown.toFixed(3)+'|'+drone.moveCooldown.toFixed(3)+'|'+bag.join(',')+'|'+drops.length+'|'+aim+'|'+enemies.length+'|'+strikes.length+'|'+fieldTurrets.length+'|'+(holdState?holdState.need:'')+'|'+stageTime.toFixed(3)+'|'+speed+'|'+(paused?1:0);
  let sy=0,sh=0;for(const e of enemies){sy+=e.y*(e.lane+1);sh+=e.hp;}q+='|'+sy.toFixed(2)+'|'+sh.toFixed(2);for(const k in aid)q+='|'+(+aid[k]).toFixed(3);
  if(mines.length){let m=0;for(const z of mines)m+=z.arm;q+='|m'+m.toFixed(2);}return q;};
 if(o.sound){   // the title screen first. The music starts by itself once its file is read (in real time), so wait for it before the clock moves at all.
  for(let i=0;i<400&&!bgmSrc;i++)yield 'wait';if(!bgmSrc)throw new Error('the title music did not start '+JSON.stringify({bgm:prefs.bgm,mute,vol:prefs.vol,phase,loading:bgmLoading,buf:!!bgmBuf,ctx:!!audio}));
  const run=k=>{for(let i=0;i<k;i++)__clock.step(1000/30);};
  for(let i=0;i<600&&!SFX.ready;i++)run(1);if(!SFX.ready)throw new Error('sounds were not baked');
  $('skipFilm').click();$('title').dispatchEvent(new Event('pointerdown'));run(20);   // the film skipped (its captions follow real time)
  $('bgmBtn').click();run(40);$('bgmBtn').click();run(40);   // music off, then on
  for(const v of [0,60,100]){$('setVol').value=v;$('setVol').dispatchEvent(new Event('input'));$('setVol').dispatchEvent(new Event('change'));run(10);}}   // the volume slider: silence stops the music
 if(o.drill){leaveTitle();startDrill();}else{leaveTitle();beginRun();if(!o.live){liveRun=false;lesson=null;pulseLock=false;updateControls();}}
 const cv=document.getElementById('game'),cx=cv.getContext('2d');
 while(phase!=='finish'&&n<30*60*40){
  if(!uiStep())act();
  __clock.step(1000/30);n++;h=F(h,state());
  if(n%150===0)h4=F(h4,dom());
  if(o.draw&&n%(o.dense?1:150)===0){const d=cx.getImageData(0,0,cv.width,cv.height).data;let x=h3;for(let i=0;i<d.length;i+=7){x^=d[i];x=Math.imul(x,16777619);}h3=x>>>0;}
  if(n%1500===0)marks.push(n+':'+h+':'+h2+':'+h3+':'+h4);
  if(n%300===0)yield null;}
 for(let i=0;i<60;i++)__clock.step(1000/30);   // the finish screen settles (count-up)
 h4=F(h4,dom());
 const byId={};for(const el of document.querySelectorAll('[id]'))byId[el.id]=F(2166136261,(el.hidden?'H':'')+'|'+el.className+'|'+(el.disabled?'D':'')+'|'+(el.children.length?'':el.textContent));
 let sound;if(o.sound){intro();for(let i=0;i<60;i++)__clock.step(1000/30);leaveTitle();for(let i=0;i<40;i++)__clock.step(1000/30);sound=__audio();}   // back to the title: the music returns, then leaves again
 return JSON.stringify({frames:n,phase,op,h,h2,h3,h4,score,kills,leaks,core:+core.toFixed(3),evN,toasts:Object.keys(toasts).sort(),coachs,screens,chapters,marks,byId,canvas:[cv.width,cv.height,compactCanvas],sound});};0`;
const VARIANTS={
 drill:   {vp:[390,844],drill:true,live:true,bot:'casual',draw:true,seed:11},
 live:    {vp:[844,390],live:true,bot:'weak',draw:true,seed:22},
 fast1:   {vp:[844,390],bot:'casual',seed:33},
 fast2:   {vp:[844,390],bot:'weak',seed:44,speed:2},
 lose:    {vp:[390,844],bot:'none',draw:true,seed:55},
 grant:   {vp:[844,390],bot:'casual',grant:true,seed:66,draw:true},
 grant2:  {vp:[390,844],bot:'casual',grant:true,rot:2,seed:67,draw:true},
 grant4:  {vp:[844,390],bot:'weak',grant:true,rot:4,seed:68},
 grant6:  {vp:[390,844],bot:'casual',grant:true,rot:6,seed:69},
 grant8:  {vp:[844,390],bot:'casual',grant:true,rot:8,seed:70,speed:2},
 grant10: {vp:[390,844],bot:'weak',grant:true,rot:10,seed:71},
 ui:      {vp:[568,320],live:true,learned:true,bot:'casual',ui:true,grant:true,seed:77,draw:true},
 fast3:   {vp:[390,844],bot:'casual',seed:88},
};
const TYPES={html:'text/html; charset=utf-8',js:'text/javascript',mp3:'audio/mpeg',mp4:'video/mp4',jpg:'image/jpeg',png:'image/png',woff2:'font/woff2',json:'application/json'};
const serve=()=>new Promise(ok=>{const srv=http.createServer((q,r)=>{const p=path.join(dir,decodeURIComponent(q.url.split('?')[0]));
  if(!p.startsWith(dir)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':TYPES[p.split('.').pop()]||'application/octet-stream'});fs.createReadStream(p).pipe(r);});
 srv.listen(0,'127.0.0.1',()=>ok(srv));});
(async()=>{const b=await chromium.launch();const srv=SOUND?await serve():null,base=SOUND?'http://127.0.0.1:'+srv.address().port+'/'+path.basename(f):'file://'+f;const out={};let texts=null;const names=Object.keys(VARIANTS).filter(k=>!ONLY||ONLY.includes(k));let next=0;
 const worker=async()=>{while(next<names.length){const name=names[next++],v=VARIANTS[name];
  const c=await b.newContext({viewport:{width:v.vp[0],height:v.vp[1]},hasTouch:true});await c.addInitScript(INIT);if(SOUND)await c.addInitScript(AUDIO);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await cov.start(p);
  await p.goto(base+'?2d=1');await p.waitForTimeout(300);
  if(!texts)texts=await p.evaluate(()=>window.__t(`(()=>{const o={items:{},maps:{},cards:{},names:CARD_NAMES};for(const k in ITEMS)o.items[k]=[ITEMS[k].name,ITEMS[k].desc,ITEMS[k].col];for(const m of MAPS)o.maps[m.id]=[m.name,m.rule];const keep=Object.assign({},upgradeRanks);for(const id in BAL.card){o.cards[id]=[];for(let r=0;r<9;r++){upgradeRanks[id]=r;o.cards[id].push(cardDescription(id));}}Object.assign(upgradeRanks,keep);return JSON.stringify(o);})()`));
  await p.evaluate(r=>window.__t(r),RUN);await p.evaluate(o=>{window.__it=window.__trace(o);},Object.assign({sound:SOUND,dense:DENSE},v));
  let r=null;for(;;){const x=await p.evaluate(()=>{const x=window.__it.next();return x.done?{r:x.value}:{w:x.value};});if(x.r){r=x.r;break;}if(x.w==='wait')await p.waitForTimeout(50);}
  out[name]=JSON.parse(r);out[name].errors=errs;
  if(out[name].sound&&out[name].sound.all){fs.mkdirSync(ALOG,{recursive:true});fs.writeFileSync(path.join(ALOG,name+'.txt'),out[name].sound.all.join('\n'));delete out[name].sound.all;}
  await cov.stop(p);
  console.log(name.padEnd(6),'frames',out[name].frames,'end',out[name].phase,'op',out[name].op,'score',out[name].score,'h',out[name].h,out[name].h2,out[name].h3,out[name].h4,out[name].sound?'sound '+out[name].sound.n+' '+out[name].sound.h:'',errs.length?'ERRORS '+errs[0]:'');
  await c.close();}};
 await Promise.all([worker(),worker(),worker(),worker()]);await b.close();if(srv)srv.close();
 const sorted={};for(const k of Object.keys(VARIANTS))if(out[k])sorted[k]=out[k];if(texts)sorted.__texts=JSON.parse(texts);fs.writeFileSync(outFile,JSON.stringify(sorted,null,1));
})();
