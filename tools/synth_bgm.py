# 시작 화면 음악을 합성한다. 라단조, 96 BPM, 8마디(20초)가 정확히 이어지도록 모든 처리를 원형(주기)으로 한다.
import numpy as np, wave, sys
SR=44100;BPM=96;BEAT=60/BPM;BAR=4*BEAT;BARS=8;N=int(round(BARS*BAR*SR));T=N/SR
rng=np.random.default_rng(7)
def hz(m):return 440*2**((m-69)/12)
def place(buf,sig,t0):
    i=int(round(t0*SR))%N;idx=(i+np.arange(len(sig)))%N;np.add.at(buf,idx,sig)
def env(n,a,d,s=0.0,r=0.05,hold=None):
    t=np.arange(n)/SR;e=np.minimum(1,t/max(a,1e-4))*np.where(t<a,1,np.maximum(s,np.exp(-(t-a)/max(d,1e-4))))
    rel=np.clip((n/SR-t)/r,0,1);return e*rel
def filt(x,lo=None,hi=None,order=2):
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);H=np.ones_like(f)
    if hi:H*=1/np.sqrt(1+(f/hi)**(2*order))
    if lo:H*=1/np.sqrt(1+(lo/np.maximum(f,1e-3))**(2*order))
    return np.fft.irfft(X*H,len(x))
def saw(f,n,ph=0):
    t=np.arange(n)/SR;x=np.zeros(n)
    for k in range(1,int(min(40,SR/2/f))+1):x+=np.sin(2*np.pi*k*f*t+ph*k)/k
    return x*2/np.pi
def tri(f,n,vib=0):
    t=np.arange(n)/SR;ph=2*np.pi*f*t+vib*np.sin(2*np.pi*5.2*t);x=np.zeros(n)
    for k in range(0,6):m=2*k+1;x+=(-1)**k*np.sin(m*ph)/m**2
    return x*8/np.pi**2
# 화음: Dm Dm Bb Bb F C Gm A  (근음, 구성음 MIDI)
CH=[(38,[62,65,69]),(38,[62,65,69]),(34,[58,62,65]),(34,[58,62,65]),(41,[60,65,69]),(36,[60,64,67]),(43,[58,62,67]),(33,[57,61,64])]
L=np.zeros(N);R=np.zeros(N)
# 1. 패드
pad=[np.zeros(N),np.zeros(N)]
for b,(root,notes) in enumerate(CH):
    n=int((BAR+1.2)*SR);e=env(n,.7,9,.75,1.1)
    for j,m in enumerate(notes+[notes[0]-12]):
        for k,det in enumerate((-.07,.0,.08)):
            s=saw(hz(m+det),n,ph=rng.uniform(0,6.28))*e*(.16 if j<3 else .2)
            place(pad[k%2 if k!=1 else j%2],s,b*BAR-.25)
for k in (0,1):pad[k]=filt(pad[k],lo=120,hi=1500,order=2)
# 느린 떨림
lfo=.82+.18*np.sin(2*np.pi*np.arange(N)/SR*(2/T)+1.0)
L+=pad[0]*lfo*.9;R+=pad[1]*lfo[::-1]*.9
# 2. 베이스 (3-3-2)
bass=np.zeros(N)
for b,(root,_) in enumerate(CH):
    for st,ln in ((0,1.5),(1.5,1.5),(3,1)):
        n=int(ln*BEAT*SR);t=np.arange(n)/SR;f=hz(root)
        s=(np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*2*f*t)+.18*saw(f,n))*env(n,.008,.45,.25,.06)
        place(bass,s*.5,b*BAR+st*BEAT)
bass=filt(bass,hi=420,order=2);L+=bass;R+=bass
# 3. 16분 오스티나토
arp=[np.zeros(N),np.zeros(N)];pat=[0,1,2,1,0,2,1,2,0,1,2,1,2,1,0,1]
for b,(root,notes) in enumerate(CH):
    for i in range(16):
        m=notes[pat[i]]+(12 if i%8 in (2,5) else 0);n=int(.3*SR)
        s=tri(hz(m),n)*env(n,.004,.09,0,.03)*(.2 if i%4==0 else .13)
        place(arp[i%2],s,b*BAR+i*BEAT/4)
