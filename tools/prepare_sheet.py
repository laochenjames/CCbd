import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC='/mnt/user-data/uploads/可爱杏色贵宾犬动画精灵表.png'
im=np.array(Image.open(SRC).convert('RGB'))
BANDS={'idle':(14,200),'working':(228,398),'dozing':(424,592),'yawning':(608,784),'clicked':(806,984)}
X0=215
S8=np.ones((3,3),bool)

def comps(mask,minsize):
    lab,n=ndi.label(mask,structure=S8)
    if n==0: return mask&False
    sizes=ndi.sum(mask,lab,range(1,n+1))
    return np.isin(lab,[i+1 for i,s in enumerate(sizes) if s>=minsize])

def matte(state):
    y0,y1=BANDS[state]
    c=im[y0:y1,X0:].astype(np.float32)
    ci=c.astype(int)
    R,G,B=ci[...,0],ci[...,1],ci[...,2]
    mx=ci.max(2); mn=ci.min(2); sat=mx-mn
    ratio=sat/np.maximum(mx,1)
    blue=(B-R)>14                      # 气泡（青色）；毛发和阴影都偏暖，不会误中
    raw=(ratio>0.27)|(mn<150)|blue    # 阴影是浅暖灰：既不够饱和也不够暗，被排除
    main=comps(ndi.binary_opening(raw,structure=S8),20)
    if state=='working':               # 笔记本是中性灰、里面有浅色 logo，单独按"灰色大块"收进来
        neutral=(sat<20)&(mn<212)
        lab,n=ndi.label(neutral,structure=S8)
        ids=[i for i in range(1,n+1) if ((lab==i)&(mn<150)).sum()>=150]
        main|=np.isin(lab,ids)
    fg=ndi.binary_fill_holes(ndi.binary_closing(main,structure=S8,iterations=2))
    for _ in range(3):                 # 剥掉边缘上又白又无色的背景残留
        edge=fg & ~ndi.binary_erosion(fg,structure=S8)
        fg&=~(edge&(mn>215)&(sat<28))
    fg=ndi.binary_opening(fg,structure=S8)
    # 细装饰（zZ、动作线）会被 opening 抹掉：从未开运算的前景里把离主体有距离的小块补回来
    near=ndi.binary_dilation(fg,structure=S8,iterations=2)
    deco=comps(raw&~near,5)
    deco=ndi.binary_dilation(deco,structure=S8,iterations=1)&(ndi.binary_dilation(raw,structure=S8,iterations=1))
    fg_all=fg|deco
    # 去色边：最外圈换成内侧最近的颜色，浅色背景不再渗进毛边
    core=ndi.binary_erosion(fg,structure=S8)
    idx=ndi.distance_transform_edt(~core,return_distances=False,return_indices=True)
    c2=c.copy(); ring=fg&~core; c2[ring]=c[idx[0],idx[1]][ring]
    d=ndi.distance_transform_edt(fg)
    alpha=np.clip(d/1.6,0,1)
    dz=deco&~fg&~blue
    if dz.any():
        lab,n=ndi.label(dz|(raw&dz),structure=S8)
        for i in range(1,n+1):
            m=lab==i
            core=m&raw
            if not core.any(): alpha[m]=0; continue
            col=np.median(c[core],axis=0); cmn=col.min()
            c2[m]=col
            alpha[m]=np.clip((250-mn[m])/max(250-cmn,1),0,1)
    alpha[deco&blue&~fg]=0.9
    # 气泡内部是半透明的
    bub=blue&(mn>185)&fg_all
    alpha[bub]=np.minimum(alpha[bub],0.8)
    alpha[~fg_all]=0
    return np.dstack([np.clip(c2,0,255).astype(np.uint8),(alpha*255).astype(np.uint8)])

if __name__=='__main__':
    for k in BANDS:
        o=matte(k)
        Image.fromarray(o).save(f'./{k}_raw.png')
        a=o[...,3:4]/255.0
        for name,bg in (('dark',(32,35,40)),('light',(255,255,255))):
            Image.fromarray((o[...,:3]*a+np.array(bg)*(1-a)).astype(np.uint8)).save(f'./{k}_{name}.png')
    rows=['working','dozing','clicked']
    ims=[Image.open(f'./{r}_dark.png') for r in rows]
    s=Image.new('RGB',(ims[0].width,sum(i.height for i in ims)))
    y=0
    for i in ims: s.paste(i,(0,y)); y+=i.height
    s.save('./check3.png')
