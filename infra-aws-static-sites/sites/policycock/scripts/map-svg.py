"""Generate a lightweight presentation map from the cited KOSTAT 2013 geometry."""
import json, sys, html
from pathlib import Path
geo=json.load(open(sys.argv[1]))
def xy(p):
    lng,lat=p[:2]
    return (100+(lng-125.0)*102, 55+(38.8-lat)*98)
def paths(geometry):
    polys=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    result=[]
    for poly in polys:
        for ring in poly:
            if len(ring)<4: continue
            points=[xy(p) for p in ring]
            # Avoid subpixel islands in this illustrative, non-navigational map.
            if max(p[0] for p in points)-min(p[0] for p in points)<1: continue
            result.append('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in points)+'Z')
    return ''.join(result)
features=[]
for i,f in enumerate(geo['features']):
    features.append(f'<path d="{paths(f["geometry"])}" class="land land-{i%4}"/>')
shapes=''.join(features)
svg=f'''<svg class="korea-map" viewBox="0 0 700 650" role="img" aria-labelledby="map-title map-desc">
<title id="map-title">대한민국 국회와 17개 광역의회 지도</title><desc id="map-desc">입체로 표현한 대한민국 개략 지도입니다. 서울부터 제주까지 의회 위치를 표시합니다. 아래 의회 목록에서도 같은 링크에 접근할 수 있습니다.</desc>
<defs><filter id="map-shadow" x="-40%" y="-30%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
<linearGradient id="map-side" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a5b7be"/><stop offset="1" stop-color="#c7d2d3"/></linearGradient>
<radialGradient id="map-light"><stop stop-color="#f8fbed"/><stop offset="1" stop-color="#dbe9e9"/></radialGradient></defs>
<ellipse cx="360" cy="410" rx="220" ry="150" fill="#718b8d" opacity=".13" filter="url(#map-shadow)"/>
<g class="map-contours" transform="translate(0,18)" fill="url(#map-side)" stroke="#a6b8be" stroke-width="1">{shapes}</g>
<g class="map-top" stroke="#fbfdfa" stroke-width="1.3" stroke-linejoin="round">{shapes}</g>
<text x="99" y="320" class="sea-label">서 해</text><text x="565" y="245" class="sea-label">동 해</text><text x="455" y="570" class="sea-label">남 해</text>
<g class="island-note"><circle cx="635" cy="223" r="2"/><text x="628" y="244">독도</text></g>
<g id="council-pins"></g>
</svg>'''
Path(sys.argv[2]).write_text(svg)
