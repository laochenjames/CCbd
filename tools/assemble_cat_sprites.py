import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, os
from PIL import Image
import frame_interp
k=np.load('key.npy'); names=['idle','busy','sleepy','yawn','poke']
CFG={ 'idle':dict(sel=[0,1,2,3,4,5],K=2,hold=()),
      'busy':dict(sel=[0,1,2,3,4,5],K=2,hold=()),
      'sleepy':dict(sel=[0,4,5],K=7,hold=()),
      'yawn':dict(sel=[0,1,2,3,4,5],K=2,hold=(0,1,3,4)),
      'poke':dict(sel=[0,1,2,3,4,5],K=2,hold=(1,2,3)) }
os.makedirs('out',exist_ok=True); meta={}
for si,n in enumerate(names):
    c=CFG[n]; keys=[k[si][i] for i in c['sel']]; N=len(keys); K=c['K']; ts=[(j+1)/(K+1) for j in range(K)]
    seq=[]
    for i in range(N):
        seq.append(keys[i])
        if i in c['hold']: seq.extend([keys[i]]*K)
        else: seq.extend(frame_interp.interpolate(keys[i],keys[(i+1)%N],ts))
    sheet=np.concatenate(seq,axis=1)
    Image.fromarray(sheet).save(f'out/{n}.webp','WEBP',quality=92,alpha_quality=100,method=6)
    meta[n]=len(seq); print(n,len(seq),sheet.shape,os.path.getsize(f'out/{n}.webp')//1024,'KB')
    h,w=keys[0].shape[:2]; cols=12; rows=(len(seq)+cols-1)//cols
    S=Image.new('RGB',(w*cols,h*rows),(32,35,40))
    for i,f in enumerate(seq):
        bg=Image.new('RGBA',(w,h),(32,35,40,255)); bg.alpha_composite(Image.fromarray(f)); S.paste(bg.convert('RGB'),((i%cols)*w,(i//cols)*h))
    S.resize((S.width//2,S.height//2),Image.LANCZOS).save(f'prev_{n}.png')
print(meta)
