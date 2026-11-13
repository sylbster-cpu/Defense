// 실행 범위 기록: 환경 변수 COVRAW=<폴더>를 주면, 이 폴더의 도구가 연 쪽마다 게임 코드(index.html의 스크립트, r3d/, sfx.js)에서 실행된 범위를 모아
// 도구가 끝날 때 <폴더>/<도구>_<PID>.json에 "한 번도 실행되지 않은 범위"를 적는다. uncovered.js가 여러 도구의 기록을 합쳐 보여 준다.
// 동일성 비교가 "실행된 코드"만 비교한다는 한계를 메우려는 것이다: 어느 도구도 실행하지 않은 채 바뀐 코드는 사람이 읽어서 확인해야 한다.
const path=require('path'),fs=require('fs');
const DIR=process.env.COVRAW?path.resolve(process.env.COVRAW):null,seen=new Map();
const keyOf=e=>{const u=e.url.split('?')[0];if(/\/r3d\/[a-z0-9_]+\.js$/.test(u))return 'r3d/'+path.basename(u);if(/\/sfx\.js$/.test(u))return 'sfx.js';if(/\.html$/.test(u)&&e.source&&e.source.length>50000)return 'index.html';return null;};
async function start(page){if(DIR)await page.coverage.startJSCoverage({resetOnNavigation:false});}
async function stop(page){if(!DIR)return;let cov;try{cov=await page.coverage.stopJSCoverage();}catch(e){return;}
 for(const e of cov){const k=keyOf(e);if(!k)continue;let s=seen.get(k);if(!s){s={source:e.source,hit:new Uint8Array(e.source.length)};seen.set(k,s);}
  if(s.source!==e.source)throw new Error('two different sources for '+k);
  // V8 gives nested ranges: a function, then the blocks inside it with their own counts. Outer first, inner last, so the innermost count wins.
  const rs=[];for(const f of e.functions)for(const r of f.ranges)rs.push(r);rs.sort((a,b)=>a.startOffset-b.startOffset||b.endOffset-a.endOffset);
  const c=new Int32Array(e.source.length);for(const r of rs)c.fill(r.count,r.startOffset,r.endOffset);
  for(let i=0;i<c.length;i++)if(c[i]>0)s.hit[i]=1;}}
if(DIR)process.on('exit',()=>{if(!seen.size)return;const out={};
 for(const [k,s] of seen){const unc=[];let a=-1;for(let i=0;i<=s.hit.length;i++){const u=i<s.hit.length&&!s.hit[i];if(u&&a<0)a=i;else if(!u&&a>=0){unc.push([a,i]);a=-1;}}out[k]={source:s.source,unc};}
 fs.mkdirSync(DIR,{recursive:true});fs.writeFileSync(path.join(DIR,path.basename(process.argv[1],'.js')+'_'+process.pid+'.json'),JSON.stringify(out));});
module.exports={start,stop,on:!!DIR};
