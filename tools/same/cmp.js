// rules.js나 frames.js가 만든 두 기록을 항목별로 비교한다. 같으면 IDENTICAL과 종료 코드 0, 다르면 처음 달라진 곳을 적는다.
// node tools/same/cmp.js <이전.json> <새.json>
const fs=require('fs');const A=JSON.parse(fs.readFileSync(process.argv[2])),B=JSON.parse(fs.readFileSync(process.argv[3]));let bad=0;
const show=(k,f,a,b)=>{bad++;console.log('DIFF',k,f,JSON.stringify(a).slice(0,110),'->',JSON.stringify(b).slice(0,110));};
for(const k of new Set([...Object.keys(A),...Object.keys(B)])){const a=A[k],b=B[k];if(!a||!b){show(k,'(missing)',!!a,!!b);continue;}
 for(const f of new Set([...Object.keys(a),...Object.keys(b)])){const x=a[f],y=b[f];if(JSON.stringify(x)===JSON.stringify(y))continue;
  if(Array.isArray(x)&&Array.isArray(y)){const i=x.findIndex((v,j)=>JSON.stringify(v)!==JSON.stringify(y[j]));show(k,f+'['+(i<0?Math.min(x.length,y.length):i)+'] (len '+x.length+' vs '+y.length+')',x[i<0?x.length-1:i],y[i<0?y.length-1:i]);}
  else if(x&&y&&typeof x==='object'){for(const q of new Set([...Object.keys(x),...Object.keys(y)]))if(JSON.stringify(x[q])!==JSON.stringify(y[q]))show(k,f+'.'+q,x[q],y[q]);}
  else show(k,f,x,y);}}
console.log(bad?'DIFFERENT ('+bad+')':'IDENTICAL',Object.keys(A).length,'runs');process.exit(bad?1:0);
