"""
build_new_sprites.py
Extracts sprite frames from Doge and Pepe sheets, mats them with alpha edge defringing,
aligns them onto a uniform 200x188 canvas, and generates 18/24-frame animated WebP strips.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import frame_interp

CW = 200
CH = 188
GROUND = 162  # baseline y position on the 188px high canvas
PAD = 8

DOGE_SRC = r'C:/Users/demonlamb/.gemini/antigravity/brain/22120c7f-8505-4d67-8a9d-375f759e2c53/.user_uploaded/media_1793255569441_9f6ee114.jpg'
PEPE_SRC = r'C:/Users/demonlamb/.gemini/antigravity/brain/22120c7f-8505-4d67-8a9d-375f759e2c53/.user_uploaded/media_1793255573190_e9cadddb.jpg'

STATES = ['idle', 'busy', 'sleepy', 'yawn', 'poke']

ANIM_CFG = {
    'idle':   dict(K=2, hold=()),
    'busy':   dict(K=2, hold=()),
    'sleepy': dict(K=3, hold=()),  # 6 * 4 = 24 frames
    'yawn':   dict(K=2, hold=(0, 1, 3, 4)),
    'poke':   dict(K=2, hold=(1, 2, 3)),
}

def get_row_splits(name, img):
    sat = img.max(2).astype(int) - img.min(2).astype(int)
    mn = img.min(2).astype(int)
    fg = (sat > 8) | (mn < 235)
    
    if name == 'doge':
        rows = [(12, 163), (195, 326), (355, 481), (500, 634), (655, 791)]
        x_left = 135
        x_right = 985
    else:
        rows = [(12, 146), (175, 315), (345, 475), (500, 630), (655, 790)]
        x_left = 125
        x_right = 1005

    row_cuts = []
    for r_idx, (y0, y1) in enumerate(rows):
        splits = [x_left]
        for guess in [270, 410, 555, 695, 840]:
            sub = fg[y0:y1, guess-25:guess+25].sum(axis=0)
            best_offset = int(np.argmin(sub))
            splits.append(guess - 25 + best_offset)
        splits.append(x_right)
        row_cuts.append([(splits[i], splits[i+1]) for i in range(6)])
    return rows, row_cuts

def matte_cell(cell):
    sat = cell.max(2).astype(int) - cell.min(2).astype(int)
    mn = cell.min(2).astype(int)
    bg_cand = (mn >= 238) & (sat <= 8)
    
    lab, num = ndi.label(bg_cand)
    border_ids = set()
    border_ids.update(lab[0, :]); border_ids.update(lab[-1, :])
    border_ids.update(lab[:, 0]); border_ids.update(lab[:, -1])
    border_ids.discard(0)
    is_bg = np.isin(lab, list(border_ids))
    fg = ~is_bg
    
    # Peel light neutral edge remnants
    S8 = np.ones((3, 3), bool)
    for _ in range(3):
        edge = fg & ~ndi.binary_erosion(fg, structure=S8)
        fg &= ~(edge & (mn > 210) & (sat < 25))
        
    core = ndi.binary_erosion(fg, structure=S8)
    c2 = cell.copy()
    if core.any():
        idx = ndi.distance_transform_edt(~core, return_distances=False, return_indices=True)
        ring = fg & ~core
        c2[ring] = cell[idx[0], idx[1]][ring]
        
    dist = ndi.distance_transform_edt(fg)
    alpha = np.clip(dist / 1.5, 0, 1)
    return np.dstack([c2, (alpha * 255).astype(np.uint8)]), fg

def process_character(name, img_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    img = np.array(Image.open(img_path))
    rows, row_cuts = get_row_splits(name, img)
    
    # Step 1: extract all 5x6 cells, find global ground baseline
    all_cells = {}
    ground_candidates = []
    
    for r_idx, state in enumerate(STATES):
        y0, y1 = rows[r_idx]
        cells = []
        for c_idx in range(6):
            x0, x1 = row_cuts[r_idx][c_idx]
            raw_cell = img[y0:y1, x0:x1]
            rgba, fg = matte_cell(raw_cell)
            ys, xs = np.where(fg)
            if len(ys) == 0:
                print(f'Warning: empty frame {name} {state} {c_idx}')
                ys = np.array([rgba.shape[0] - 1])
                xs = np.array([rgba.shape[1] // 2])
            cx = float(xs.mean())
            bot = float(ys.max())
            cells.append(dict(rgba=rgba, cx=cx, bot=bot, h=rgba.shape[0], w=rgba.shape[1]))
            # normal sitting frames give ground baseline
            if state in ['idle', 'yawn']:
                ground_candidates.append(bot)
        all_cells[state] = cells
        
    base_ground_rel = float(np.median(ground_candidates))
    print(f'[{name}] base ground rel: {base_ground_rel:.1f}')
    
    # Step 2: place each cell on CW x CH canvas
    key_frames = {}
    for state in STATES:
        state_frames = []
        for c_idx in range(6):
            info = all_cells[state][c_idx]
            rgba = info['rgba']
            h, w = rgba.shape[:2]
            
            # In poke frame 3 (squished flat), bottom aligns to ground directly
            if state == 'poke' and c_idx == 3:
                target_top = int(round(GROUND - info['bot']))
            else:
                target_top = int(round(GROUND - info['bot']))
                
            target_left = int(round(CW / 2.0 - info['cx']))
            
            canvas = np.zeros((CH, CW, 4), dtype=np.uint8)
            src_y0 = max(0, -target_top); src_y1 = min(h, CH - target_top)
            src_x0 = max(0, -target_left); src_x1 = min(w, CW - target_left)
            dst_y0 = max(0, target_top); dst_y1 = dst_y0 + (src_y1 - src_y0)
            dst_x0 = max(0, target_left); dst_x1 = dst_x0 + (src_x1 - src_x0)
            
            if dst_y1 > dst_y0 and dst_x1 > dst_x0 and src_y1 > src_y0 and src_x1 > src_x0:
                canvas[dst_y0:dst_y1, dst_x0:dst_x1] = rgba[src_y0:src_y1, src_x0:src_x1]
            state_frames.append(canvas)
        key_frames[state] = state_frames
        
    # Step 3: assemble animation strips
    for state in STATES:
        cfg = ANIM_CFG[state]
        keys = key_frames[state]
        N = len(keys)
        K = cfg['K']
        hold = cfg['hold']
        ts = [(j + 1) / (K + 1) for j in range(K)]
        
        seq = []
        for i in range(N):
            seq.append(keys[i])
            if i in hold:
                seq.extend([keys[i]] * K)
            else:
                next_frame = keys[(i + 1) % N]
                seq.extend(frame_interp.interpolate(keys[i], next_frame, ts))
                
        strip = np.concatenate(seq, axis=1)
        out_path = os.path.join(out_dir, f'{state}.webp')
        Image.fromarray(strip).save(out_path, 'WEBP', quality=92, alpha_quality=100, method=6)
        print(f'[{name}] {state}: {len(seq)} frames, {strip.shape}, {os.path.getsize(out_path)//1024} KB -> {out_path}')

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print('Processing Doge...')
    process_character('doge', DOGE_SRC, os.path.join(base_dir, 'sprites', 'doge'))
    print('Processing Pepe...')
    process_character('pepe', PEPE_SRC, os.path.join(base_dir, 'sprites', 'pepe'))
    print('All sprites generated successfully!')
