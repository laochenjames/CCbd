import os

html = '''<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<title>桌宠精灵图动效优化对比</title>
<style>
body { background: #181b1f; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 28px; }
h1 { margin-bottom: 6px; font-size: 24px; font-weight: 700; color: #58a6ff; }
p.desc { color: #8b949e; margin-bottom: 28px; font-size: 14px; max-width: 800px; line-height: 1.6; }
.section-title { font-size: 18px; margin: 30px 0 16px 0; border-bottom: 1px solid #30363d; padding-bottom: 8px; color: #f0f6fc; }
.grid { display: flex; flex-wrap: wrap; gap: 24px; }
.card { background: #21262d; border-radius: 12px; padding: 18px; border: 1px solid #30363d; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.card-title { font-weight: 600; margin-bottom: 14px; font-size: 15px; color: #f0f6fc; }
.compare { display: flex; gap: 24px; }
.col { text-align: center; }
.col-label { font-size: 12px; margin-bottom: 8px; }
.label-old { color: #f85149; }
.label-new { color: #3fb950; font-weight: 600; }
.stage { width: 140px; height: 130px; position: relative; background: radial-gradient(circle at 50% 85%, #2d333b 0%, #161b22 100%); border-radius: 10px; border: 1px solid #30363d; display: flex; align-items: flex-end; justify-content: center; }
.sprite { background-repeat: no-repeat; background-position: 0% 100%; image-rendering: -webkit-optimize-contrast; }
@keyframes anim { from { background-position-x: 0%; } to { background-position-x: 100%; } }
</style>
</head>
<body>
<h1>🐾 X 桌宠（CCbd）精灵图动效优化对比</h1>
<p class='desc'>
诊断发现原版存在两大核心问题：<br>
1. <b>帧率严重失调</b>：除 sleepy 外所有动作写死为 24fps（18帧仅用 0.75秒循环），动作高频抽动慌乱；<br>
2. <b>外层 CSS 冲突</b>：开启精灵图时外层容器仍在执行 3秒周期的机械呼吸挤压，点击时又叠加强制 22px 向上蹦起，与精灵图自带的位移动画产生剧烈干扰。
</p>

<div class='section-title'>各状态节奏对比（原版 24fps 抽动 vs 优化后生理自然节奏）</div>
<div class='grid'>
'''

chars = [
    ('teddy', '泰迪犬', 201, 188, [
        ('idle', '待机微呼吸', 18, 24, 9, '原版 0.75s 像心动过速；优化为 9fps (2.0s) 平静呼吸'),
        ('busy', '工作/打字', 18, 24, 12, '原版缝纫机手速；优化为 12fps (1.5s) 节奏明朗'),
        ('sleepy', '打盹入睡', 24, 10, 8, '微调为 8fps (3.0s)，起伏深沉安详'),
        ('yawn', '深夜哈欠', 18, 24, 7, '原版 0.75s 狂叫；优化为 7fps (2.57s) 真实困倦感'),
        ('poke', '点击弹跳', 18, 24, 13, '原版循环抽动2次；优化为 13fps (1.38s) 单次完整弹性起落')
    ]),
    ('cat', '哈基米', 245, 220, [
        ('idle', '待机微呼吸', 18, 24, 9, '2.0s 舒缓发呆'),
        ('busy', '工作/看电脑', 18, 24, 12, '1.5s 专注办公'),
        ('sleepy', '打盹入睡', 24, 10, 8, '3.0s 深沉睡眠'),
        ('yawn', '深夜哈欠', 18, 24, 7, '2.57s 困意哈欠'),
        ('poke', '点击弹跳', 18, 24, 13, '1.38s 受击回弹')
    ])
]

for char, char_name, fw, fh, states in chars:
    scale = 92.0 / fh
    w = int(round(fw * scale))
    h = int(round(fh * scale))
    for st, st_name, frames, old_fps, new_fps, note in states:
        url = f'sprites/{char}/{st}.webp'
        old_dur = frames / old_fps
        new_dur = frames / new_fps
        html += f'''
        <div class='card'>
            <div class='card-title'>{char_name} - {st_name} ({st})</div>
            <div style='font-size:12px; color:#8b949e; margin-bottom:10px;'>{note}</div>
            <div class='compare'>
                <div class='col'>
                    <div class='col-label label-old'>原版: {old_fps}fps ({old_dur:.2f}s)</div>
                    <div class='stage'>
                        <div class='sprite' style='width:{w}px; height:{h}px; background-image:url("{url}"); background-size:{frames*100}% 100%; animation: anim {old_dur:.3f}s steps({frames}, jump-none) infinite;'></div>
                    </div>
                </div>
                <div class='col'>
                    <div class='col-label label-new'>优化后: {new_fps}fps ({new_dur:.2f}s)</div>
                    <div class='stage'>
                        <div class='sprite' style='width:{w}px; height:{h}px; background-image:url("{url}"); background-size:{frames*100}% 100%; animation: anim {new_dur:.3f}s steps({frames}, jump-none) infinite;'></div>
                    </div>
                </div>
            </div>
        </div>
        '''

html += '</div></body></html>'
preview_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'preview_test.html')
with open(preview_path, 'w', encoding='utf-8') as f:
    f.write(html)
print('Done!')
