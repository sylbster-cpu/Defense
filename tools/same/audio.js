// 소리 동일성 기록: sfx.js의 모든 소리를 구워 변형마다 해시를 찍는다(소리는 자기 난수만 쓰는 배열 계산이라 Node에서 그대로 돈다).
// node tools/same/audio.js <게임 폴더 절대 경로> > 결과.json   두 판의 결과를 cmp로 비교한다
const path=require('path'),crypto=require('crypto');require(path.resolve(process.argv[2],'sfx.js'));
const X=globalThis.RELAY_SFX||global.RELAY_SFX;const b=X.bake();const out={};
for(const n of Object.keys(b).sort())out[n]=b[n].map(x=>crypto.createHash('sha1').update(Buffer.from(x.buffer,x.byteOffset,x.byteLength)).digest('hex').slice(0,16)+':'+x.length);
out.__ambience=[crypto.createHash('sha1').update(Buffer.from(X.ambience().buffer)).digest('hex').slice(0,16)];
out.__meta=crypto.createHash('sha1').update(JSON.stringify([X.names,X.META,X.VOL,X.SR])).digest('hex').slice(0,16);
console.log(JSON.stringify(out));
