#!/usr/bin/env python3
"""Generate the purely decorative, self-hosted urban glass hero illustration."""
from pathlib import Path
import random

random.seed(27)
parts = ['''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700" role="img" aria-label="추상적인 도시 모형과 유리 조형물">
<defs>
  <linearGradient id="sky" x2=".75" y2="1"><stop stop-color="#080e27"/><stop offset=".52" stop-color="#12254a"/><stop offset="1" stop-color="#45406c"/></linearGradient>
  <radialGradient id="halo"><stop stop-color="#b59dff" stop-opacity=".52"/><stop offset=".55" stop-color="#6f88df" stop-opacity=".17"/><stop offset="1" stop-color="#15234d" stop-opacity="0"/></radialGradient>
  <linearGradient id="floor" x2=".5" y2="1"><stop stop-color="#b5a8d7"/><stop offset=".42" stop-color="#2b3866"/><stop offset="1" stop-color="#090f29"/></linearGradient>
  <linearGradient id="facade" x2="1" y2=".65"><stop stop-color="#fafbff"/><stop offset=".48" stop-color="#d3dced"/><stop offset="1" stop-color="#8e9bbf"/></linearGradient>
  <linearGradient id="side" x2="1" y2=".6"><stop stop-color="#9eadcd"/><stop offset="1" stop-color="#58699c"/></linearGradient>
  <linearGradient id="top"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#c4cbea"/></linearGradient>
  <linearGradient id="glass" x2=".7" y2="1"><stop stop-color="#f4d8ff" stop-opacity=".75"/><stop offset=".25" stop-color="#9dbdff" stop-opacity=".15"/><stop offset=".8" stop-color="#6383eb" stop-opacity=".31"/><stop offset="1" stop-color="#131f6c" stop-opacity=".66"/></linearGradient>
  <linearGradient id="glass-side" x2="1" y2=".7"><stop stop-color="#6f77e6" stop-opacity=".34"/><stop offset=".52" stop-color="#e3c5ff" stop-opacity=".56"/><stop offset="1" stop-color="#252b89" stop-opacity=".53"/></linearGradient>
  <linearGradient id="glass-top" x2=".9" y2="1"><stop stop-color="#f4e2ff" stop-opacity=".82"/><stop offset="1" stop-color="#8175d2" stop-opacity=".19"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="21"/></filter>
  <filter id="shadow"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
<rect width="1600" height="700" fill="url(#sky)"/>
<ellipse cx="800" cy="350" rx="700" ry="350" fill="url(#halo)"/>
<path d="M0 397 122 388 243 403 362 381 481 399 629 362 773 392 930 362 1070 398 1247 366 1410 398 1600 382V700H0Z" fill="#111e3d" opacity=".75"/>
<path d="M0 449 145 434 314 457 468 433 633 450 773 431 939 450 1123 423 1341 451 1518 425 1600 435V700H0Z" fill="#253459" opacity=".7"/>
<path d="M0 536 800 392 1600 527 800 700Z" fill="url(#floor)"/>
<path d="M0 536 800 392 1600 527M0 536 800 700 1600 527" fill="none" stroke="#d2c0f4" stroke-opacity=".3" stroke-width="2"/>
<g opacity=".23" stroke="#b9bdff" stroke-width="1">''']
for k in range(1, 9):
    t = k / 9
    parts.append(f'<path d="M{round(800*t)} {round(392+144*(1-t))} {round(800+800*t)} {round(700-173*t)}"/>')
for y in range(460, 690, 39):
    parts.append(f'<path d="M0 {y} Q800 {y-150} 1600 {y-6}"/>')
parts.append('</g><ellipse cx="818" cy="569" rx="390" ry="60" fill="#1b144a" opacity=".75" filter="url(#shadow)"/>')

def building(x, y, w, depth, height, opacity: float = 1.0):
    # One architectural model: three visible faces and measured light/shadow.
    slope = round(w * .12)
    roof = f'{x},{y-height} {x+w},{y-height-slope} {x+w+depth},{y-height-slope-round(depth*.34)} {x+depth},{y-height-round(depth*.34)}'
    front = f'{x},{y-height} {x+w},{y-height-slope} {x+w},{y-slope} {x},{y}'
    side = f'{x+w},{y-height-slope} {x+w+depth},{y-height-slope-round(depth*.34)} {x+w+depth},{y-slope-round(depth*.34)} {x+w},{y-slope}'
    parts.append(f'<g opacity="{opacity}"><polygon points="{side}" fill="url(#side)"/><polygon points="{front}" fill="url(#facade)"/><polygon points="{roof}" fill="url(#top)" stroke="#fff" stroke-opacity=".9" stroke-width="1.5"/>')
    for row in range(1, max(2, int(height / 21))):
        if row*21 > height-8: break
        yy = y-row*21
        parts.append(f'<path d="M{x+7} {yy} {x+w-6} {round(yy-slope+1)}" fill="none" stroke="#8999b8" stroke-opacity=".43" stroke-width="1"/>')
    for col in range(1, max(2, int(w/18))):
        xx=x+col*18
        if xx > x+w-8: break
        parts.append(f'<path d="M{xx} {y-height+6-round((xx-x)*.12)}v{height-13}" stroke="#9daac8" stroke-opacity=".37" stroke-width="1"/>')
    parts.append(f'<path d="M{x+w} {y-slope}V{y-height-slope}" stroke="#fff" stroke-opacity=".7" stroke-width="1"/></g>')

