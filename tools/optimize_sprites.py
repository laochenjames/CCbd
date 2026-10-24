import os
import numpy as np
from PIL import Image

def clean_alpha_noise(arr):
    alpha = arr[..., 3].copy()
    alpha[alpha < 10] = 0
    alpha[alpha > 248] = 255
    arr[..., 3] = alpha
    return arr

def optimize_all():
    src_root = 'sprites_backup'
    dst_root = 'sprites'
    
    # 1. 猫咪
    cat_w, cat_h = 245, 220
    for st in ['idle', 'busy', 'sleepy', 'yawn', 'poke']:
        p_src = os.path.join(src_root, 'cat', f'{st}.webp')
        p_dst = os.path.join(dst_root, 'cat', f'{st}.webp')
        im = Image.open(p_src)
        n = im.width // cat_w
        frames = [np.array(im.crop((i * cat_w, 0, (i + 1) * cat_w, cat_h))) for i in range(n)]
        frames = [clean_alpha_noise(f) for f in frames]
        
        # 优化循环闭合
        if st in ['idle', 'sleepy', 'yawn', 'poke']:
            k_last_idx = 16 if st == 'sleepy' else 15
            f_start = frames[k_last_idx].astype(float)
            f_end = frames[0].astype(float)
            num_interp = n - 1 - k_last_idx
            
            for j in range(num_interp):
                idx = k_last_idx + 1 + j
                t = (j + 1) / (num_interp + 1)
                ease_t = 0.5 - 0.5 * np.cos(t * np.pi)
                blend = (1.0 - ease_t) * f_start + ease_t * f_end
                frames[idx] = clean_alpha_noise(np.clip(blend, 0, 255).astype(np.uint8))
        
        new_sheet = Image.fromarray(np.concatenate(frames, axis=1))
        new_sheet.save(p_dst, 'WEBP', quality=95)
        print(f'Optimized cat/{st}.webp: {n} frames, size={new_sheet.size}', flush=True)

    # 2. 泰迪
    ted_w, ted_h = 201, 188
    for st in ['idle', 'busy', 'sleepy', 'yawn', 'poke']:
        p_src = os.path.join(src_root, 'teddy', f'{st}.webp')
        p_dst = os.path.join(dst_root, 'teddy', f'{st}.webp')
        im = Image.open(p_src)
        n = im.width // ted_w
        frames = [np.array(im.crop((i * ted_w, 0, (i + 1) * ted_w, ted_h))) for i in range(n)]
        frames = [clean_alpha_noise(f) for f in frames]
        new_sheet = Image.fromarray(np.concatenate(frames, axis=1))
        new_sheet.save(p_dst, 'WEBP', quality=95)
        print(f'Optimized teddy/{st}.webp: {n} frames, size={new_sheet.size}', flush=True)

if __name__ == '__main__':
    optimize_all()
    print('All sprites successfully optimized from backup to destination.', flush=True)
