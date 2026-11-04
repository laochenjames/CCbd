"""
package_release.py
Packages CCbd into a clean release zip file ready for Chrome Web Store upload.
"""

import os
import zipfile

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_ZIP = os.path.join(BASE_DIR, 'ccbd-v0.11.0.zip')

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
]

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
                        zf.write(full_path, arcname=rel_path)
                print(f' + {dname}/')

    size_mb = os.path.getsize(OUTPUT_ZIP) / (1024 * 1024)
    print(f'Release zip created successfully! Size: {size_mb:.2f} MB')

if __name__ == '__main__':
    make_zip()
