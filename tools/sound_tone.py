# 소리가 얼마나 또렷한 음인지 잰다. 한 음에 에너지가 몰리면 "통" 하고 튀는 소리가 된다. python3 tools/sound_tone.py "<파일 패턴>" ...
# How pitched a sound is. "통" (a tom, a bounce) is a clear tone whose pitch slides; a gunshot is mostly noise.
# tone = how far the strongest partial stands above the rest of the spectrum (dB), over the loud part of the sound: noise is about 7, a clear tone 20 or more.
# glide = how far that partial moves in pitch during the sound (octaves). share = part of the energy carried by that one partial.
import numpy as np, soundfile as sf, sys, os, glob, json
def load(fn):
    if fn.endswith('.f32'): return np.fromfile(fn,dtype='<f4').astype(float), int(os.environ.get('F32SR','48000'))
    x,sr=sf.read(fn); return (x.mean(axis=1) if x.ndim>1 else x).astype(float), sr
def tone(x,sr):
    pk=np.abs(x).max()
    if pk<1e-6: return None
    i0=np.argmax(np.abs(x)>pk*.1); x=x[i0:]; n=int(.032*sr); hop=n//4; w=np.hanning(n); fr=[]
    for i in range(0,max(1,len(x)-n),hop):
        seg=x[i:i+n]
        if len(seg)<n: break
        P=np.abs(np.fft.rfft(seg*w))**2; f=np.fft.rfftfreq(n,1/sr); m=(f>=70)&(f<=2500); Pm=P[m]; E=Pm.sum()
        if E<=0: continue
        k=Pm.argmax(); fr.append((E,10*np.log10(Pm.max()/Pm.mean()),f[m][k],Pm[max(0,k-1):k+2].sum()/E))
    if not fr: return None
    fr=np.array(fr); keep=fr[:,0]>fr[:,0].max()*10**(-20/10); g=fr[keep]; wgt=g[:,0]/g[:,0].sum()
    return dict(tone=float((g[:,1]*wgt).sum()),share=float((g[:,3]*wgt).sum()),glide=float(np.log2(g[:,2].max()/max(1e-9,g[:,2].min()))),f0=float(g[0,2]),f1=float(g[-1,2]))
if __name__=='__main__':
    for pat in sys.argv[1:]:
        for fn in sorted(glob.glob(pat)):
            x,sr=load(fn); r=tone(x,sr)
            if r: print(f"{os.path.basename(fn):28s} tone {r['tone']:5.1f} dB  share {100*r['share']:3.0f}%  glide {r['glide']:.2f} oct  {r['f0']:.0f}->{r['f1']:.0f} Hz")
