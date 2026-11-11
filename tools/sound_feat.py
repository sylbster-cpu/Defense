# 소리 파일의 길이, 음량, 대역 분포, 대역 고르기를 잰다(.ogg .wav .f32). 기준 게임과 비교할 때 쓴다. pip install soundfile numpy 필요.
# python3 tools/sound_feat.py "<파일 패턴>" ...  ->  JSON
# Features of a sound that can be compared between games: length, level, weight, richness, movement.
import numpy as np, soundfile as sf, sys, os, json, glob
def aweight(f):
    f2=f*f; ra=(12194**2*f2*f2)/((f2+20.6**2)*np.sqrt((f2+107.7**2)*(f2+737.9**2))*(f2+12194**2)+1e-30); return ra*10**(2.0/20)
def db(v): return 20*np.log10(max(float(v),1e-9))
def feats(x,sr):
    x=np.asarray(x,dtype=np.float64)
    if x.ndim>1: x=x.mean(axis=1)
    pk=np.abs(x).max()
    if pk<1e-6: return None
    idx=np.where(np.abs(x)>pk*10**(-40/20))[0]; x=x[idx[0]:idx[-1]+1]; n=len(x)
    env=np.abs(x); w=max(1,int(.005*sr)); e=np.convolve(env,np.ones(w)/w,'same')
    def dur(dbdown):
        i=np.where(e>e.max()*10**(-dbdown/20))[0]; return (i[-1]-i[0])/sr
    X=np.abs(np.fft.rfft(x))**2; f=np.fft.rfftfreq(n,1/sr); tot=X.sum()+1e-30
    band=lambda a,b: 100*X[(f>=a)&(f<b)].sum()/tot
    # richness: spectral entropy over 1/3-octave bands from 50 Hz to 12 kHz (0 = one band, 1 = even)
    edges=50*2**(np.arange(0,25)/3.0); bands=np.array([X[(f>=a)&(f<b)].sum() for a,b in zip(edges,edges[1:])]); p=bands/(bands.sum()+1e-30); ent=float(-(p[p>0]*np.log(p[p>0])).sum()/np.log(len(p)))
    # movement: how much the 1/3-octave spectrum changes between 20 ms frames (mean cosine distance), and how far the centroid travels
    hop=int(.02*sr); fr=[]; cen=[]
    for i in range(0,max(1,n-hop),hop):
        seg=x[i:i+2*hop]
        if len(seg)<hop: break
        S=np.abs(np.fft.rfft(seg*np.hanning(len(seg))))**2; ff=np.fft.rfftfreq(len(seg),1/sr)
        if S.sum()<1e-12: continue
        fr.append(np.array([S[(ff>=a)&(ff<b)].sum() for a,b in zip(edges,edges[1:])])); cen.append((ff*S).sum()/S.sum())
    flux=0.0
    if len(fr)>1:
        d=[1-np.dot(a,b)/(np.linalg.norm(a)*np.linalg.norm(b)+1e-30) for a,b in zip(fr,fr[1:])]; flux=float(np.mean(d))
    Xa=np.fft.irfft(np.fft.rfft(x)*aweight(f),n); m=int(.03*sr)
    if n>m: c=np.cumsum(np.concatenate([[0],Xa*Xa])); lmax=db(np.sqrt(((c[m:]-c[:-m])/m).max()))
    else: lmax=db(np.sqrt(np.mean(Xa*Xa)))
    return dict(peak=db(pk),rms=db(np.sqrt(np.mean(x*x))),crest=db(pk)-db(np.sqrt(np.mean(x*x))),d20=dur(20),d40=dur(40),lmax=lmax,
        sub=band(0,120),low=band(120,400),mid=band(400,2000),high=band(2000,24000),centroid=float((f*X).sum()/tot),entropy=ent,flux=flux,cspan=float(np.log2(max(cen)/max(1e-9,min(cen)))) if len(cen)>1 else 0.0)
if __name__=='__main__':
    out={}
    for path in sys.argv[1:]:
        for fn in sorted(glob.glob(path)):
            try:
                if fn.endswith('.f32'): x=np.fromfile(fn,dtype='<f4'); sr=int(os.environ.get('F32SR','48000'))
                else: x,sr=sf.read(fn)
                r=feats(x,sr)
                if r: out[os.path.basename(fn)]=r
            except Exception as ex: print('skip',fn,ex,file=sys.stderr)
    json.dump(out,sys.stdout)
