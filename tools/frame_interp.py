import sys, numpy as np, cv2
from PIL import Image

def premult(im):
    a = im[:, :, 3:4].astype(np.float32) / 255.0
    return np.concatenate([im[:, :, :3].astype(np.float32) * a, a * 255.0], axis=2)  # RGB*a, A

def unpremult(p):
    a = np.clip(p[:, :, 3:4], 0, 255) / 255.0
    rgb = np.where(a > 1e-3, p[:, :, :3] / np.maximum(a, 1e-3), 0)
    return np.clip(np.concatenate([rgb, a * 255.0], axis=2), 0, 255).astype(np.uint8)

def gray_on_bg(im):
    a = im[:, :, 3:4].astype(np.float32) / 255.0
    comp = im[:, :, :3].astype(np.float32) * a + 128 * (1 - a)
    g = cv2.cvtColor(comp.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    # 把 alpha 也混进去，让轮廓运动更明显
    return np.clip(g.astype(np.float32) * 0.6 + im[:, :, 3].astype(np.float32) * 0.4, 0, 255).astype(np.uint8)

def warp(p, flow, scale):
    h, w = p.shape[:2]
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    mapx = gx + flow[:, :, 0] * scale
    mapy = gy + flow[:, :, 1] * scale
    return cv2.remap(p, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

def interpolate(f0, f1, ts):
    g0, g1 = gray_on_bg(f0), gray_on_bg(f1)
    kw = dict(pyr_scale=0.5, levels=4, winsize=21, iterations=4, poly_n=7, poly_sigma=1.5, flags=0)
    F01 = cv2.calcOpticalFlowFarneback(g0, g1, None, **kw)  # I0 中的点在 I1 中的位置
    F10 = cv2.calcOpticalFlowFarneback(g1, g0, None, **kw)
    p0, p1 = premult(f0), premult(f1)
    out = []
    for t in ts:
        # 从 I0 取：沿着 F10 方向后退 t 倍；从 I1 取：沿着 F01 方向后退 (1-t) 倍
        a = warp(p0, F10, t)
        b = warp(p1, F01, 1 - t)
        out.append(unpremult((1 - t) * a + t * b))
    return out

def split(sheet, n):
    w = sheet.shape[1] // n
    return [sheet[:, i * w:(i + 1) * w] for i in range(n)]

if __name__ == '__main__':
    src, dst, n, k = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])  # k = 每两帧之间补几帧
    sheet = np.array(Image.open(src).convert('RGBA'))
    fr = split(sheet, n)
    ts = [(j + 1) / (k + 1) for j in range(k)]
    seq = []
    for i in range(n):
        seq.append(fr[i])
        seq.extend(interpolate(fr[i], fr[(i + 1) % n], ts))  # 最后一帧补到第一帧，保证循环衔接
    out = np.concatenate(seq, axis=1)
    Image.fromarray(out).save(dst)
    print(src, '->', len(seq), '帧', out.shape)
