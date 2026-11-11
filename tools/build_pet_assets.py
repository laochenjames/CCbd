from pathlib import Path
from PIL import Image
from rembg import remove, new_session

BASE = Path(__file__).resolve().parent.parent
RAW_DIR = BASE / "raw_images"
OUT_STATES = BASE / "public/assets/pet/states"
OUT_EYES = BASE / "public/assets/pet/eyes"
OUT_STATES.mkdir(parents=True, exist_ok=True)
OUT_EYES.mkdir(parents=True, exist_ok=True)

CANVAS_SIZE = (1024, 1024)
EYE_BBOX = (380, 285, 635, 385)  # left, top, right, bottom

session = new_session("isnet-general-use")


def find(stem):
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = RAW_DIR / (stem + ext)
        if p.exists():
            return p
    return None


def load(path):
    img = Image.open(path).convert("RGBA")
    return img.resize(CANVAS_SIZE, Image.Resampling.LANCZOS)


def main():
    for stem in ["working", "daydreaming", "drinking", "stretching", "sleeping"]:
        src = find(stem)
        if not src:
            print("[缺失]", stem)
            continue
        out = remove(load(src), session=session, alpha_matting=True,
                     alpha_matting_foreground_threshold=240,
                     alpha_matting_background_threshold=10,
                     alpha_matting_erode_size=5)
        out.save(OUT_STATES / f"{stem}.png", "PNG")
        print("[状态图]", stem)

    eye_map = {"working_normal": "normal", "working": "half",
               "working_tired": "tired", "working_closed": "closed"}
    for stem, dest in eye_map.items():
        src = find(stem)
        if not src:
            print("[缺失]", stem)
            continue
        layer = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
        layer.paste(load(src).crop(EYE_BBOX), EYE_BBOX[:2])
        layer.save(OUT_EYES / f"{dest}.png", "PNG")
        print("[眼睛层]", dest)


def export_webp():
    """导出扩展用的 WebP：状态图缩到 512，眼睛只保留裁切区域。输出到 sprites/chabit/"""
    out = BASE / "sprites" / "chabit"
    out.mkdir(parents=True, exist_ok=True)
    for f in OUT_STATES.glob("*.png"):
        Image.open(f).resize((512, 512), Image.Resampling.LANCZOS).save(out / (f.stem + ".webp"), "WEBP", quality=85, method=6)
    for f in OUT_EYES.glob("*.png"):
        Image.open(f).crop(EYE_BBOX).save(out / ("eye_" + f.stem + ".webp"), "WEBP", quality=92, method=6)
    print("[WebP] ->", out)


if __name__ == "__main__":
    main()
    export_webp()




