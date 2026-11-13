// 화면(DOM) 동일성 비교: ui.js가 만든 두 기록이 어디서 다른지 적는다. 같으면 종료 코드 0.
// node tools/same/ui_diff.js <이전.json> <새.json> [요약 줄 수] [상세 줄 수]
const fs=require('fs');const A=JSON.parse(fs.readFileSync(process.argv[2])),B=JSON.parse(fs.readFileSync(process.argv[3]));
let inst=0,diffInst=0,shots=0;const lines=[],byEl={};
for(const k of new Set([...Object.keys(A),...Object.keys(B)])){inst++;const a=A[k],b=B[k];if(!a||!b){lines.push(k+': only in '+(a?'old':'new'));diffInst++;continue;}let d=0;
 if(a.shot!==b.shot){shots++;d++;lines.push(k+': screenshot differs');}
 for(const pass of ['rest','hover','active','focus']){const x=a[pass],y=b[pass];for(const el of new Set([...Object.keys(x),...Object.keys(y)])){const u=x[el],v=y[el];
  if(!u||!v){d++;const m=pass+' '+el+': only in '+(u?'old':'new');byEl[m]=(byEl[m]||0)+1;continue;}
  const what=[];if(JSON.stringify(u[0])!==JSON.stringify(v[0]))what.push('style');if(JSON.stringify(u[1])!==JSON.stringify(v[1]))what.push('::before');if(JSON.stringify(u[2])!==JSON.stringify(v[2]))what.push('::after');if(u[3]!==v[3])what.push('box '+u[3]+' -> '+v[3]);if(u[4]!==v[4])what.push('text');
  if(what.length){d++;const m=pass+' '+el+': '+what.map(w=>w.replace(/box .*/,'box')).join(',');byEl[m]=(byEl[m]||0)+1;if(lines.length<400)lines.push(k+' '+pass+' '+el+': '+what.join(', '));}}}
 if(d)diffInst++;}
console.log('instances',inst,'with differences',diffInst,'screenshots differing',shots);
const top=Object.entries(byEl).sort((p,q)=>q[1]-p[1]);for(const [m,n] of top.slice(0,+process.argv[4]||40))console.log(String(n).padStart(5),m);
if(process.argv[5])for(const l of lines.slice(0,+process.argv[5]))console.log(l);
process.exit(diffInst?1:0);
