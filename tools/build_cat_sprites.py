import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import matte_cat as M
import frame_interp

OUT='out'; os.makedirs(OUT,exist_ok=True)
EDGES=[290,548,808,1067,1328,1590,1850]   # 原图里每格的左右边界（x）
CELL=[(EDGES[i]-M.X0, EDGES[i+1]-M.X0) for i in range(6)]
THRESH=24; PAD=10
rows={k:M.matte(k) for k in M.BANDS}

def cell_info(a,lo,hi):
    sub=a[:,lo:hi].astype(float); sub[sub<=THRESH]=0
    cx=lo+(sub.sum(0)*np.arange(hi-lo)).sum()/sub.sum()
    ys=np.where((sub>0).any(1))[0]; xs=np.where((sub>0).any(0))[0]
    return dict(lo=lo,hi=hi,cx=cx,top=ys.min(),bottom=ys.max(),x0=lo+xs.min(),x1=lo+xs.max())

# ---- 在用页面：原图只有第 1 帧有笔记本。把它抠出来，按每只猫的位置贴到其余帧（笔记本在猫前面，与第 1 帧一致）----
w=rows['working']; y0,y1=M.BANDS['working']
src=M.im[y0:y1,M.X0:].astype(int); mn=src.min(2); sat=src.max(2)-mn
lo,hi=CELL[0]
neutral=(sat<24)&(mn<215); neutral[:,hi:]=False
lab,n=ndi.label(neutral,structure=M.S8)
sizes=ndi.sum(neutral,lab,range(1,n+1)); big=int(np.argmax(sizes))+1
lap=ndi.binary_fill_holes(ndi.binary_closing(lab==big,structure=M.S8,iterations=2))
lap=ndi.binary_opening(lap,structure=M.S8)
lap_alpha=np.clip(ndi.distance_transform_edt(lap)/1.6,0,1)
lap_rgba=np.dstack([src.astype(np.uint8),(lap_alpha*255).astype(np.uint8)])
a_cat=w[...,3].astype(float).copy(); a_cat[lap&(lap_alpha>0.5)]=0   # 第 1 帧里去掉笔记本后"猫自己"的位置
inf1=cell_info(a_cat,lo,hi); base_cx=inf1['cx']; base_bot=inf1['bottom']
def shifted(img,dx,dy):
    out=np.zeros_like(img); H,W=img.shape[:2]
    ys0,ys1=max(0,dy),min(H,H+dy); xs0,xs1=max(0,dx),min(W,W+dx)
    out[ys0:ys1,xs0:xs1]=img[ys0-dy:ys1-dy,xs0-dx:xs1-dx]; return out
res=np.zeros_like(w)
def over(base,top):
    B=Image.fromarray(base); B.alpha_composite(Image.fromarray(top)); return np.array(B)
for i,(l,h) in enumerate(CELL):
    cell=np.zeros_like(w); cell[:,l:h]=w[:,l:h]
    if i>0:
        inf=cell_info(w[...,3],l,h)
        dx=int(round(inf['cx']-base_cx)); dy=int(round(inf['bottom']-base_bot))
        cell=over(cell,shifted(lap_rgba,dx,dy))
    res=over(res,cell)
rows['working']=res

# ---- 切格、统一尺寸与地面线 ----
info={}
for k,a in rows.items():
    al=a[...,3]; fr=[cell_info(al,lo,hi) for lo,hi in CELL]
    import statistics
    ground=statistics.median(f['bottom'] for f in fr)
    info[k]=dict(a=a,fr=fr,ground=ground)
half=max(max(f['cx']-f['x0'],f['x1']-f['cx']) for v in info.values() for f in v['fr'])+PAD
up=max(v['ground']-f['top'] for v in info.values() for f in v['fr'])+PAD
down=max(f['bottom']-v['ground'] for v in info.values() for f in v['fr'])+PAD
CW,CH=int(np.ceil(half*2)),int(np.ceil(up+down)); GROUND=int(np.ceil(up))
print('frame',CW,CH,'ground',GROUND)
key={}
for k,v in info.items():
    frames=[]
    for f in v['fr']:
        left=int(round(f['cx']-CW/2)); top=int(round(v['ground']-GROUND))
        pad=np.zeros((v['a'].shape[0]+400,v['a'].shape[1]+800,4),np.uint8)   # 四周留白，避免越界
        pad[200:200+v['a'].shape[0],400:400+v['a'].shape[1]]=v['a']
        cell=pad[top+200:top+200+CH,left+400:left+400+CW].copy()
        xs=np.arange(left,left+CW); out=(xs<f['lo']-2)|(xs>f['hi']+2)
        cell[:,out,:]=0
        frames.append(cell)
    key[k]=frames
np.save('key.npy',np.array([key[k] for k in ['idle','working','dozing','yawning','clicked']]),allow_pickle=False)
open('meta.txt','w').write(f'{CW} {CH}\n')
