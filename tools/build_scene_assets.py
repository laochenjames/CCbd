"""
build_scene_assets.py
Generates transparent feathered circular WebP scene assets from raw_images/,
and creates visual contact comparison sheets (_preview/sheet_bg.png and sheet_pet.png)
for verification across different background themes (white, black, dark-blue, binance-dark).
"""

import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "raw_images"
OUT_SCENES = BASE_DIR / "scenes"
PREVIEW_DIR = RAW_DIR / "_preview"

OUT_SCENES.mkdir(parents=True, exist_ok=True)
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

# 7 场景配置表
SCENE_SPECS = [
    {"id": "morning", "label": "清晨晴空", "file": "清晨晴空.jpg", "group": "time"},
    {"id": "afternoon", "label": "午后暖光", "file": "午后暖光.jpg", "group": "time"},
    {"id": "dusk", "label": "黄昏晚霞", "file": "黄昏晚霞.jpg", "group": "time"},
    {"id": "night", "label": "夜晚星空", "file": "夜晚星空.jpg", "group": "time"},
    {"id": "spring", "label": "春日微风", "file": "春日微风.jpg", "group": "season"},
    {"id": "snow", "label": "冬日初雪", "file": "冬日初雪.jpg", "group": "season"},
    {"id": "rain", "label": "雨天", "file": "雨天.jpg", "group": "weather"},
]

# 输出参数
TARGET_SIZE = 512
# 裁切半径比例（基于 2048 基准图的 810px 裁切半径，必须保持逐像素一致）
R_CROP_RATIO = 810.0 / 2048.0
FEATHER_INNER = 0.88   # rho <= 0.88 为完全不透明 (对应 512 画布半径 256 下约 225px)
FEATHER_OUTER = 0.98   # rho >= 0.98 为完全透明 (250px)

# 运行时几何常量（必须与 content.js 保持一致）：
# 边长按 1.15W 放大并向左上微移（左移 11%W，上移 18%H），使手绘圆形窗景自然衬托在头部与笔记本后方
SCENE_SIDE_RATIO = 1.15
SCENE_DX_RATIO = -0.11
SCENE_DY_RATIO = -0.18


def make_radial_alpha_mask(size: int, inner_ratio: float, outer_ratio: float) -> np.ndarray:
    """生成平滑的径向 smoothstep 羽化蒙版 (size x size, 0.0 ~ 1.0)"""
    y, x = np.ogrid[:size, :size]
    center = (size - 1) / 2.0
    r_max = (size - 1) / 2.0
    dist = np.sqrt((x - center) ** 2 + (y - center) ** 2)
    rho = dist / r_max

    # smoothstep between inner_ratio and outer_ratio
    t = np.clip((rho - inner_ratio) / (outer_ratio - inner_ratio), 0.0, 1.0)
    # smoothstep: 3*t^2 - 2*t^3
    smooth_t = 3 * t ** 2 - 2 * t ** 3
    alpha = (1.0 - smooth_t) * 255.0
    return np.clip(alpha, 0, 255).astype(np.uint8)


def process_scene(spec: dict, mask_512: np.ndarray) -> Image.Image:
    src_file = RAW_DIR / spec["file"]
    if not src_file.exists():
        print(f"[警告] 文件未找到: {src_file}")
        return None

    img = Image.open(src_file).convert("RGB")
    w, h = img.size
    print(f"[源图尺寸] {spec['file']}: {w}x{h}")
    # 严格检查：必须近似正方形（宽高差 <= 2px）
    if abs(w - h) > 2:
        raise ValueError(f"源图 {spec['file']} 宽高比例异常不是正方形: {w}x{h}，脚本已终止以防输出畸变坏图！")

    cx, cy = w / 2.0, h / 2.0
    r_crop = R_CROP_RATIO * min(w, h)

    # 裁切方形
    left = int(round(cx - r_crop))
    top = int(round(cy - r_crop))
    right = int(round(cx + r_crop))
    bottom = int(round(cy + r_crop))

    cropped = img.crop((left, top, right, bottom))
    resized = cropped.resize((TARGET_SIZE, TARGET_SIZE), Image.Resampling.LANCZOS)

    # 叠合 Alpha 蒙版
    arr_rgb = np.array(resized)
    arr_rgba = np.dstack([arr_rgb, mask_512])
    out_img = Image.fromarray(arr_rgba, "RGBA")

    # 保存 WebP (RGBA, quality=80, method=6)
    out_path = OUT_SCENES / f"{spec['id']}.webp"
    out_img.save(out_path, "WEBP", quality=80, method=6)
    size_kb = out_path.stat().st_size / 1024.0
    print(f"[完成] {spec['id']}.webp ({spec['label']}) -> {size_kb:.1f} KB")
    return out_img


