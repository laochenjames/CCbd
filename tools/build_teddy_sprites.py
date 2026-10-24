"""把「初稿精灵图」按每只狗的真实位置重新切成等宽帧：
- 先在整张图里按列找出 6 只狗（相距很近的小装饰，如 zZ、气泡、动作线，并入最近的那只）；
- 横向对齐到每只狗的"质心"（比外框稳，不会被装饰带偏），纵向保持原图相对位置，
  只把整个状态的地面基线对齐到同一条线；
- 五个状态使用同一个帧尺寸和同一条地面线，切换状态时狗不会变大变小或上下跳。
用法：python3 build_teddy_sprites.py <素材目录> <输出目录>
"""
import sys, os, statistics
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import frame_interp  # 光流补帧（需要 opencv-python-headless）

SRC, OUT = sys.argv[1], sys.argv[2]
STATES = [('idle', 'idle'), ('busy', 'working'), ('sleepy', 'dozing'), ('yawn', 'yawning'), ('poke', 'clicked')]
THRESH, GAP, N, PAD = 24, 25, 6, 10
# 补帧：每两个关键帧之间补 K 帧（6 帧 → 18 帧，配合 24 帧/秒，动作速度不变但更顺）。
# 跳跃、张手这类位移大的动作光流会出重影，这些相邻帧对（序号 = 前一帧，最后一帧接回第一帧也算一对）保持关键帧不补。
INTERP_K = 2
HOLD = {'poke': (2, 3, 4), 'yawn': (0, 3)}

def clusters(alpha):
    cols = (alpha > THRESH).any(axis=0)
    segs, s = [], None
    for x, v in enumerate(cols):
        if v and s is None: s = x
        if not v and s is not None:
            segs.append([s, x - 1]); s = None
    if s is not None: segs.append([s, len(cols) - 1])
    merged = []
    for a, b in segs:
        if merged and a - merged[-1][1] <= GAP: merged[-1][1] = b
        else: merged.append([a, b])
    return [m for m in merged if m[1] - m[0] > 40]  # 太窄的碎片忽略

def repair(images):
    """原素材五排之间的切线没切干净：被点击(poke)那排跳起来的狗，头顶最上面几像素掉进了
    哈欠(yawn)那排的底部。这里把 yawn 底部的碎片搬回 poke 头顶（poke 顶部加 T 行空白来放）。"""
    T, CUT = 8, 172
    yawn, poke = images['yawn'], images['poke']
    ya = np.array(yawn)
    frag = ya.copy(); frag[:CUT, :, :] = 0           # 只留 yawn 底部（碎片）
    ya[CUT:, :, :] = 0                               # yawn 本体去掉碎片
    new_poke = Image.new('RGBA', (poke.width, poke.height + T), (0, 0, 0, 0))
    new_poke.paste(poke, (0, T))
    fr = Image.fromarray(frag)
    # 碎片在 yawn 里的 y，对应 poke 顶部上方 (yawn.height - y) 行
    new_poke.alpha_composite(fr.crop((0, CUT, fr.width, yawn.height)), (0, T - (yawn.height - CUT)))
    images['yawn'], images['poke'] = Image.fromarray(ya), new_poke

images = {key: Image.open(os.path.join(SRC, folder + '_sprite.png')).convert('RGBA') for key, folder in STATES}
if not os.environ.get('NOREPAIR'): repair(images)

info = {}
for key, folder in STATES:
    im = images[key]
    a = np.array(im)[:, :, 3]
    cl = clusters(a)
    assert len(cl) == N, f'{folder}: 找到 {len(cl)} 只，期望 {N}: {cl}'
    frames = []
    for x0, x1 in cl:
        sub = a[:, x0:x1 + 1].astype(float)
        sub[sub <= THRESH] = 0
        cx = x0 + (sub.sum(axis=0) * np.arange(x1 - x0 + 1)).sum() / sub.sum()  # 质心
        ys = np.where((sub > 0).any(axis=1))[0]
        frames.append(dict(x0=x0, x1=x1, cx=cx, top=ys.min(), bottom=ys.max()))
    ground = statistics.median(f['bottom'] for f in frames)
    info[key] = dict(im=im, frames=frames, ground=ground)

# 统一帧尺寸：以质心为中心的最大半宽；地面线以上最大高度；地面线以下最大延伸
half = max(max(f['cx'] - f['x0'], f['x1'] - f['cx']) for v in info.values() for f in v['frames']) + PAD
up = max(v['ground'] - f['top'] for v in info.values() for f in v['frames']) + PAD
down = max(f['bottom'] - v['ground'] for v in info.values() for f in v['frames']) + PAD
CW, CH = int(np.ceil(half * 2)), int(np.ceil(up + down))
GROUND = int(np.ceil(up))
print('帧尺寸', CW, 'x', CH, '地面线 y =', GROUND)

os.makedirs(OUT, exist_ok=True)
for key, v in info.items():
    sheet = Image.new('RGBA', (CW * N, CH), (0, 0, 0, 0))
    for i, f in enumerate(v['frames']):
        left = int(round(f['cx'] - CW / 2))   # 帧在原图里的左边界（质心居中）
        topy = int(round(v['ground'] - GROUND))  # 帧在原图里的上边界（地面线对齐）
        box = (left, topy, left + CW, topy + CH)
        cell = v['im'].crop(box)
        # 只保留属于这只狗的像素（挡掉相邻狗伸进来的边缘）
        arr = np.array(cell)
        xs = np.arange(left, left + CW)
        outside = (xs < f['x0'] - 2) | (xs > f['x1'] + 2)
        arr[:, outside, :] = 0
        sheet.paste(Image.fromarray(arr), (i * CW, 0))
    if INTERP_K:
        fr = frame_interp.split(np.array(sheet), N)
        ts = [(j + 1) / (INTERP_K + 1) for j in range(INTERP_K)]
        seq = []
        for i in range(N):
            seq.append(fr[i])
            if i in HOLD.get(key, ()): seq.extend([fr[i]] * INTERP_K)
            else: seq.extend(frame_interp.interpolate(fr[i], fr[(i + 1) % N], ts))
        sheet = Image.fromarray(np.concatenate(seq, axis=1))
    path = os.path.join(OUT, key + '.webp')
    sheet.save(path, 'WEBP', quality=92, alpha_quality=100, method=6)
    print(key, sheet.size, os.path.getsize(path) // 1024, 'KB')
open(os.path.join(OUT, 'meta.txt'), 'w').write(f'{CW} {CH} {N * (INTERP_K + 1)}\n')  # 宽 高 总帧数
