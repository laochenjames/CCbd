"""
package_release.py
Packages CCbd into a clean release zip file ready for Chrome Web Store upload.
"""

import json
import os
import shutil
import subprocess
import sys
import zipfile

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(BASE_DIR, 'manifest.json'), 'r', encoding='utf-8') as f:
    VERSION = json.load(f).get('version', '0.13.0')
OUTPUT_ZIP = os.path.join(BASE_DIR, f'ccbd-v{VERSION}.zip')

INCLUDE_FILES = [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'popup.js',
    'popup.css',
    'options.html',
    'options.js',
    'options.css',
    'pet.css',
    'shared.js',
    'stories.js',
]

INCLUDE_DIRS = [
    'icons',
    'sprites',
    'scenes',
]

# 这一版只带小桌宠：teddy / cat / doge / pepe 的素材仍留在仓库里，但不打进包（恢复角色时把目录名加回这里）
SPRITE_DIRS_IN_PACKAGE = {'chabit'}

def make_zip():
    if os.path.exists(OUTPUT_ZIP):
        os.remove(OUTPUT_ZIP)

    print(f'Creating release zip: {OUTPUT_ZIP}')
    with zipfile.ZipFile(OUTPUT_ZIP, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        # 1. Add top-level files
        for fname in INCLUDE_FILES:
            fpath = os.path.join(BASE_DIR, fname)
            if os.path.exists(fpath):
                zf.write(fpath, arcname=fname)
                print(f' + {fname}')
            else:
                print(f' ! Warning: file not found: {fname}')

        # 2. Add directories
        for dname in INCLUDE_DIRS:
            dpath = os.path.join(BASE_DIR, dname)
            if os.path.exists(dpath):
                for root, dirs, files in os.walk(dpath):
                    for file in files:
                        full_path = os.path.join(root, file)
                        rel_path = os.path.relpath(full_path, BASE_DIR)
                        if dname == 'sprites' and rel_path.split(os.sep)[1] not in SPRITE_DIRS_IN_PACKAGE:
                            continue
                        zf.write(full_path, arcname=rel_path)
                print(f' + {dname}/')

    size_mb = os.path.getsize(OUTPUT_ZIP) / (1024 * 1024)
    print(f'Release zip created successfully! Size: {size_mb:.2f} MB')

def run_tests():
    """打包前先跑站点规则测试、语气 lint、场景测试及语法检查；任何一个失败就中止打包。没装 Node.js 时只警告，不阻断。"""
    node = shutil.which('node')
    if not node:
        print(' ! Warning: node not found, skipping site-rule tests and tone lint (install Node.js to enable them).')
        return

    # 1. 语法检查 (node --check)
    check_files = ['content.js', 'options.js', 'background.js', 'popup.js', 'shared.js', 'stories.js']
    for js_file in check_files:
        fpath = os.path.join(BASE_DIR, js_file)
        result = subprocess.run([node, '--check', fpath], cwd=BASE_DIR)
        if result.returncode != 0:
            print(f'Syntax check failed on {js_file}; aborting packaging.')
            sys.exit(result.returncode)

    # 2. 自动化测试脚本
    for script in ('tools/test_site_rules.js', 'tools/lint_tone.js', 'tools/test_announcer.js', 'tools/test_scenes.js'):
        print(f'Running {script} ...')
        result = subprocess.run([node, os.path.join(BASE_DIR, script)], cwd=BASE_DIR)
        if result.returncode != 0:
            print(f'Tests failed ({script}); aborting packaging.')
            sys.exit(result.returncode)


if __name__ == '__main__':
    run_tests()
    make_zip()