def build_preview_sheets(processed_images: dict):
    """
    生成两张对照联系表：
    1. sheet_bg.png: 场景在 4 种底色上的边缘纯度检测
    2. sheet_pet.png: 场景与小桌宠 (sprites/chabit/working.webp) 在 4 种底色上的拟真合成
    """
    # 4 种底色 (标准测试环境)
    themes = [
        ("X Light (#FFFFFF)", (255, 255, 255, 255)),
        ("X Dark (#000000)", (0, 0, 0, 255)),
        ("X Dim (#15202B)", (21, 32, 43, 255)),
        ("Binance Dark (#181A20)", (24, 26, 32, 255)),
    ]

    pet_file = BASE_DIR / "sprites" / "chabit" / "working.webp"
    pet_img = Image.open(pet_file).convert("RGBA") if pet_file.exists() else None

    # ---------- 1. sheet_bg.png ----------
    # 7 行 (场景) x 4 列 (底色)
    # 单单元格 256x256
    cell_w, cell_h = 240, 240
    pad_x, pad_y = 20, 40
    title_h = 50
    total_w = pad_x + len(themes) * (cell_w + pad_x)
    total_h = title_h + len(SCENE_SPECS) * (cell_h + pad_y)

    bg_sheet = Image.new("RGBA", (total_w, total_h), (245, 246, 248, 255))
    draw_bg = ImageDraw.Draw(bg_sheet)

    # 尝试加载中文字体，若无则使用默认
    font = None
    for fpath in ["msyh.ttc", "simhei.ttf", "arial.ttf"]:
        try:
            font = ImageFont.truetype(fpath, 16)
            break
        except Exception:
            continue
    if not font:
        font = ImageFont.load_default()

    # 绘制列标题
    for c_idx, (t_name, _) in enumerate(themes):
        tx = pad_x + c_idx * (cell_w + pad_x) + cell_w // 2
        draw_bg.text((tx, 20), t_name, fill=(50, 50, 50, 255), anchor="mm", font=font)

    for r_idx, spec in enumerate(SCENE_SPECS):
        scene_img = processed_images.get(spec["id"])
        if not scene_img:
            continue
        scene_thumb = scene_img.resize((cell_w - 20, cell_h - 20), Image.Resampling.LANCZOS)
        ry = title_h + r_idx * (cell_h + pad_y)

        # 绘制场景行名
        draw_bg.text((pad_x // 2, ry - 14), f"{spec['label']} ({spec['id']})", fill=(30, 30, 30, 255), font=font)

        for c_idx, (_, bg_color) in enumerate(themes):
            rx = pad_x + c_idx * (cell_w + pad_x)
            # 背景框
            tile = Image.new("RGBA", (cell_w, cell_h), bg_color)
            # 居中贴上场景
            offset_x = (cell_w - scene_thumb.width) // 2
            offset_y = (cell_h - scene_thumb.height) // 2
            tile.alpha_composite(scene_thumb, (offset_x, offset_y))
            bg_sheet.paste(tile, (rx, ry))

    bg_sheet_path = PREVIEW_DIR / "sheet_bg.png"
    bg_sheet.save(bg_sheet_path, "PNG")
    print(f"[预览联系表生成] -> {bg_sheet_path}")

    # ---------- 2. sheet_pet.png ----------
    # 模拟运行时几何 (完全与 content.js 常量对齐)：
    # 3.0 特大档: W=216, H=192, 宠物 216x216 底部对齐
    # 场景 side = round(1.15 * W) ≈ 248x248，水平偏移 round((W - side)/2 - 0.11W)，垂直偏移 round((H - side)/2 - 0.18H)
    if pet_img:
        # 单格扩大到 340x320 以容纳向上向左延伸的背景窗景
        p_cell_w, p_cell_h = 340, 320
        p_total_w = pad_x + len(themes) * (p_cell_w + pad_x)
        # 7 个主场景 + 底部 1 行缩略对比（1.0 档与 2.2 档）
        p_total_h = title_h + (len(SCENE_SPECS) + 1) * (p_cell_h + pad_y)

        pet_sheet = Image.new("RGBA", (p_total_w, p_total_h), (245, 246, 248, 255))
        draw_pet = ImageDraw.Draw(pet_sheet)

        for c_idx, (t_name, _) in enumerate(themes):
            tx = pad_x + c_idx * (p_cell_w + pad_x) + p_cell_w // 2
            draw_pet.text((tx, 20), t_name, fill=(50, 50, 50, 255), anchor="mm", font=font)

        W = 216
        H = 192
        side = int(round(SCENE_SIDE_RATIO * W))
        scene_left = int(round((W - side) / 2.0 + SCENE_DX_RATIO * W))
        scene_top = int(round((H - side) / 2.0 + SCENE_DY_RATIO * H))

        # 在 cell 内部给 root 留出边距 (root_left=80, root_top=90)
        root_ox = 80
        root_oy = 90

        for r_idx, spec in enumerate(SCENE_SPECS):
            scene_img = processed_images.get(spec["id"])
            if not scene_img:
                continue
            scene_scaled = scene_img.resize((side, side), Image.Resampling.LANCZOS)
            pet_scaled = pet_img.resize((W, W), Image.Resampling.LANCZOS)
            ry = title_h + r_idx * (p_cell_h + pad_y)

            draw_pet.text((pad_x // 2, ry - 14), f"{spec['label']} (3.0 特大档)", fill=(30, 30, 30, 255), font=font)

            for c_idx, (_, bg_color) in enumerate(themes):
                rx = pad_x + c_idx * (p_cell_w + pad_x)
                tile = Image.new("RGBA", (p_cell_w, p_cell_h), bg_color)

                # 1. 贴背景
                tile.alpha_composite(scene_scaled, (root_ox + scene_left, root_oy + scene_top))
                # 2. 贴宠物 (底部对齐: y = H - W)
                tile.alpha_composite(pet_scaled, (root_ox, root_oy + (H - W)))
                pet_sheet.paste(tile, (rx, ry))

        # 底部额外增加一行：1.0 标准档 与 2.2 大档的缩略尺寸验证（对比 night, snow, rain）
        sub_r_idx = len(SCENE_SPECS)
        sub_ry = title_h + sub_r_idx * (p_cell_h + pad_y)
        draw_pet.text((pad_x // 2, sub_ry - 14), "不同尺寸档位拟真对照 (1.0 档 / 2.2 档)", fill=(30, 30, 30, 255), font=font)

        compare_samples = [("night", 1.0, "1.0 标准档 (night)"), ("snow", 2.2, "2.2 大档 (snow)"), ("rain", 1.0, "1.0 标准档 (rain)"), ("afternoon", 2.2, "2.2 大档 (afternoon)")]
        for c_idx, (sc_id, s_scale, s_label) in enumerate(compare_samples):
            rx = pad_x + c_idx * (p_cell_w + pad_x)
            bg_color = themes[c_idx][1]
            tile = Image.new("RGBA", (p_cell_w, p_cell_h), bg_color)

            cur_w = int(round(72 * s_scale))
            cur_h = int(round(64 * s_scale))
            cur_side = int(round(SCENE_SIDE_RATIO * cur_w))
            cur_s_left = int(round((cur_w - cur_side) / 2.0 + SCENE_DX_RATIO * cur_w))
            cur_s_top = int(round((cur_h - cur_side) / 2.0 + SCENE_DY_RATIO * cur_h))

            sc_img = processed_images.get(sc_id)
            if sc_img:
                sc_scaled = sc_img.resize((cur_side, cur_side), Image.Resampling.LANCZOS)
                p_scaled = pet_img.resize((cur_w, cur_w), Image.Resampling.LANCZOS)
                c_ox = (p_cell_w - cur_w) // 2
                c_oy = (p_cell_h - cur_h) // 2 + 20
                tile.alpha_composite(sc_scaled, (c_ox + cur_s_left, c_oy + cur_s_top))
                tile.alpha_composite(p_scaled, (c_ox, c_oy + (cur_h - cur_w)))

            tile_draw = ImageDraw.Draw(tile)
            tile_draw.text((10, 10), s_label, fill=(200, 200, 200, 255) if bg_color[0] < 100 else (50, 50, 50, 255), font=font)
            pet_sheet.paste(tile, (rx, sub_ry))

        pet_sheet_path = PREVIEW_DIR / "sheet_pet.png"
        pet_sheet.save(pet_sheet_path, "PNG")
        print(f"[桌宠拟真联系表生成] -> {pet_sheet_path}")


def main():
    print("=== 开始构建背景场景素材 ===")
    mask = make_radial_alpha_mask(TARGET_SIZE, FEATHER_INNER, FEATHER_OUTER)
    processed = {}
    for spec in SCENE_SPECS:
        img = process_scene(spec, mask)
        if img:
            processed[spec["id"]] = img

    print(f"=== 成功生成 {len(processed)}/7 张背景素材，开始绘制预览对照表 ===")
    build_preview_sheets(processed)
    print("=== Phase 1 构建完成 ===")


if __name__ == "__main__":
    main()

