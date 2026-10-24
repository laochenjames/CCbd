import numpy as np
from PIL import Image
from scipy import ndimage as ndi
SRC='/mnt/user-data/uploads/1792810283929_哈基米精灵图制作.jpeg'
im=np.array(Image.open(SRC).convert('RGB'))
BANDS={'idle':(20,272),'working':(282,522),'dozing':(534,760),'yawning':(766,990),'clicked':(996,1228)}
X0=285
S8=np.ones((3,3),bool)
def comps(mask,minsize):
    lab,n=ndi.label(mask,structure=S8)
    if n==0: return mask&False
    sizes=ndi.sum(mask,lab,range(1,n+1))
    return np.isin(lab,[i+1 for i,s in enumerate(sizes) if s>=minsize])
def matte(state):
    y0,y1=BANDS[state]
    c=im[y0:y1,X0:].astype(np.float32); ci=c.astype(int)
    mx=ci.max(2); mn=ci.min(2); sat=mx-mn
    ratio=sat/np.maximum(mx,1)
    raw=(ratio>0.16)|(mn<170)
    if state=='working': raw|=((sat<22)&(mn<200))
    main=comps(ndi.binary_opening(raw,structure=S8),30)
    fg=ndi.binary_fill_holes(ndi.binary_closing(main,structure=S8,iterations=3))
    for _ in range(2):
        edge=fg&~ndi.binary_erosion(fg,structure=S8)
        fg&=~(edge&(mn>225)&(sat<24))
    fg=ndi.binary_opening(fg,structure=S8)
    near=ndi.binary_dilation(fg,structure=S8,iterations=2)
    deco=comps(raw&~near,5)
    deco=ndi.binary_dilation(deco,structure=S8)&ndi.binary_dilation(raw,structure=S8)
    fg_all=fg|deco
    core=ndi.binary_erosion(fg,structure=S8)
    idx=ndi.distance_transform_edt(~core,return_distances=False,return_indices=True)
    c2=c.copy(); ring=fg&~core; c2[ring]=c[idx[0],idx[1]][ring]
    alpha=np.clip(ndi.distance_transform_edt(fg)/1.6,0,1)
    dz=deco&~fg
    if dz.any():
        lab,n=ndi.label(dz,structure=S8)
        for i in range(1,n+1):
            m=lab==i; core_=m&raw
            if not core_.any(): alpha[m]=0; continue
            col=np.median(c[core_],axis=0); c2[m]=col
            alpha[m]=np.clip((245-mn[m])/max(245-col.min(),1),0,1)
    alpha[~fg_all]=0
    return np.dstack([np.clip(c2,0,255).astype(np.uint8),(alpha*255).astype(np.uint8)])
if __name__=='__main__':
    for k in BANDS:
        o=matte(k); Image.fromarray(o).save(f'{k}_raw.png')
        a=o[...,3:4]/255.0
        for n,bg in (('dark',(32,35,40)),('light',(255,255,255))):
            Image.fromarray((o[...,:3]*a+np.array(bg)*(1-a)).astype(np.uint8)).save(f'{k}_{n}.png')
    ims=[Image.open(f'{r}_dark.png') for r in BANDS]
    s=Image.new('RGB',(ims[0].width,sum(i.height for i in ims)));y=0
    for i in ims: s.paste(i,(0,y)); y+=i.height
    s.save('all_dark.png'); print(s.size)