for k in (0,1):arp[k]=filt(arp[k],lo=300,hi=3200,order=1)
# 4. 선율
lead=np.zeros(N)
MEL=[[(74,1.5),(69,.5),(74,2)],[(77,3),(76,1)],[(74,2),(70,2)],[(77,1.5),(74,.5),(70,2)],[(72,2),(77,2)],[(76,3),(79,1)],[(79,1.5),(82,.5),(81,2)],[(81,1),(79,1),(76,1),(73,1)]]
for b,bar in enumerate(MEL):
    t0=b*BAR
    for m,ln in bar:
        n=int((ln*BEAT+.25)*SR);s=tri(hz(m),n,vib=.012*2*np.pi)*env(n,.03,2.2,.5,.22)*.2+np.sin(2*np.pi*hz(m)*2*np.arange(n)/SR)*env(n,.02,.5,.0,.2)*.03
        place(lead,s,t0);t0+=ln*BEAT
lead=filt(lead,lo=250,hi=4200,order=1)
# 원형 지연 (점8분, 좌우 번갈아)
def delay(x,d,fb,n=5):
    y=[np.zeros(N),np.zeros(N)];s=int(round(d*SR))
    for k in range(1,n+1):y[k%2]+=np.roll(x,s*k)*fb**k
    return y
dl=delay(lead,BEAT*.75,.42);da=delay(arp[0]+arp[1],BEAT*.75,.3,3)
L+=arp[0]+lead*.9+dl[0]*.8+da[0]*.6;R+=arp[1]+lead*.9+dl[1]*.8+da[1]*.6
# 5. 타악기
dr=[np.zeros(N),np.zeros(N)]
def kick():
    n=int(.32*SR);t=np.arange(n)/SR;f=48+110*np.exp(-t/.035);return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/.11)*.95
def snare(v=1):
    n=int(.2*SR);t=np.arange(n)/SR;return (rng.standard_normal(n)*np.exp(-t/.055)*.5+np.sin(2*np.pi*185*t)*np.exp(-t/.05)*.4)*v
def hat(v=1):
    n=int(.05*SR);t=np.arange(n)/SR;return rng.standard_normal(n)*np.exp(-t/.012)*v
kk=np.zeros(N);sn=np.zeros(N);hh=np.zeros(N)
for b in range(BARS):
    for bt in (0,2):place(kk,kick(),b*BAR+bt*BEAT)
    if b%2==1:place(kk,kick()*.8,b*BAR+3.5*BEAT)
    for bt in (1,3):place(sn,snare(.55),b*BAR+bt*BEAT)
    if b%4==3:
        for i,v in enumerate((.18,.24,.3,.38)):place(sn,snare(v),b*BAR+(3+i/4)*BEAT)   # 마디 끝 연타
    for i in range(8):place(hh,hat(.5 if i%2 else .28),b*BAR+i*BEAT/2)
sn=filt(sn,lo=160,hi=6000,order=1);hh=filt(hh,lo=6500,order=2)
L+=kk*.8+sn*.5+hh*.16;R+=kk*.8+sn*.5+hh*.2
# 6. 마지막 마디의 상승 잡음 (반복 지점으로 이어짐)
n=int(BAR*SR);t=np.arange(n)/SR;sw=filt(np.pad(rng.standard_normal(n)*(t/BAR)**3,(N-n,0)),lo=900,hi=5000,order=1)*.1
L+=sw;R+=np.roll(sw,37)
# 잔향 (원형 합성곱)
ir=np.zeros(N);m=int(1.8*SR);ir[:m]=rng.standard_normal(m)*np.exp(-np.arange(m)/SR/.42);ir=filt(ir,lo=200,hi=5000,order=1);ir/=np.sqrt((ir**2).sum())
def rev(x):return np.fft.irfft(np.fft.rfft(x)*np.fft.rfft(ir),N)
wl=rev(L-kk*.8-bass);wr=rev(R-kk*.8-bass);L+=wl*.24;R+=np.roll(wr,211)*.24
# 마무리
st=np.stack([L,R]);st=filt(st[0],lo=28),filt(st[1],lo=28);st=np.stack(st);pk=np.abs(st).max();st=np.tanh(st/pk*1.6)/np.tanh(1.6)*.89
print('loop seconds',T,'peak',float(np.abs(st).max()),'rms',float(np.sqrt((st**2).mean())),'seam jump',float(np.abs(st[:,0]-st[:,-1]).max()))
# 파일: 반복 구간이 두 번 들어가도록 넉넉히 (재생은 3초~23초를 되풀이)
reps=int(np.ceil(24.5/T))+1;out=np.tile(st,reps)[:,:int(24.5*SR)].copy();fi=int(.6*SR);out[:,:fi]*=np.linspace(0,1,fi)**1.5
pcm=(out.T*32767).astype('<i2')
w=wave.open(sys.argv[1],'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes());w.close()
