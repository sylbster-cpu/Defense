// 게임 소리(sfx.js)를 모두 만들어 <출력 폴더>에 .f32(32 kHz, 모노)로 쓴다. node tools/sound_bake.js <출력 폴더>  ->  F32SR=32000 python3 tools/sound_feat.py "<출력 폴더>/*.f32"
const fs=require('fs'),path=require('path');require(require('path').resolve(__dirname,'../sfx.js'));const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const t=Date.now();const b=RELAY_SFX.bake();console.log('bake ms',Date.now()-t);let secs=0;
for(const n in b)b[n].forEach((x,i)=>{secs+=x.length/RELAY_SFX.SR;fs.writeFileSync(path.join(out,`C_${n}_${i}.f32`),Buffer.from(x.buffer));});
const a=RELAY_SFX.ambience();fs.writeFileSync(path.join(out,'C_ambience_0.f32'),Buffer.from(a.buffer));console.log('seconds of audio',secs.toFixed(1),'buffers',Object.values(b).reduce((s,v)=>s+v.length,0));
