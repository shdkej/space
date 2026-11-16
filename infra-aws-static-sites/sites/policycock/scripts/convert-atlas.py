#!/usr/bin/env python3
"""Optimize the Blender PNG as the website's self-hosted WebP asset."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'scripts' / 'institution-atlas.png'
target = root / 'dist' / 'assets' / 'institution-atlas.webp'
with Image.open(source) as image:
    if image.size != (1800, 1400):
        raise ValueError(f'Unexpected atlas size: {image.size}')
    image.convert('RGB').save(target, 'WEBP', quality=88, method=6)
print(f'Atlas WebP: {target} ({target.stat().st_size} bytes)')
