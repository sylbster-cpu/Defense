// Relay defence sound engine, set C. Every sound is built once from layers (transient, body, low end, mechanism, tail)
// into a sample buffer, with several variants of the frequent ones; playback then only starts buffers.
// Pure array code: runs in a browser and in Node, so the same sounds can be heard and measured.
(function(g){
const SR=32000,TAU=Math.PI*2;
function rng(seed){let x=(seed>>>0)||1;return()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
const N=sec=>Math.max(1,Math.ceil(sec*SR));
/* ---------- building blocks: each adds into `o` from time t0 ---------- */
// pitched sweep f0 -> f1 with an exponential fall of the level (down 60 dB at `dur`)
function sweep(o,t0,dur,f0,f1,amp,shape='sine',att=.002,bend=1){const s=N(t0),n=Math.min(o.length-s,N(dur));let ph=0;const k=Math.log(.001)/dur;
 for(let i=0;i<n;i++){const t=i/SR,u=Math.pow(t/dur,bend),f=f0*Math.pow(f1/f0,u);ph+=f/SR;const p=ph-Math.floor(ph);
  const w=shape==='sine'?Math.sin(TAU*p):shape==='saw'?2*p-1:shape==='square'?(p<.5?1:-1):1-4*Math.abs(p-.5);
  o[s+i]+=w*amp*Math.min(1,t/att)*Math.exp(k*t);}}
// white noise through a state-variable filter whose cutoff glides f0 -> f1
function noise(o,t0,dur,type,f0,f1,q,amp,R,att=.002,hold=0){const s=N(t0),n=Math.min(o.length-s,N(dur));let a=0,b=0;const k=Math.log(.001)/Math.max(.001,dur-hold),Q=1/q;
 for(let i=0;i<n;i++){const t=i/SR,fc=Math.min(SR*.45,f0*Math.pow(f1/f0,t/dur)),gg=Math.tan(Math.PI*fc/SR),a1=1/(1+gg*(gg+Q)),a2=gg*a1,a3=gg*a2,x=R()*2-1,v3=x-b,v1=a1*a+a2*v3,v2=b+a2*a+a3*v3;a=2*v1-a;b=2*v2-b;
  const y=type==='lp'?v2:type==='bp'?v1:x-Q*v1-v2;o[s+i]+=y*amp*Math.min(1,t/att)*(t<hold?1:Math.exp(k*(t-hold)));}}
// ringing metal: a few decaying partials, slightly detuned every time
function modal(o,t0,parts,amp,R,scale=1){const s=N(t0);for(const [f,d,a] of parts){const ff=f*scale*(1+(R()-.5)*.03),n=Math.min(o.length-s,N(d*1.2)),k=Math.log(.001)/d,ph=R()*TAU;for(let i=0;i<n;i++){const t=i/SR;o[s+i]+=Math.sin(TAU*ff*t+ph)*a*amp*Math.min(1,t/.001)*Math.exp(k*t);}}}
// crackle: single-sample clicks that thin out over time
function crackle(o,t0,dur,rate0,rate1,amp,R){const s=N(t0),n=Math.min(o.length-s,N(dur));for(let i=0;i<n;i++){const u=i/n,r=rate0*Math.pow(rate1/rate0,u);if(R()<r/SR)o[s+i]+=(R()*2-1)*amp*(1-u*.7);}}
function sat(o,drive){const c=1/Math.tanh(drive);for(let i=0;i<o.length;i++)o[i]=Math.tanh(o[i]*drive)*c;return o;}
function add(o,x,t0=0,gain=1){const s=N(t0);for(let i=0;i<x.length&&s+i<o.length;i++)o[s+i]+=x[i]*gain;return o;}
function hp1(o,fc){const c=Math.exp(-TAU*fc/SR);let y=0,px=0;for(let i=0;i<o.length;i++){const x=o[i];y=c*(y+x-px);px=x;o[i]=y;}return o;}
function lp1(o,fc){const c=1-Math.exp(-TAU*fc/SR);let y=0;for(let i=0;i<o.length;i++){y+=c*(o[i]-y);o[i]=y;}return o;}
// room: eight damped combs and four all-passes; returns only the tail (wet), as long as `sec`
const CMB=[1116,1188,1277,1356,1422,1491,1557,1617],APS=[556,441,341,225];
function room(x,sec,t60,damp=.35,pre=.012){const o=new Float32Array(N(sec)),inp=new Float32Array(o.length);add(inp,x,pre);
 for(const d0 of CMB){const d=Math.round(d0*SR/44100),line=new Float32Array(d),fb=Math.pow(10,-3*d/SR/t60);let p=0,st=0;for(let i=0;i<o.length;i++){const y=line[p];st=y*(1-damp)+st*damp;line[p]=inp[i]+st*fb;p=p+1===d?0:p+1;o[i]+=y;}}
 for(const d0 of APS){const d=Math.round(d0*SR/44100),line=new Float32Array(d);let p=0;for(let i=0;i<o.length;i++){const bo=line[p],y=bo-o[i];line[p]=o[i]+bo*.5;p=p+1===d?0:p+1;o[i]=y;}}
 for(let i=0;i<o.length;i++)o[i]*=.11;return o;}
function finish(o,peak){hp1(o,28);let m=0;for(let i=0;i<o.length;i++)m=Math.max(m,Math.abs(o[i]));const k=peak/(m||1),f=N(.02);for(let i=0;i<o.length;i++)o[i]*=k;for(let i=0;i<f;i++)o[o.length-1-i]*=i/f;return o;}
// one sound = dry layers, pushed into saturation for harmonics that a phone speaker can carry, plus the room tail
// o takes the low layers and is pushed into saturation (harmonics a phone speaker can carry); h takes the transient, noise and metal and stays clean
function build(sec,drive,tail,t60,peak,fn,R,hg=2.6){const dry=new Float32Array(N(sec)),h=new Float32Array(N(sec));fn(dry,h,R);if(drive)sat(dry,drive);add(dry,h,0,hg);const o=new Float32Array(N(sec));add(o,dry);if(tail){const w=room(dry,sec,t60);lp1(w,5200);add(o,w,0,tail);}return finish(o,peak);}
/* ---------- recipes ---------- */
const debris=(h,t0,n,span,amp,R,sc=1)=>{for(let i=0;i<n;i++)modal(h,t0+R()*span,[[900+R()*2600,.03+R()*.07,1],[2300+R()*3000,.02+R()*.04,.6]],amp*(.4+R()*.6),R,sc);};
const blast=(o,h,R,size)=>{   // size .6 small machine ... 1.7 boss: a sharp shock, the blast, a falling rumble, loose metal
 noise(h,0,.014,'hp',2200,2200,.7,.75,R,.0005);noise(h,.003,.07+.04*size,'bp',1700/size,520/size,.8,.6,R);
 sweep(o,0,.22+.22*size,230/size,48/size,1,'sine',.003,.6);sweep(o,0,.16+.1*size,460/size,120/size,.35,'tri',.002,.7);
 noise(h,.008,.34+.5*size,'lp',3400/size,180,.7,.55,R,.004);noise(o,.05,.35+.75*size,'lp',420/size,70,.9,.6*size,R,.03);noise(h,.02,.2+.3*size,'hp',1500,2600,.7,.1,R,.01);
 debris(h,.05,Math.round(3+size*6),.18+.35*size,.14,R,1/Math.sqrt(size));};
const RECIPES={
 // heavy autocannon: crack, a saturated low body, the breech cycling a moment later, a short tail
 turret:[4,1.1,2.4,.8,.62,.5,(o,h,R)=>{noise(h,0,.009,'hp',1800,1800,.7,.7,R,.0004);sweep(o,0,.16,250,82,1,'sine',.002,.55);sweep(o,0,.07,520,170,.4,'square',.001);noise(h,.002,.1,'bp',900,380,.8,.5,R);noise(h,.004,.24,'lp',2600,260,.7,.3,R);noise(h,.006,.16,'hp',2000,3200,.7,.07,R,.003);
   modal(h,.045+R()*.01,[[780,.06,1],[1310,.05,.7],[2150,.035,.5],[3240,.025,.3]],.12,R);},4.2],
 // the support drone's rapid gun. A gunshot is noise, not a note: the body is band-limited noise, and the only pitched part is a very short knock near 100 Hz.
 // (the first three candidates had one clear partial near 200 Hz carrying 67-79% of the energy, which is the sound of a tom: "tong")
 // D: a dry machine gun
 drone:[4,.8,2.6,.7,.5,.4,(o,h,R)=>{noise(h,0,.006,'hp',1800,1800,.7,.9,R,.0003);noise(h,.001,.06,'bp',900,350,.7,.55,R,.001);noise(o,.001,.1,'bp',340,170,.8,2.6,R,.001);sweep(o,0,.045,105,85,.3,'sine',.001);
   noise(h,.004,.16,'lp',2600,300,.7,.25,R);modal(h,.03+R()*.008,[[2100,.02,1],[3300,.015,.6]],.05,R);},1.5],
 // E: a heavier autocannon, more low noise and a longer tail
 drone_b:[4,.9,2.8,.8,.6,.4,(o,h,R)=>{noise(h,0,.008,'hp',1500,1500,.7,1,R,.0003);noise(h,.001,.09,'bp',600,220,.8,1,R,.001);noise(o,.001,.14,'bp',260,130,.8,2.2,R,.001);sweep(o,0,.07,92,70,.4,'sine',.001);
   noise(h,.004,.2,'lp',2400,300,.7,.3,R);modal(h,.04+R()*.01,[[1500,.025,1],[2500,.02,.6]],.05,R);},1.5],
 // F: closest to the reference games: a low body that drops fast, under a wide noise burst
 drone_c:[4,.8,2.6,.7,.5,.4,(o,h,R)=>{noise(h,0,.007,'hp',2000,2000,.7,.9,R,.0003);sweep(o,0,.06,170,72,.28,'sine',.001,.35);noise(o,.001,.09,'bp',300,150,.8,1.6,R,.001);noise(h,.001,.07,'bp',1200,400,.6,1,R,.001);
   noise(h,.004,.18,'lp',3000,300,.7,.3,R);},1.6],
 echo:[2,.6,1.6,.6,.45,.26,(o,h,R)=>{sweep(o,0,.07,520,210,1,'sine',.002,.6);sweep(h,0,.06,1560,640,.3,'tri',.001);sweep(h,.012,.06,1640,700,.2,'tri',.001);noise(h,0,.06,'bp',2200,900,1.1,.35,R);noise(h,.002,.1,'lp',2400,400,.7,.15,R);},2.2],
 // rounds landing on armour
 hit_light:[4,.3,0,.3,.25,.2,(o,h,R)=>{noise(h,0,.004,'hp',2500,2500,.7,.8,R,.0003);modal(h,0,[[1850,.035,1],[2900,.03,.7],[4300,.02,.4]],.5,R,.85+R()*.3);sweep(h,0,.04,300,140,.5,'sine',.001);noise(h,.001,.03,'bp',1200,700,1,.3,R);},1],
 hit_heavy:[4,.4,1.8,.35,.3,.3,(o,h,R)=>{noise(h,0,.006,'hp',1500,1500,.7,.6,R,.0004);sweep(o,0,.09,210,85,1,'sine',.0015,.6);modal(h,0,[[610,.07,1],[960,.06,.7],[1520,.04,.5],[2380,.03,.3]],.3,R,.85+R()*.3);noise(h,.002,.08,'bp',1000,420,.9,.4,R);}],
 kill_runner:[3,1.2,2.2,.7,.72,.5,(o,h,R)=>blast(o,h,R,.62)],
 kill_grunt:[3,1.7,2.4,.7,.98,.62,(o,h,R)=>blast(o,h,R,.9)],
 kill_brute:[2,2.4,2.6,.75,1.35,.78,(o,h,R)=>blast(o,h,R,1.3)],
 // the boss goes the way it is drawn: first blast, five pops, the big one half a second in
 kill_boss:[1,3.2,2.6,.6,1.4,.95,(o,h,R)=>{const a=new Float32Array(N(1)),ah=new Float32Array(N(1));blast(a,ah,R,1.1);add(o,a,0,.6);add(h,ah,0,.6);for(let i=0;i<5;i++){const p=new Float32Array(N(.5)),ph=new Float32Array(N(.5));blast(p,ph,R,.5+R()*.2);add(o,p,.07+i*.085,.3+i*.03);add(h,ph,.07+i*.085,.3+i*.03);}
   const b=new Float32Array(N(2.4)),bh=new Float32Array(N(2.4));blast(b,bh,R,1.7);add(o,b,.5,1);add(h,bh,.5,1);sweep(o,.5,1.6,95,26,.9,'sine',.004,.5);noise(o,.55,2.2,'lp',300,50,.8,.5,R,.1);}],
 // overload: a crack, a rectified electric buzz, the thump, the ring running outward, sparks dying away
 pulse:[2,2.0,2.2,.5,.9,.92,(o,h,R)=>{noise(h,0,.02,'hp',2000,2000,.7,.8,R,.0004);sweep(o,0,.42,150,44,1,'sine',.002,.5);
   const z=new Float32Array(N(.5));sweep(z,0,.5,112,96,1,'saw',.002);sweep(z,0,.5,224,190,.6,'square',.002);sweep(z,0,.45,336,300,.4,'saw',.002);for(let i=0;i<z.length;i++){const t=i/SR;z[i]=Math.abs(z[i])*(.55+.45*Math.sign(Math.sin(TAU*52*t)))*(.6+.4*R());}hp1(z,180);add(h,z,.005,.5);
   noise(h,.02,.6,'bp',3400,420,1.4,.55,R,.02);noise(h,.01,.35,'lp',2000,220,.7,.45,R);crackle(h,.08,1.3,1200,30,.45,R);modal(h,.03,[[1240,.18,1],[1870,.14,.7],[2790,.1,.5]],.1,R);},3.4],
 // a machine slams through the line: structure ringing under a two-note klaxon
 leak:[1,1.5,2,.45,.8,.8,(o,h,R)=>{noise(h,0,.01,'hp',1500,1500,.7,.7,R,.0004);sweep(o,0,.3,170,58,1,'sine',.002,.55);noise(h,.003,.28,'lp',1800,200,.8,.5,R);modal(h,.005,[[212,.5,1],[347,.42,.8],[523,.3,.6],[887,.2,.4],[1410,.12,.25]],.25,R);
   for(const [t,f] of [[.06,940],[.24,705]]){sweep(h,t,.2,f,f*.985,.22,'saw',.004,1);sweep(h,t,.2,f*1.5,f*1.48,.1,'square',.004,1);}},3.2],
 facdown:[1,3.0,2.4,.6,1.5,1,(o,h,R)=>{const b=new Float32Array(N(2.4)),bh=new Float32Array(N(2.4));blast(b,bh,R,1.5);add(o,b,0,1);add(h,bh,0,1);sweep(h,.05,1.5,520,38,.2,'saw',.02,1.6);modal(o,.02,[[96,1.2,1],[151,1.0,.8],[233,.8,.6],[410,.5,.4]],.35,R);
   for(const [i,f] of [[0,880],[1,660],[2,440]]){sweep(h,.12+i*.2,.2,f,f*.98,.2,'saw',.004,1);sweep(h,.12+i*.2,.2,f*1.5,f*1.47,.09,'square',.004,1);}
   for(let i=0;i<4;i++){const p=new Float32Array(N(.5)),ph=new Float32Array(N(.5));blast(p,ph,R,.55);add(o,p,.14+i*.13,.28);add(h,ph,.14+i*.13,.28);}}],
 // a horn that a phone can carry: low reeds pushed into saturation, twice
 boss_warn:[1,2.2,3,.5,1.3,.8,(o,h,R)=>{for(const t of [0,.48]){for(const [f,a] of [[73.4,1],[110,.8],[146.8,.6],[220.5,.4]]){const x=new Float32Array(N(.42));sweep(x,0,.42,f,f*.97,a,'saw',.03,1.4);for(let i=0;i<x.length;i++){const u=i/x.length;x[i]*=Math.min(1,(1-u)*6);}add(o,x,t,.5);}noise(h,t,.4,'bp',620,540,2.2,.2,R,.03,.3);noise(h,t,.38,'hp',1800,1800,.7,.03,R,.03,.3);}},3.2],
 surge_warn:[1,1.0,2,.4,.6,.6,(o,h,R)=>{for(const [t,f] of [[0,587],[.13,784]]){sweep(h,t,.16,f,f*.99,.5,'saw',.003,1);sweep(h,t,.16,f*2,f*1.98,.2,'square',.003,1);sweep(o,t,.14,f*.5,f*.5,.5,'sine',.003,1);}},1.6],
 // the drone crossing: a thruster burst and air
 move:[2,.9,1.6,.45,.5,.36,(o,h,R)=>{noise(h,0,.3,'bp',420,1500,1.4,.9,R,.03);noise(h,.02,.34,'lp',1400,300,.8,.5,R,.04);noise(h,.02,.25,'hp',2200,3000,.7,.06,R,.04);sweep(o,0,.26,150,260,.5,'saw',.03,1);sweep(o,0,.24,95,62,.6,'sine',.02);},1.8],
 item_get:[1,1.4,0,.5,1.0,.45,(o,h,R)=>{modal(h,0,[[880,.7,1],[1320,.6,.7],[1760,.45,.4],[2640,.3,.25]],.5,R);modal(h,.11,[[1320,.8,1],[1980,.6,.6],[2640,.4,.35]],.5,R);sweep(h,0,.12,220,160,.4,'sine',.002);noise(h,0,.01,'hp',3000,3000,.7,.3,R);},1],
 item_use:[1,1.2,1.8,.5,.8,.6,(o,h,R)=>{sweep(h,0,.22,240,880,.3,'saw',.01,1.3);sweep(o,0,.2,120,60,.8,'sine',.003);noise(h,.16,.25,'bp',1800,700,1.2,.5,R,.005);sweep(o,.18,.3,170,62,1,'sine',.002,.5);modal(h,.18,[[1175,.3,1],[1760,.22,.6]],.2,R);},2.6],
 upgrade:[1,1.8,1.4,.55,1.2,.55,(o,h,R)=>{sweep(o,0,.25,130,55,.9,'sine',.003,.5);for(const [i,f] of [[0,523.3],[1,659.3],[2,784]])modal(h,.02+i*.09,[[f,.9,1],[f*2,.6,.4],[f*3.01,.35,.2]],.4,R);noise(h,0,.012,'hp',2500,2500,.7,.3,R);},1],
 win:[1,3.2,1.4,.6,1.8,.7,(o,h,R)=>{for(const [i,f] of [[0,392],[1,523.3],[2,659.3],[3,784],[4,1046.5]]){modal(h,i*.14,[[f,1.4,1],[f*2,1,.45],[f*3,.6,.2]],.4,R);sweep(o,i*.14,.5,f*.5,f*.5,.25,'saw',.02,1);}sweep(o,0,.6,98,49,.9,'sine',.004,.5);sweep(o,.56,1.6,65.4,65.4,.5,'saw',.05,1.2);},1],
 lose:[1,3.4,2.2,.65,2.2,.75,(o,h,R)=>{for(const [i,f] of [[0,392],[1,311.1],[2,261.6],[3,196]]){sweep(h,i*.3,.75,f,f*.94,.35,'saw',.02,1.2);sweep(o,i*.3,.75,f*.5,f*.47,.5,'sine',.02,1.2);}sweep(o,.9,2.2,82,31,1,'sine',.05,.8);noise(h,.9,2.3,'lp',700,80,.8,.4,R,.2);},2.4],
};
// [variants, seconds, drive, tail level, tail length, peak, layers]
const META={   // bus: bed = frequent fire that dips under big sounds. duck = seconds the bed stays down. pitch = spread per play (the reference games use 0.9 - 1.1 for turrets)
 turret:{bus:'bed',pitch:.07},drone:{bus:'bed',pitch:.07},drone_b:{bus:'bed',pitch:.07},drone_c:{bus:'bed',pitch:.07},echo:{bus:'bed',pitch:.07},hit_light:{bus:'bed',pitch:.12},hit_heavy:{bus:'bed',pitch:.1},
 kill_runner:{pitch:.08},kill_grunt:{pitch:.07},kill_brute:{pitch:.05},kill_boss:{duck:1.6},pulse:{pitch:.03,duck:.7},leak:{duck:.6},facdown:{duck:1.6},boss_warn:{duck:1},surge_warn:{},move:{pitch:.05},item_get:{},item_use:{},upgrade:{},win:{},lose:{},
};
function bake(only){const out={};for(const name in RECIPES){if(only&&!only.includes(name))continue;const [k,sec,drive,tail,t60,peak,fn,hg]=RECIPES[name];out[name]=[];for(let v=0;v<k;v++)out[name].push(build(sec,drive,tail,t60,peak,fn,rng(977*(v+1)+name.length*131+name.charCodeAt(0)*17),hg));}return out;}
// wind over the base and the hum of the relay, as a loop that joins without a seam
function ambience(sec=6){const R=rng(4242),n=N(sec),x=new Float32Array(n+N(1));noise(x,0,sec+1,'bp',380,380,.6,1,R,.3,sec+1);const y=new Float32Array(x.length);noise(y,0,sec+1,'lp',140,140,.7,1,R,.3,sec+1);
 for(let i=0;i<x.length;i++){const t=i/SR;x[i]=x[i]*(.55+.45*Math.sin(TAU*t/sec*1+1))*(.7+.3*Math.sin(TAU*t/sec*3+2))+y[i]*.9+Math.sin(TAU*55*t)*.05+Math.sin(TAU*110*t)*.03+Math.sin(TAU*165.3*t)*.012;}
 const o=new Float32Array(n),f=N(1);for(let i=0;i<n;i++)o[i]=x[i];for(let i=0;i<f;i++){const u=i/f;o[i]=o[i]*u+x[n+i]*(1-u);}let m=0;for(let i=0;i<n;i++)m=Math.max(m,Math.abs(o[i]));for(let i=0;i<n;i++)o[i]*=.5/m;return o;}
// playback level of each sound: sets the order of loudness (collapse and overload on top, the frequent fire at the bottom)
const VOL={"facdown":0.825,"kill_boss":1.0,"pulse":0.835,"leak":0.855,"boss_warn":0.632,"kill_brute":0.68,"kill_grunt":0.621,"surge_warn":0.67,"kill_runner":0.554,"item_get":0.265,"upgrade":0.39,"item_use":0.461,"win":0.533,"lose":0.883,"turret":0.666,"move":0.483,"drone":0.437,"echo":0.443,"hit_heavy":0.664,"hit_light":0.686,"drone_b":0.714,"drone_c":0.693};
g.RELAY_SFX={SR,bake,ambience,META,VOL,names:Object.keys(RECIPES)};
})(typeof window!=='undefined'?window:globalThis);
