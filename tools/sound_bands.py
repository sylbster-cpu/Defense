# 소리를 1/3 옥타브 25대역으로 나눠 대역별 크기, 버티는 시간, 꺼지는 시간, 저음이 음인지 잡음인지를 잰다. 기체 사격음 K를 만들 때 I를 이것으로 쟀다.
# python3 tools/sound_bands.py <32 kHz 모노 .f32 파일>
import numpy as np
SR=32000
FC=50*2**(np.arange(0,25)/3.0)            # third-octave centres 50 Hz .. 12.7 kHz
def bandsig(x,fc):
    n=len(x);X=np.fft.rfft(x);f=np.fft.rfftfreq(n,1/SR);lo,hi=fc/2**(1/6),fc*2**(1/6)
    m=np.clip((f-lo*.94)/(lo*.06+1e-9),0,1)*np.clip((hi*1.06-f)/(hi*.06+1e-9),0,1);return np.fft.irfft(X*m,n)
def env(y,fc,hop=.002):
    w=int(max(.004,2.5/fc)*SR);h=int(hop*SR);c=np.cumsum(np.concatenate([[0],y*y]));idx=np.arange(0,len(y)-w,h);return np.sqrt((c[idx+w]-c[idx])/w),(idx+w/2)/SR
def analyse(x):
    out=[]
    for fc in FC:
        e,t=env(bandsig(x,fc),fc);out.append((fc,e,t))
    return out
if __name__=='__main__':
    import sys
    x=np.fromfile(sys.argv[1],dtype='<f4').astype(float);A=analyse(x);tot=sum((e**2).sum() for _,e,_ in A)
    print('band Hz   peak dB  at ms   time above -10dB (ms)   -10 to -30 dB takes (ms)   energy %')
    for fc,e,t in A:
        d=20*np.log10(e/ (max(a.max() for _,a,_ in A))+1e-9);k=d.argmax();pk=d[k]
        ab=np.where(d>pk-10)[0];t10=t[ab[-1]]-t[ab[0]];b30=np.where(d[ab[-1]:]<pk-30)[0];t30=(t[ab[-1]+b30[0]]-t[ab[-1]]) if len(b30) else float('nan')
        print(f"{fc:7.0f}  {pk:6.1f}  {1000*t[k]:5.0f}   {1000*t10:6.0f}                 {1000*t30:6.0f}                   {100*(e**2).sum()/tot:5.1f}")
    # is the low end a tone or noise? autocorrelation of the part below 300 Hz, first 200 ms
    n=len(x);X=np.fft.rfft(x);f=np.fft.rfftfreq(n,1/SR);lo=np.fft.irfft(X*(f<300),n)[:int(.25*SR)];lo=lo-lo.mean();ac=np.correlate(lo,lo,'full')[len(lo)-1:];ac/=ac[0]
    lag=np.arange(len(ac))/SR;m=(lag>1/250)&(lag<1/50);k=np.argmax(ac[m]);print('low end (<300 Hz): strongest repeat at %.0f Hz, strength %.2f (1 = a pure tone, 0 = noise)'%(1/lag[m][k],ac[m][k]))
