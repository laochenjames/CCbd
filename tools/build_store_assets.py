"""
build_store_assets.py
Generates 1280x800 screenshots and 440x280 promo tiles for the Chrome Web Store.
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = r'E:/Doc/Python_daye/CCbd/store_assets'
os.makedirs(OUT_DIR, exist_ok=True)

FONT_MAIN = 'C:/Windows/Fonts/msyh.ttc'
FONT_EN = 'C:/Windows/Fonts/arial.ttf'

def get_font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_MAIN, size)
    except:
        return ImageFont.load_default()

def draw_header(d, title, subtitle):
    # Top banner gradient background
    f_t = get_font(34)
    f_sub = get_font(18)
    d.text((60, 42), title, font=f_t, fill=(255, 255, 255))
    d.text((60, 92), subtitle, font=f_sub, fill=(154, 160, 166))

def create_screenshot_1():
    # 1. 伴宠全家福与多平台陪伴
    im = Image.new('RGBA', (1280, 800), (20, 24, 30, 255))
    d = ImageDraw.Draw(im)
    
    # Background decorations
    d.rectangle((0, 0, 1280, 140), fill=(28, 33, 40))
    d.line([(0, 140), (1280, 140)], fill=(45, 52, 62), width=2)
    draw_header(d, "🐾 CCbd 伴宠 · 陪伴你逛推特、币安广场与OK星球", "专注陪伴 · 生理节律动效 · 治愈工位桌搭 · 绿色健康防沉迷")

    # Site badges row
    sites = [("𝕏 推特 (X/Twitter)", (30, 40, 52)), ("🟡 币安广场 (Binance Square)", (40, 36, 20)), ("🔵 OK星球 (OKX Orbit)", (20, 34, 50))]
    cur_x = 60
    for name, bg in sites:
        f = get_font(15)
        d.rounded_rectangle((cur_x, 160, cur_x + 230, 196), radius=8, fill=bg, outline=(70, 80, 95), width=1)
        d.text((cur_x + 18, 168), name, font=f, fill=(230, 235, 240))
        cur_x += 250
    d.text((cur_x + 10, 168), "★ 仅在类似推特的社交广场生效，绝不影响交易与盯盘", font=get_font(14), fill=(76, 194, 124))

    # 4 Character Showcase Cards
    chars = [
        ('teddy', '泰迪犬 · 暖心陪伴', 'sprites/teddy/idle.webp', (201, 188), '“发呆也是一种专注～慢慢来”'),
        ('cat',   '哈基米 · 傲娇猫咪', 'sprites/cat/idle.webp',   (199, 187), '“在用电脑吗？别摸鱼太久喵”'),
        ('doge',  '柴犬 · 呆萌元气',   'sprites/doge/busy.webp',  (200, 188), '“认真码字中！今天状态真棒”'),
        ('pepe',  '佩佩 · Web3交易员', 'sprites/pepe/idle.webp',  (200, 188), '“别慌老铁，K线波动是常态”'),
    ]

    card_w = 265
    card_h = 510
    start_y = 225

    for i, (cid, cname, path, (fw, fh), quote) in enumerate(chars):
        cx = 60 + i * (card_w + 35)
        # Card background
        d.rounded_rectangle((cx, start_y, cx + card_w, start_y + card_h), radius=14, fill=(28, 33, 42), outline=(52, 60, 72), width=1)
        # Header inside card
        d.text((cx + 18, start_y + 18), cname, font=get_font(17), fill=(255, 255, 255))
        
        # Stage background for character
        stage_h = 240
        d.rounded_rectangle((cx + 15, start_y + 55, cx + card_w - 15, start_y + 55 + stage_h), radius=10, fill=(18, 21, 26), outline=(40, 46, 56))
        
        # Load character sprite frame 0
        try:
            sp = Image.open(f'E:/Doc/Python_daye/CCbd/{path}').convert('RGBA')
            f0 = sp.crop((0, 0, fw, fh))
            # resize to fit
            sc = 190.0 / max(fw, fh)
            nw, nh = int(fw * sc), int(fh * sc)
            f0_scaled = f0.resize((nw, nh), Image.LANCZOS)
            px = cx + 15 + (card_w - 30 - nw) // 2
            py = start_y + 55 + (stage_h - nh) // 2 + 10
            im.alpha_composite(f0_scaled, (px, py))
        except Exception as e:
            print(f'Error loading {path}: {e}')

        # Dialogue bubble below
        bubble_y = start_y + 315
        d.rounded_rectangle((cx + 15, bubble_y, cx + card_w - 15, bubble_y + 90), radius=10, fill=(35, 42, 54), outline=(76, 194, 124), width=1)
        d.text((cx + 25, bubble_y + 14), "💬 伴宠碎碎念：", font=get_font(13), fill=(76, 194, 124))
        # wrap quote
        d.text((cx + 25, bubble_y + 40), quote, font=get_font(13), fill=(220, 225, 230))

        # Bottom tags
        tag_y = start_y + 425
        d.text((cx + 20, tag_y), "✓ 拟真呼吸/打盹/哈欠", font=get_font(13), fill=(154, 160, 166))
        d.text((cx + 20, tag_y + 26), "✓ 支持上传自定义图片", font=get_font(13), fill=(154, 160, 166))
        d.text((cx + 20, tag_y + 52), "✓ 19类动作全场景互动", font=get_font(13), fill=(154, 160, 166))

    im.convert('RGB').save(os.path.join(OUT_DIR, 'screenshot_1_overview.png'))
    print('Generated screenshot_1_overview.png')

def create_screenshot_2():
    # 2. AI 一键人设与台词生成器
    im = Image.new('RGB', (1280, 800), (20, 24, 30))
    d = ImageDraw.Draw(im)
    
    d.rectangle((0, 0, 1280, 140), fill=(28, 33, 40))
    d.line([(0, 140), (1280, 140)], fill=(45, 52, 62), width=2)
    draw_header(d, "✨ AI 角色人设与台词生成器 · 告别繁琐逐条配置", "内置优质人设模板 · 一键复制专用 Prompt · 粘贴 AI 回复即可极速完成全套导入")

    # Left Panel: Step 1 (Prompt Generator)
    left_w = 560
    d.rounded_rectangle((60, 170, 60 + left_w, 750), radius=14, fill=(28, 33, 42), outline=(52, 60, 72), width=1)
    d.text((85, 195), "第一步：定制人设 & 生成专用 Prompt", font=get_font(20), fill=(255, 255, 255))
    
    # Presets pills
    d.text((85, 240), "快捷人设灵感（一键点选填充）：", font=get_font(14), fill=(154, 160, 166))
    pills = ["🐸 Web3 Degen交易员", "🐱 傲娇吐槽猫咪", "🐕 元气忠诚柴柴", "💼 毒舌打工人秘书", "☕ 温柔治愈搭子"]
    px, py = 85, 272
    for p in pills[:3]:
        d.rounded_rectangle((px, py, px + 160, py + 34), radius=17, fill=(45, 54, 68), outline=(76, 194, 124))
        d.text((px + 12, py + 6), p, font=get_font(13), fill=(255, 255, 255))
        px += 175
    px, py = 85, 318
    for p in pills[3:]:
        d.rounded_rectangle((px, py, px + 175, py + 34), radius=17, fill=(35, 42, 54), outline=(60, 70, 84))
        d.text((px + 12, py + 6), p, font=get_font(13), fill=(200, 205, 215))
        px += 190

    # Fields preview
    d.text((85, 375), "角色形象: 🐸 佩佩蛙   |   角色名称: 炒币老韭菜佩佩", font=get_font(14), fill=(220, 225, 235))
    d.text((85, 405), "对你的称呼: 老铁       |   包含时段问候: 已勾选 (4个时段)", font=get_font(14), fill=(220, 225, 235))

    # Prompt Preview Box
    d.text((85, 445), "生成的专用 Prompt（包含19类场景动作与变量规范）：", font=get_font(14), fill=(76, 194, 124))
    d.rounded_rectangle((85, 475, 85 + left_w - 50, 680), radius=10, fill=(18, 21, 26), outline=(45, 52, 62))
    prompt_snippet = [
        "你是一名专属桌面伴宠（Desk Pet）台词与人设架构师。",
        "请为【CCbd 伴宠】设计一套充满个性的角色台词与配置。",
        "【伴宠设定要求】形象: 佩佩蛙，人设: Web3 Degen交易员...",
        "【台词规范与变量】严格使用 {min}, {n}, {left}, {xp}, {when}...",
        "1. click (平时点击伴宠): 3~6句",
        "2. post (发文/发推/回复后): 2~4句",
        "3. tired (连续使用较长提醒): 2~4句",
        "...",
        "请直接输出纯 JSON 数据，使用 ```json 包裹。"
    ]
    for idx, line in enumerate(prompt_snippet):
        d.text((100, 490 + idx * 20), line, font=get_font(12), fill=(160, 168, 178))

    d.rounded_rectangle((85, 695, 85 + left_w - 50, 735), radius=8, fill=(47, 158, 90))
    d.text((85 + 175, 704), "📋 一键复制 Prompt", font=get_font(16), fill=(255, 255, 255))

    # Right Panel: Step 2 (Import & Done)
    right_x = 650
    right_w = 570
    d.rounded_rectangle((right_x, 170, right_x + right_w, 750), radius=14, fill=(28, 33, 42), outline=(52, 60, 72), width=1)
    d.text((right_x + 25, 195), "第二步：粘贴 AI 回复 & 一键完成导入", font=get_font(20), fill=(255, 255, 255))
    d.text((right_x + 25, 235), "支持发送给 ChatGPT / Claude / DeepSeek / Kimi 等任意 AI：", font=get_font(14), fill=(154, 160, 166))

    # AI Output JSON Mockup
    d.rounded_rectangle((right_x + 25, 270, right_x + right_w - 25, 580), radius=10, fill=(18, 21, 26), outline=(45, 52, 62))
    json_lines = [
        "```json",
        "{",
        '  "name": "Degen 佩佩",',
        '  "look": "pepe",',
        '  "persona": "狂热且幽默的Web3老韭菜，敏锐关注行情",',
        '  "phrases": {',
        '    "click": ["在盯盘呢，别催", "大饼又突破了？稳住！"],',
        '    "post": ["投研小作文已发出，速速引爆广场！"],',
        '    "like": ["这个alpha观点有水平，点赞了"],',
        '    "tired": ["你已经盯盘 {min} 分钟了！K线不会跑，先喝口水"],',
        '    "night": ["凌晨还在看盘？健康才是最大的本金，睡吧老铁"],',
        '    "settled": ["{when} 到账 {gain} 经验，累计 {total}。{nextHint}"]',
        '  }',
        "}",
        "```"
    ]
    for idx, line in enumerate(json_lines):
        color = (130, 195, 255) if '"' in line and ':' in line else ((180, 230, 150) if '[' in line or '{' in line else (200, 210, 220))
        d.text((right_x + 40, 285 + idx * 19), line, font=get_font(13), fill=color)

    # Success Notice Card
    d.rounded_rectangle((right_x + 25, 600, right_x + right_w - 25, 665), radius=8, fill=(24, 45, 34), outline=(47, 158, 90))
    d.text((right_x + 40, 612), "🎉 解析成功：共导入 19 类 58 条台词，并同步更新 4 个时段问候", font=get_font(14), fill=(76, 194, 124))
    d.text((right_x + 40, 638), "✓ 自动去除代码块标记与逗号容错   ✓ 立即自动保存并实时生效", font=get_font(12), fill=(160, 210, 180))

    d.rounded_rectangle((right_x + 25, 685, right_x + right_w - 25, 735), radius=8, fill=(47, 158, 90))
    d.text((right_x + 185, 694), "🚀 一键解析并完成导入", font=get_font(17), fill=(255, 255, 255))

    im.save(os.path.join(OUT_DIR, 'screenshot_2_ai_generator.png'))
    print('Generated screenshot_2_ai_generator.png')

def create_screenshot_3():
    # 3. 工位装备 & 统计日历 & 隐私安全
    im = Image.new('RGB', (1280, 800), (20, 24, 30))
    d = ImageDraw.Draw(im)
    
    d.rectangle((0, 0, 1280, 140), fill=(28, 33, 40))
    d.line([(0, 140), (1280, 140)], fill=(45, 52, 62), width=2)
    draw_header(d, "🏆 工位伴侣装备随经验解锁 · 双层统计与防沉迷管理", "每天健康浏览区间奖励满额 XP · 自动累积装备 · 数据 100% 纯本地存储保护隐私")

    # Top Section: Desk Gear Unlock Roadmap
    d.rounded_rectangle((60, 165, 1220, 430), radius=14, fill=(28, 33, 42), outline=(52, 60, 72), width=1)
    d.text((85, 185), "工位伴侣装备（Desk Gear）随累计经验自动解锁", font=get_font(19), fill=(255, 255, 255))
    d.text((500, 188), "（纯矢量高清 SVG + 硬件加速微动效，优雅摆放身前桌角）", font=get_font(14), fill=(154, 160, 166))

    gears = [
        ("极简工位", "0 XP", "🪑", "返璞归真纯净工位"),
        ("暖心拿铁咖啡", "10 XP (1天)", "☕", "杯口升起缕缕白汽"),
        ("极客调试小黄鸭", "30 XP (3天)", "🐥", "程序员解压微弹"),
        ("治愈多肉绿植", "70 XP (7天)", "🪴", "清新饱满陶瓷多肉"),
        ("赛博霓虹电竞本", "140 XP (14天)", "💻", "RGB霓虹微光呼吸"),
        ("专注大师金奖杯", "300 XP (成就)", "🏆", "顶端星芒闪耀勋章"),
    ]

    gx = 85
    gw = 170
    for name, xp, icon, desc in gears:
        d.rounded_rectangle((gx, 230, gx + gw, 405), radius=10, fill=(20, 24, 30), outline=(48, 56, 68))
        d.text((gx + 15, 242), xp, font=get_font(12), fill=(76, 194, 124))
        d.text((gx + 15, 264), name, font=get_font(14), fill=(255, 255, 255))
        # icon
        d.text((gx + 62, 298), icon, font=get_font(38), fill=(255, 255, 255))
        d.text((gx + 15, 365), desc, font=get_font(12), fill=(154, 160, 166))
        gx += gw + 20

    # Bottom Left: Calendar & Stats
    d.rounded_rectangle((60, 455, 680, 755), radius=14, fill=(28, 33, 42), outline=(52, 60, 72), width=1)
    d.text((85, 475), "📊 双层行为统计与月度日历", font=get_font(18), fill=(255, 255, 255))
    d.text((85, 508), "• 全网合并总览：在线时长、发帖、点赞、收藏、关注、屏幕滚动距离", font=get_font(13), fill=(210, 215, 225))
    d.text((85, 536), "• 各站独立明细：推特、币安广场、OK星球各站数据独立清晰归类", font=get_font(13), fill=(210, 215, 225))
    d.text((85, 564), "• 健康时间区间：在预设区间内获满额经验，不催促、无惩罚", font=get_font(13), fill=(210, 215, 225))

    # Mini calendar mockup
    cal_x, cal_y = 85, 605
    days = ["一", "二", "三", "四", "五", "六", "日"]
    for i, day in enumerate(days):
        d.text((cal_x + i * 80 + 20, cal_y), day, font=get_font(12), fill=(130, 140, 150))
    for r in range(2):
        for c in range(7):
            bx, by = cal_x + c * 80, cal_y + 25 + r * 50
            fill_c = (24, 45, 34) if (r*7+c)%3 == 0 else (20, 24, 30)
            stroke_c = (47, 158, 90) if (r*7+c)%3 == 0 else (40, 46, 56)
            d.rounded_rectangle((bx, by, bx + 70, by + 42), radius=6, fill=fill_c, outline=stroke_c)
            d.text((bx + 8, by + 5), f"{r*7+c+1}", font=get_font(11), fill=(154, 160, 166))
            if (r*7+c)%3 == 0:
                d.text((bx + 8, by + 22), "52分 满额", font=get_font(10), fill=(76, 194, 124))

    # Bottom Right: Privacy & Local Safety
    d.rounded_rectangle((710, 455, 1220, 755), radius=14, fill=(28, 33, 42), outline=(52, 60, 72), width=1)
    d.text((735, 475), "🔒 100% 纯本地运行与严格隐私保护", font=get_font(18), fill=(76, 194, 124))
    
    security_points = [
        ("零服务器上传", "所有角色设定、台词与统计全保存在本地浏览器"),
        ("无第三方追踪", "无任何外部追踪代码、无用户隐私数据收集"),
        ("隔离安全设计", "仅在社交信息流页面挂载，绝不触碰任何交易钱包"),
        ("全局快捷开关", "Alt + P 或右上角图标一键唤出 / 隐藏伴宠"),
        ("完整数据控制", "随时支持一键导出备份、导入备份与彻底清除"),
    ]
    
    sy = 515
    for title, desc in security_points:
        d.text((735, sy), f"✔ {title}：", font=get_font(14), fill=(255, 255, 255))
        d.text((865, sy), desc, font=get_font(13), fill=(160, 170, 185))
        sy += 44

    im.save(os.path.join(OUT_DIR, 'screenshot_3_features.png'))
    print('Generated screenshot_3_features.png')

def create_promo_tile():
    # 440x280 small promo tile
    im = Image.new('RGBA', (440, 280), (20, 24, 30, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 440, 280), fill=(24, 28, 36))
    d.rounded_rectangle((10, 10, 430, 270), radius=12, fill=(28, 33, 42), outline=(52, 60, 72))
    
    # Load mascot
    sp = Image.open('E:/Doc/Python_daye/CCbd/sprites/teddy/idle.webp').convert('RGBA')
    f0 = sp.crop((0, 0, 201, 188)).resize((130, 122), Image.LANCZOS)
    im.alpha_composite(f0, (30, 75))
    
    d.text((180, 50), "CCbd 伴宠", font=get_font(26), fill=(255, 255, 255))
    d.text((180, 92), "社交广场卡通工位伴宠", font=get_font(14), fill=(76, 194, 124))
    d.text((180, 122), "• 陪伴推特 / 币安广场 / OK星球", font=get_font(12), fill=(180, 185, 195))
    d.text((180, 144), "• ✨ AI 一键定制专属人设与台词", font=get_font(12), fill=(180, 185, 195))
    d.text((180, 166), "• 治愈桌搭装备随陪伴经验解锁", font=get_font(12), fill=(180, 185, 195))
    d.text((180, 188), "• 纯本地运行 · 隐私安全防沉迷", font=get_font(12), fill=(180, 185, 195))

    d.rounded_rectangle((180, 222, 400, 250), radius=6, fill=(47, 158, 90))
    d.text((230, 228), "免费安装使用", font=get_font(13), fill=(255, 255, 255))

    im.convert('RGB').save(os.path.join(OUT_DIR, 'promo_small_440x280.png'))
    print('Generated promo_small_440x280.png')

if __name__ == '__main__':
    create_screenshot_1()
    create_screenshot_2()
    create_screenshot_3()
    create_promo_tile()
    print('All store graphics generated successfully!')
