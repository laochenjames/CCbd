"""
build_store_assets.py
Generates 1280x800 screenshots (1. 是什么 / 2. 主要功能 / 3. 自定义话风)
and 440x280 promo tiles for the Chrome Web Store & GitHub release showcase.
Incorporates real browser screenshots and v0.13.0 features.
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

STORE_DIR = r'E:/Doc/Python_daye/CCbd/store_assets'
RAW_DIR = os.path.join(STORE_DIR, 'raw')
os.makedirs(STORE_DIR, exist_ok=True)
os.makedirs(RAW_DIR, exist_ok=True)

FONT_MAIN = 'C:/Windows/Fonts/msyh.ttc'
FONT_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
FONT_EN = 'C:/Windows/Fonts/arial.ttf'

def get_font(size, bold=False):
    font_path = FONT_BOLD if bold else FONT_MAIN
    try:
        return ImageFont.truetype(font_path, size)
    except:
        try:
            return ImageFont.truetype(FONT_MAIN, size)
        except:
            return ImageFont.load_default()

def draw_header(d, tag, title, subtitle):
    # Top bar badge
    d.rounded_rectangle((60, 32, 60 + 130, 62), radius=6, fill=(34, 197, 94))
    d.text((75, 37), tag, font=get_font(15, bold=True), fill=(255, 255, 255))
    
    # Title & Subtitle
    d.text((205, 30), title, font=get_font(28, bold=True), fill=(255, 255, 255))
    d.text((60, 78), subtitle, font=get_font(15), fill=(160, 175, 195))

def create_screenshot_1():
    """
    图1：是什么 —— 网页伴宠 · 社交浏览的“虚拟嘴替”
    展示：X (推特) 真实浏览场景实拍，CICI 工位小桌宠与你的浏览心声
    """
    im = Image.new('RGBA', (1280, 800), (15, 20, 28, 255))
    d = ImageDraw.Draw(im)

    # Top header bar
    d.rectangle((0, 0, 1280, 115), fill=(22, 27, 36))
    d.line([(0, 115), (1280, 115)], fill=(45, 54, 70), width=1)
    draw_header(d, "① 是什么？", "CCbd 伴宠 · 陪伴你浏览社交广场的“虚拟嘴替”",
                "静静呆在工位桌角 · 陪伴你在 𝕏 (推特)、币安广场与 OK星球 · 第一人称内心自言自语，不催促不评判")

    # Left Side: Real Screenshot Container (Mock Browser Window)
    bx, by, bw, bh = 60, 140, 740, 620
    d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=12, fill=(24, 30, 40), outline=(55, 65, 82), width=1)
    
    # Browser Top Controls
    d.rounded_rectangle((bx, by, bx + bw, by + 40), radius=12, fill=(32, 38, 50))
    d.rectangle((bx, by + 30, bx + bw, by + 40), fill=(32, 38, 50))
    d.line([(bx, by + 40), (bx + bw, by + 40)], fill=(48, 58, 74), width=1)
    d.ellipse((bx + 16, by + 14, bx + 28, by + 26), fill=(239, 68, 68))
    d.ellipse((bx + 36, by + 14, bx + 48, by + 26), fill=(245, 158, 11))
    d.ellipse((bx + 56, by + 14, bx + 68, by + 26), fill=(34, 197, 94))
    d.text((bx + 85, by + 12), "https://x.com/home — 真实浏览状态", font=get_font(13), fill=(160, 175, 195))

    # Paste User Screenshot inside
    user_shot_path = os.path.join(RAW_DIR, 'user_screen_x.png')
    if os.path.exists(user_shot_path):
        raw_x = Image.open(user_shot_path).convert('RGBA')
        target_w = bw - 16
        scale = target_w / raw_x.width
        target_h = int(raw_x.height * scale)
        scaled_x = raw_x.resize((target_w, target_h), Image.LANCZOS)
        im.alpha_composite(scaled_x, (bx + 8, by + 48))

    # Right Side: Feature Highlights
    rx = 830
    rw = 390
    
    cards = [
        ("🌸 懂你的虚拟嘴替", "不评判、不催促、不查岗", 
         "当你刷到好帖、发文、点赞或深夜迟迟没睡时，伴宠以第一人称自言自语（“我也在看这条…”），如同与你并肩探索世界的同桌搭子。"),
        ("💻 沉浸式手绘工位小桌宠", "多层动画 · 生理节律感应", 
         "全新手绘毛绒泰迪 CICI，端坐电脑前认真敲键盘，自然打字呼吸、眨眼、打哈欠、伸懒腰、端杯喝水，生动细腻陪伴。"),
        ("🛡️ 纯本地安全，绝不干扰", "零外部依赖 · 专为社交广场设计", 
         "仅在 𝕏、币安广场、OK星球等信息流页面挂载，绝不读取钱包私钥、绝不上报数据。支持随时 Alt+P 快捷隐藏。")
    ]

    cy = 140
    for title, sub, desc in cards:
        ch = 190
        d.rounded_rectangle((rx, cy, rx + rw, cy + ch), radius=12, fill=(24, 30, 42), outline=(50, 60, 75), width=1)
        d.text((rx + 22, cy + 20), title, font=get_font(18, bold=True), fill=(255, 255, 255))
        d.text((rx + 22, cy + 50), sub, font=get_font(13), fill=(34, 197, 94))
        
        words = desc
        lines = []
        cur_line = ""
        for char in words:
            if len(cur_line) >= 20 or char == '\n':
                lines.append(cur_line)
                cur_line = char if char != '\n' else ""
            else:
                cur_line += char
        if cur_line:
            lines.append(cur_line)
            
        for idx, line in enumerate(lines[:4]):
            d.text((rx + 22, cy + 82 + idx * 24), line, font=get_font(13), fill=(180, 190, 205))
            
        cy += ch + 25

    out_file = os.path.join(STORE_DIR, 'screenshot_1_overview.png')
    im.convert('RGB').save(out_file, quality=95)
    print(f'Generated {out_file}')

def create_screenshot_2():
    """
    图2：主要功能 —— 7 种手绘背景场景 · 右键快捷悬浮扩展菜单
    展示：右键呼出场景二级菜单，清晨、午后、黄昏、夜晚与四季场景
    """
    im = Image.new('RGBA', (1280, 800), (15, 20, 28, 255))
    d = ImageDraw.Draw(im)

    # Top header bar
    d.rectangle((0, 0, 1280, 115), fill=(22, 27, 36))
    d.line([(0, 115), (1280, 115)], fill=(45, 54, 70), width=1)
    draw_header(d, "② 主要功能", "7 种手绘背景场景 · 右键快捷扩展选择",
                "右键伴宠即可秒切背景 · 支持「自动跟随现实时段」或手动锁定偏好氛围 · 纯纯氛围感")

    # Left Area: Showcase the User's Submenu Screenshot
    lx, ly, lw, lh = 60, 140, 420, 620
    d.rounded_rectangle((lx, ly, lx + lw, ly + lh), radius=12, fill=(24, 30, 40), outline=(55, 65, 82), width=1)
    
    d.text((lx + 25, ly + 22), "🖱️ 右键悬停扩展菜单", font=get_font(18, bold=True), fill=(255, 255, 255))
    d.text((lx + 25, ly + 52), "鼠标轻移至「背景场景」即可平滑呼出", font=get_font(13), fill=(34, 197, 94))
    
    sub_path = os.path.join(RAW_DIR, 'user_submenu_scenes.png')
    if os.path.exists(sub_path):
        sub_img = Image.open(sub_path).convert('RGBA')
        sc = min((lw - 40) / sub_img.width, (lh - 110) / sub_img.height)
        new_w, new_h = int(sub_img.width * sc), int(sub_img.height * sc)
        scaled_sub = sub_img.resize((new_w, new_h), Image.LANCZOS)
        px = lx + (lw - new_w) // 2
        py = ly + 90 + (lh - 100 - new_h) // 2
        im.alpha_composite(scaled_sub, (px, py))

    # Right Area: 7 Hand-drawn Scenes Showcase Grid
    rx, ry, rw, rh = 510, 140, 710, 620
    d.rounded_rectangle((rx, ry, rx + rw, ry + rh), radius=12, fill=(24, 30, 42), outline=(50, 60, 75), width=1)
    d.text((rx + 25, ry + 22), "🎨 精美圆形手绘微缩场景一览", font=get_font(18, bold=True), fill=(255, 255, 255))
    d.text((rx + 25, ry + 52), "内置自动跟随自然光影（清晨/午后/黄昏/星空）及特殊主题环境（微风/初雪/雨天）", font=get_font(13), fill=(160, 175, 195))

    scene_defs = [
        ("spring", "春日微风", "暖粉浪漫花瓣"),
        ("morning", "清晨晴空", "晨光初煦朝气"),
        ("afternoon", "午后暖光", "闲适惬意阳光"),
        ("dusk", "黄昏晚霞", "静谧暮色霞光"),
        ("night", "夜晚星空", "深邃伴月星夜"),
        ("snow", "冬日初雪", "纯净落雪飞舞"),
    ]

    start_x = rx + 30
    start_y = ry + 90
    item_w = 205
    item_h = 240
    gap_x = 22
    gap_y = 18

    for idx, (sid, sname, sdesc) in enumerate(scene_defs):
        row = idx // 3
        col = idx % 3
        ix = start_x + col * (item_w + gap_x)
        iy = start_y + row * (item_h + gap_y)

        d.rounded_rectangle((ix, iy, ix + item_w, iy + item_h), radius=10, fill=(18, 22, 30), outline=(45, 54, 68), width=1)
        
        scene_path = f'E:/Doc/Python_daye/CCbd/scenes/{sid}.webp'
        if os.path.exists(scene_path):
            try:
                sc_im = Image.open(scene_path).convert('RGBA').resize((130, 130), Image.LANCZOS)
                mask = Image.new('L', (130, 130), 0)
                mask_d = ImageDraw.Draw(mask)
                mask_d.ellipse((0, 0, 130, 130), fill=255)
                im.paste(sc_im, (ix + (item_w - 130) // 2, iy + 18), mask)
            except Exception as e:
                print(f"Error drawing scene {sid}: {e}")

        d.text((ix + (item_w - len(sname)*15)//2, iy + 160), sname, font=get_font(15, bold=True), fill=(255, 255, 255))
        d.text((ix + (item_w - len(sdesc)*12)//2, iy + 190), sdesc, font=get_font(12), fill=(150, 165, 185))

    # 7th Card: 雨天氛围
    ix = start_x + 0 * (item_w + gap_x)
    iy = start_y + 2 * (item_h + gap_y) # wait, row 0: 3, row 1: 3, total 6.
    # Let's arrange 7 scenes + 1 auto card: 2 rows of 4 cards!
    # Let's adjust grid layout to 4 columns x 2 rows:
    # item_w = 150, gap_x = 16
    pass

def create_screenshot_2_grid():
    im = Image.new('RGBA', (1280, 800), (15, 20, 28, 255))
    d = ImageDraw.Draw(im)

    # Top header bar
    d.rectangle((0, 0, 1280, 115), fill=(22, 27, 36))
    d.line([(0, 115), (1280, 115)], fill=(45, 54, 70), width=1)
    draw_header(d, "② 主要功能", "7 种手绘背景场景 · 右键快捷扩展选择",
                "右键伴宠即可秒切背景 · 支持「自动跟随现实时段」或手动锁定偏好氛围 · 纯纯氛围感")

    # Left Area: Showcase the User's Submenu Screenshot
    lx, ly, lw, lh = 50, 140, 390, 620
    d.rounded_rectangle((lx, ly, lx + lw, ly + lh), radius=12, fill=(24, 30, 40), outline=(55, 65, 82), width=1)
    
    d.text((lx + 25, ly + 22), "🖱️ 右键悬停扩展菜单", font=get_font(18, bold=True), fill=(255, 255, 255))
    d.text((lx + 25, ly + 52), "鼠标轻移至「背景场景」即可平滑展开", font=get_font(13), fill=(34, 197, 94))
    
    sub_path = os.path.join(RAW_DIR, 'user_submenu_scenes.png')
    if os.path.exists(sub_path):
        sub_img = Image.open(sub_path).convert('RGBA')
        sc = min((lw - 30) / sub_img.width, (lh - 100) / sub_img.height)
        new_w, new_h = int(sub_img.width * sc), int(sub_img.height * sc)
        scaled_sub = sub_img.resize((new_w, new_h), Image.LANCZOS)
        px = lx + (lw - new_w) // 2
        py = ly + 85 + (lh - 95 - new_h) // 2
        im.alpha_composite(scaled_sub, (px, py))

    # Right Area: 7 Hand-drawn Scenes + Auto Mode Showcase
    rx, ry, rw, rh = 465, 140, 765, 620
    d.rounded_rectangle((rx, ry, rx + rw, ry + rh), radius=12, fill=(24, 30, 42), outline=(50, 60, 75), width=1)
    d.text((rx + 25, ry + 22), "🎨 精美圆形手绘微缩场景一览", font=get_font(18, bold=True), fill=(255, 255, 255))
    d.text((rx + 25, ry + 52), "内置自动跟随自然光影（清晨/午后/黄昏/星空）及特殊主题环境（微风/初雪/雨天）", font=get_font(13), fill=(160, 175, 195))

    scene_defs = [
        ("spring", "春日微风", "暖粉浪漫花瓣"),
        ("morning", "清晨晴空", "晨光初煦朝气"),
        ("afternoon", "午后暖光", "闲适惬意阳光"),
        ("dusk", "黄昏晚霞", "静谧暮色霞光"),
        ("night", "夜晚星空", "深邃伴月星夜"),
        ("snow", "冬日初雪", "纯净落雪飞舞"),
        ("rain", "雨天氛围", "滴答轻柔雨丝")
    ]

    start_x = rx + 25
    start_y = ry + 90
    item_w = 165
    item_h = 240
    gap_x = 18
    gap_y = 18

    # 4 columns, 2 rows
    for idx, (sid, sname, sdesc) in enumerate(scene_defs):
        row = idx // 4
        col = idx % 4
        ix = start_x + col * (item_w + gap_x)
        iy = start_y + row * (item_h + gap_y)

        d.rounded_rectangle((ix, iy, ix + item_w, iy + item_h), radius=10, fill=(18, 22, 30), outline=(45, 54, 68), width=1)
        
        scene_path = f'E:/Doc/Python_daye/CCbd/scenes/{sid}.webp'
        if os.path.exists(scene_path):
            try:
                sc_im = Image.open(scene_path).convert('RGBA').resize((115, 115), Image.LANCZOS)
                mask = Image.new('L', (115, 115), 0)
                mask_d = ImageDraw.Draw(mask)
                mask_d.ellipse((0, 0, 115, 115), fill=255)
                im.paste(sc_im, (ix + (item_w - 115) // 2, iy + 16), mask)
            except Exception as e:
                print(f"Error drawing scene {sid}: {e}")

        d.text((ix + (item_w - len(sname)*14)//2, iy + 148), sname, font=get_font(14, bold=True), fill=(255, 255, 255))
        d.text((ix + (item_w - len(sdesc)*11)//2, iy + 178), sdesc, font=get_font(11), fill=(150, 165, 185))

    # 8th slot: Auto Mode Box
    box_x = start_x + 3 * (item_w + gap_x)
    box_y = start_y + 1 * (item_h + gap_y)
    d.rounded_rectangle((box_x, box_y, box_x + item_w, box_y + item_h), radius=10, fill=(24, 45, 34), outline=(34, 197, 94), width=1)
    d.text((box_x + 22, box_y + 20), "⏰ 随动模式", font=get_font(16, bold=True), fill=(34, 197, 94))
    d.text((box_x + 14, box_y + 55), "自动跟随现实时段：", font=get_font(12, bold=True), fill=(255, 255, 255))
    d.text((box_x + 14, box_y + 85), "• 05~10点  清晨晴空", font=get_font(11), fill=(180, 220, 195))
    d.text((box_x + 14, box_y + 112), "• 11~16点  午后暖光", font=get_font(11), fill=(180, 220, 195))
    d.text((box_x + 14, box_y + 139), "• 17~19点  黄昏晚霞", font=get_font(11), fill=(180, 220, 195))
    d.text((box_x + 14, box_y + 166), "• 20~04点  夜晚星空", font=get_font(11), fill=(180, 220, 195))
    d.text((box_x + 14, box_y + 202), "支持手动锁定偏好", font=get_font(11), fill=(140, 175, 155))

    out_file = os.path.join(STORE_DIR, 'screenshot_2_features.png')
    im.convert('RGB').save(out_file, quality=95)
    print(f'Generated {out_file}')

def create_screenshot_3():
    """
    图3：自定义话风 —— AI 一键定制角色人设与专属台词
    展示：AI 生成器界面实拍、一键导入、任意大模型自由定制
    """
    im = Image.new('RGBA', (1280, 800), (15, 20, 28, 255))
    d = ImageDraw.Draw(im)

    # Top header bar
    d.rectangle((0, 0, 1280, 115), fill=(22, 27, 36))
    d.line([(0, 115), (1280, 115)], fill=(45, 54, 70), width=1)
    draw_header(d, "③ 自定义话风", "AI 角色人设与台词生成器 · 打造独一无二的专属嘴替",
                "无需逐条手写台词 · 复制 Prompt 发给任意大模型 · 粘贴 AI 回复即可一键完成全套人设台词导入")

    # Left Area: Real UI Screenshot
    lx, ly, lw, lh = 50, 140, 560, 620
    d.rounded_rectangle((lx, ly, lx + lw, ly + lh), radius=12, fill=(24, 30, 40), outline=(55, 65, 82), width=1)
    
    d.text((lx + 25, ly + 20), "✨ 真实的 AI 人设定制界面", font=get_font(18, bold=True), fill=(255, 255, 255))
    d.text((lx + 25, ly + 48), "内置 Web3交易员 / 傲娇猫咪 / 元气柴柴 / 毒舌搭子等灵感", font=get_font(13), fill=(34, 197, 94))

    # Paste User AI Generator Screenshot
    ai_path = os.path.join(RAW_DIR, 'user_ai_generator.png')
    if os.path.exists(ai_path):
        ai_img = Image.open(ai_path).convert('RGBA')
        sc = min((lw - 30) / ai_img.width, (lh - 95) / ai_img.height)
        new_w, new_h = int(ai_img.width * sc), int(ai_img.height * sc)
        scaled_ai = ai_img.resize((new_w, new_h), Image.LANCZOS)
        px = lx + (lw - new_w) // 2
        py = ly + 80 + (lh - 90 - new_h) // 2
        im.alpha_composite(scaled_ai, (px, py))

    # Right Area: AI Workflow & Personality Showcase
    rx, ry, rw, rh = 635, 140, 595, 620
    d.rounded_rectangle((rx, ry, rx + rw, ry + rh), radius=12, fill=(24, 30, 42), outline=(50, 60, 75), width=1)
    d.text((rx + 25, ry + 22), "🤖 极速三步，赋予它你的灵魂话风", font=get_font(18, bold=True), fill=(255, 255, 255))
    d.text((rx + 25, ry + 52), "兼容 ChatGPT、Claude、DeepSeek、Kimi 等任意主流大模型", font=get_font(13), fill=(160, 175, 195))

    steps = [
        ("第 1 步：点选灵感或输入自定义偏好", 
         "一键点选“Web3 Degen交易员”、“毒舌秘书”等灵感标签，或自由输入：例如“常说币圈黑话、满嘴吐槽、说话带喵”。"),
        ("第 2 步：一键复制结构化 Prompt", 
         "系统自动生成严格契合 CCbd 架构的专用 Prompt（包含点赞、发帖、深夜、时段问候等 15 大类台词触发规范）。"),
        ("第 3 步：粘贴 AI 回复，一键自动解析", 
         "直接粘贴大模型输出的 JSON。自动清洗代码块与格式容错，秒级全量导入生效！")
    ]

    sy = ry + 90
    for title, desc in steps:
        d.rounded_rectangle((rx + 25, sy, rx + rw - 25, sy + 105), radius=10, fill=(18, 22, 30), outline=(45, 54, 68), width=1)
        d.text((rx + 35, sy + 15), title, font=get_font(15, bold=True), fill=(34, 197, 94))
        
        words = desc
        lines = []
        cur_line = ""
        for char in words:
            if len(cur_line) >= 32:
                lines.append(cur_line)
                cur_line = char
            else:
                cur_line += char
        if cur_line:
            lines.append(cur_line)
            
        for idx, line in enumerate(lines[:3]):
            d.text((rx + 35, sy + 44 + idx * 20), line, font=get_font(12), fill=(180, 190, 205))
            
        sy += 120

    # Personality Dialog Preview Bubble
    d.rounded_rectangle((rx + 25, sy, rx + rw - 25, ry + rh - 25), radius=10, fill=(24, 45, 34), outline=(34, 197, 94), width=1)
    d.text((rx + 35, sy + 16), "💬 实际效果预览（Degen 交易员话风）：", font=get_font(14, bold=True), fill=(255, 255, 255))
    d.text((rx + 35, sy + 42), "• 刷到好帖：“这条懂我，戳到痛点了，我也反手点个赞”", font=get_font(12), fill=(200, 225, 215))
    d.text((rx + 35, sy + 66), "• 刚发完推：“发出去了…有点紧张，不知道有没有人互动”", font=get_font(12), fill=(200, 225, 215))
    d.text((rx + 35, sy + 90), "• 凌晨两点：“好晚啊…我也在纠结要不要睡，再刷五分钟吧”", font=get_font(12), fill=(200, 225, 215))

    out_file = os.path.join(STORE_DIR, 'screenshot_3_ai_generator.png')
    im.convert('RGB').save(out_file, quality=95)
    print(f'Generated {out_file}')

def create_promo_tile():
    """
    440x280 Promo Tile (小宣传图)
    """
    im = Image.new('RGBA', (440, 280), (18, 22, 30, 255))
    d = ImageDraw.Draw(im)

    d.rectangle((0, 0, 440, 280), fill=(22, 27, 36))
    d.rounded_rectangle((10, 10, 430, 270), radius=12, fill=(26, 32, 44), outline=(48, 58, 74), width=1)

    # Mascot with spring background
    bg_path = 'E:/Doc/Python_daye/CCbd/scenes/spring.webp'
    pet_path = 'E:/Doc/Python_daye/CCbd/sprites/chabit/working.webp'
    
    if os.path.exists(bg_path):
        bg_im = Image.open(bg_path).convert('RGBA').resize((140, 140), Image.LANCZOS)
        mask = Image.new('L', (140, 140), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 140, 140), fill=255)
        im.paste(bg_im, (22, 60), mask)
        
    if os.path.exists(pet_path):
        pet_im = Image.open(pet_path).convert('RGBA').resize((130, 130), Image.LANCZOS)
        im.alpha_composite(pet_im, (26, 68))

    d.text((180, 36), "CCbd 伴宠", font=get_font(24, bold=True), fill=(255, 255, 255))
    d.rounded_rectangle((305, 38, 385, 62), radius=4, fill=(34, 197, 94))
    d.text((315, 42), "v0.13.0", font=get_font(12, bold=True), fill=(255, 255, 255))
    
    d.text((180, 72), "陪你刷社交广场的“虚拟嘴替”", font=get_font(13), fill=(34, 197, 94))
    
    features = [
        "🐾 陪伴 𝕏 (推特) / 币安广场 / OK星球",
        "🎨 7 种手绘背景场景 · 右键平滑扩展",
        "✨ AI 一键定制专属人设与台词话风",
        "🔒 100% 纯本地运行 · 绝不打扰交易"
    ]
    for idx, f in enumerate(features):
        d.text((180, 102 + idx * 24), f, font=get_font(12), fill=(185, 195, 210))

    d.rounded_rectangle((180, 214, 400, 248), radius=6, fill=(34, 197, 94))
    d.text((232, 222), "免费安装 · 开源伴宠", font=get_font(13, bold=True), fill=(255, 255, 255))

    out_file = os.path.join(STORE_DIR, 'promo_small_440x280.png')
    im.convert('RGB').save(out_file, quality=95)
    print(f'Generated {out_file}')

if __name__ == '__main__':
    create_screenshot_1()
    create_screenshot_2_grid()
    create_screenshot_3()
    create_promo_tile()
    print('All store assets successfully updated!')