# Rear skyline, off-axis arrangements leave the central glass artwork unobscured.
for i in range(31):
    x = 85+i*47+random.randint(-8, 8)
    if 580 < x < 995: continue
    y = 469+int(abs(x-800)*.055)+random.randint(-13, 14)
    building(x,y,random.randint(22,49),random.randint(11,23),random.randint(45,136),.31)
# Deep perspective buildings in two neighborhoods.
for i in range(17):
    x=60+i*39+random.randint(-10, 8)
    if x>585: continue
    y=531+int((x/600)*28)+random.randint(-13,15)
    building(x,y,random.randint(29,68),random.randint(16,34),random.randint(36,168),.8)
for i in range(18):
    x=970+i*34+random.randint(-9, 8)
    if x>1524: break
    y=540-int((x-970)*.037)+random.randint(-10,15)
    building(x,y,random.randint(25,65),random.randint(14,36),random.randint(44,178),.83)

# Luminous glass monument is isolated from the architectural miniature.
parts.append('''<g filter="url(#glow)" opacity=".6"><ellipse cx="812" cy="540" rx="250" ry="72" fill="#b5a4ff"/></g>
<path d="M592 513 814 556 1050 511 824 463Z" fill="#baa7ff" opacity=".36"/>
<path d="M610 545 800 589 1036 540 836 490Z" fill="#1a2159" opacity=".7"/>
<g>
  <path d="M653 296 849 261 849 534 653 567Z" fill="url(#glass)" stroke="#d6d1ff" stroke-opacity=".76" stroke-width="2"/>
  <path d="M849 261 1017 300 1017 563 849 534Z" fill="url(#glass-side)" stroke="#b8b2ff" stroke-opacity=".8" stroke-width="2"/>
  <path d="M653 296 817 254 1017 300 849 340Z" fill="url(#glass-top)" stroke="#efdbff" stroke-opacity=".85" stroke-width="2"/>
  <path d="M653 296 849 340 849 534M849 340 1017 300" fill="none" stroke="#e7d9ff" stroke-opacity=".57" stroke-width="2"/>
  <defs><clipPath id="crystal-front"><path d="M654 296 848 340V533L654 566Z"/></clipPath></defs>
  <g clip-path="url(#crystal-front)">
    <path d="M646 458 689 431 722 445 766 409 803 429 853 401V561H646Z" fill="#8270ce" opacity=".31"/>
    <path d="M646 490 686 467 732 482 787 446 846 468V563H646Z" fill="#b6a4f8" opacity=".4"/>
    <path d="M645 521 708 493 743 509 793 480 855 501V571H645Z" fill="#493f9b" opacity=".36"/>
    <path d="M651 485 792 456 855 474M641 535 765 508 854 519" stroke="#f0d3ff" stroke-width="2" opacity=".37" fill="none"/>
    <path d="M664 309 695 305 757 527 719 541Z" fill="#f9e5ff" opacity=".1"/>
  </g>
  <path d="M663 379 753 355 834 371 834 519 663 546Z" fill="#9c9bf8" opacity=".11"/>
  <path d="M881 351 1003 321V529L881 516Z" fill="#c8b6ff" opacity=".11"/>
  <path d="M680 487 799 510 831 506M876 486 987 514" fill="none" stroke="#dfcdff" stroke-opacity=".38" stroke-width="2"/>
  <path d="M661 303 661 545M849 267 849 532M1009 305 1009 541" stroke="#fff" stroke-opacity=".65" stroke-width="3"/>
  <path d="M666 307 817 270" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
</g>
<path d="M579 578 812 631 1093 575" fill="none" stroke="#c9b3fc" stroke-opacity=".45" stroke-width="2"/>
''')
# Small floating lighting fragments, like city illumination, not functional markers.
for x,y in [(355,399),(528,460),(1175,409),(1283,466)]:
    parts.append(f'<circle cx="{x}" cy="{y}" r="3" fill="#d6c2ff" opacity=".7"/><circle cx="{x}" cy="{y}" r="15" fill="#c8a8ff" opacity=".16"/>')
parts.append('</svg>')
out=Path(__file__).resolve().parents[1]/'dist/assets/urban-glass.svg'
out.write_text('\n'.join(parts)+'\n',encoding='utf-8')
print(out)
