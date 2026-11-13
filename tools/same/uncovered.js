// cov.js가 남긴 기록들을 합쳐, 어느 도구도 실행하지 않은 코드 가운데 "바뀐 줄에 있고, 그 자리의 이전 코드에 글자 그대로 없는" 조각을 적는다.
// (= 바뀌었는데 실행으로 확인되지 않은 코드.) 여기 나온 조각은 동일성 도구가 보지 못한 것이므로 이전 판의 같은 자리와 눈으로 비교한다.
// 아무것도 나오지 않으면 바뀐 코드는 모두 한 번 이상 실행된 것이다. 바뀐 줄은 diff로 찾는다(이전 판 폴더의 같은 파일과 비교).
// node tools/same/uncovered.js <이전 판 폴더> <새 판 폴더> <COVRAW 폴더>
const path=require('path'),fs=require('fs'),{spawnSync}=require('child_process');
const oldDir=path.resolve(process.argv[2]),newDir=path.resolve(process.argv[3]),covDir=path.resolve(process.argv[4]);
const recs=fs.readdirSync(covDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(covDir,f),'utf8')));
const keys=[...new Set(recs.flatMap(r=>Object.keys(r)))].sort();let flagged=0;
const squeeze=s=>s.replace(/\s+/g,' ').trim();
// changed stretches of the new file: its line range and the old text it replaced
function hunks(oldFile,newFile){const out=[];if(!fs.existsSync(oldFile))return [{a:1,b:1e9,old:''}];
 const r=spawnSync('diff',['-U0',oldFile,newFile],{encoding:'utf8',maxBuffer:1<<28});let cur=null;
 for(const ln of r.stdout.split('\n')){const m=/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(ln);
  if(m){const n=m[2]===undefined?1:+m[2];cur={a:+m[1],b:+m[1]+n-1,old:''};out.push(cur);}else if(cur&&ln[0]==='-')cur.old+=ln.slice(1)+'\n';}
 for(const h of out)h.old=squeeze(h.old);return out;}
for(const k of keys){const have=recs.filter(r=>r[k]);const src=have[0][k].source;if(have.some(r=>r[k].source!==src))throw new Error('records of different builds are mixed: '+k);
 const hit=new Uint8Array(src.length);for(const r of have){const u=new Uint8Array(src.length);for(const [a,b] of r[k].unc)u.fill(1,a,b);for(let i=0;i<src.length;i++)if(!u[i])hit[i]=1;}
 const H=hunks(path.join(oldDir,k),path.join(newDir,k));
 // line numbers: for index.html the record holds the inline script only, so add the line the script starts on
 let line0=0;if(k==='index.html'){const html=fs.readFileSync(path.join(newDir,'index.html'),'utf8');const at=html.indexOf(src.slice(0,400));if(at<0)throw new Error('the recorded script is not the one in '+newDir);line0=html.slice(0,at).split('\n').length-1;}
 const starts=[0];for(let i=0;i<src.length;i++)if(src[i]==='\n')starts.push(i+1);
 const lineOf=off=>{let lo=0,hi=starts.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(starts[m]<=off)lo=m;else hi=m-1;}return line0+lo+1;};
 let unc=0,changedUnc=0;const out=[];
 for(let i=0;i<src.length;){if(hit[i]){i++;continue;}let j=i;while(j<src.length&&!hit[j])j++;
  const text=src.slice(i,j);unc+=text.replace(/\s/g,'').length;
  // statement by statement: a piece on a changed line that the old code of that stretch does not contain word for word
  let off=i;for(const piece of text.split(/(?<=[;{}\n])/)){const q=squeeze(piece);if(q.length>=4&&!/^\/\//.test(q)){const ln=lineOf(off+piece.search(/\S/)),h=H.find(x=>x.a<=ln&&ln<=x.b);
    if(h){changedUnc+=q.length;if(!h.old.includes(q))out.push(ln+': '+q.slice(0,220));}}off+=piece.length;}
  i=j;}
 const total=src.replace(/\s/g,'').length;flagged+=out.length;
 console.log(`== ${k}: ${(100-unc/total*100).toFixed(1)}% of the code ran (${have.length} records), ${H.length} changed stretches. never run and changed: ${out.length} pieces`);
 for(const o of out)console.log('   '+o);}
console.log(flagged?`REVIEW ${flagged} pieces by eye`:'every changed piece of code ran at least once');
