// 도구 공통 부분: 시험용 게임 페이지 만들기, 검사 결과 적기, 밸런스 봇의 판단.
// 도구는 모두 `node tools/<이름>.js <게임 폴더 절대 경로> ...`로 돌린다(파일로 여는 페이지라서 상대 경로는 안 된다).
const path=require('path'),fs=require('fs');

// index.html의 사본을 게임 폴더에 만들고 그 경로를 돌려준다. 사본은 window.__t(code)를 내놓는다: code는 게임 코드 안에서 eval로 돈다
// (그래서 도구는 게임의 함수와 변수를 이름으로 부른다. 게임에서 이름을 바꾸면 도구도 고쳐야 한다).
// 사본은 도구가 끝나면 지워진다. 오류로 끝나도 지워진다.
function hooked(dir,tag){
 dir=path.resolve(dir);const src=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const s=src.replace(/^reset\(\);intro\(\);updateUI\(\);requestAnimationFrame\(loop\);$/m,'window.__t=(code)=>eval(code);\nreset();intro();updateUI();requestAnimationFrame(loop);');
 if(s===src)throw new Error('hook line not found in index.html');
 const f=path.join(dir,'_'+tag+'_'+process.pid+'.html');fs.writeFileSync(f,s);
 process.on('exit',()=>{try{fs.unlinkSync(f);}catch(e){}});
 return f;
}

// 페이지 안의 게임 코드에서 code를 돌리는 함수를 돌려준다: const T=inGame(page); await T('drone.lane')
const inGame=page=>code=>page.evaluate(c=>window.__t(c),code);

// 검사 기록: ck(이름, 통과 여부, 덧붙일 값)마다 한 줄, end()가 PASS 또는 FAIL (실패 수)를 찍는다. 실패가 있으면 종료 코드 1.
function checks(){
 let bad=0;
 return{
  ck(name,ok,info){console.log((ok?'ok  ':'BAD ')+name+(info!==undefined?' '+(typeof info==='string'?info:JSON.stringify(info)):''));if(!ok)bad++;},
  fail(msg){console.log('BAD '+msg);bad++;},
  end(){console.log(bad?`FAIL (${bad})`:'PASS');if(bad)process.exitCode=1;return bad;}
 };
}

// 밸런스 봇의 판단. 게임 안에서 도는 코드 조각(문자열)이라, 도구가 자기 코드에 끼워 넣는다. 규칙이 바뀌면 여기 한 곳만 고친다.
//  threat       전선마다 기지 가까이 온 적의 무게(터널 안의 적은 보이지 않으므로 세지 않는다). 변수 c에 받아 쓴다.
//  act(n)       더 몰린 전선으로 옮기고, 과부하 범위 안에 n기 이상이면 과부하를 쓴다. c가 있어야 한다.
//  useItem      위협이 크거나 시설이 60 아래면 첫 칸의 아이템을 쓴다(조준 아이템은 앞선 적 쪽에). c가 있어야 한다.
const bot={
 threat:"[0,1].map(l=>enemies.filter(e=>e.lane===l&&e.hp>0&&e.y>DRONE_Y-190&&!map.cover(e.lane,e.y)).reduce((a,e)=>a+TYPES[e.type].value,0))",
 act:n=>"if(drone.moveCooldown<=.01&&c[1-drone.lane]>c[drone.lane])switchLane(1-drone.lane);"+
  "{const inR=enemies.filter(e=>e.hp>0&&(e.lane===drone.lane||map.near(e.y))&&!map.cover(e.lane,e.y)&&Math.abs(e.y-drone.y)<effects.pulseRange).length;if(drone.pulseCooldown<=.01&&inR>="+n+")pulse();}",
 useItem:"if(bag.length&&(c[0]+c[1]>=5||facilities[0]<60||facilities[1]<60)){const id=bag[0];"+
  "if(id==='magnet'){aim=0;useAim(drone.lane,DRONE_Y-30);}"+
  "else if(id==='orbital'){const l=c[1]>c[0]?1:0;let lead=null;for(const e of enemies)if(e.hp>0&&e.lane===l&&(!lead||e.y>lead.y))lead=e;aim=0;useAim(l,lead?lead.y-20:DRONE_Y);}"+
  "else{bag.shift();applyItem(id);}}",
};

module.exports={hooked,inGame,checks,bot};
