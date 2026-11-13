# LCML 배경·캐릭터 생성 프롬프트

## 인물별 스프라이트 — 2026-11-13

기존 `characters.png`를 편집 대상으로 imagegen 내장 도구로 아래 8개 시트를 생성했습니다. 대표는 기존 시트를 유지합니다. 모든 생성 원본은 1448×1086 RGBA이며, FFmpeg libwebp quality 90 / compression level 6으로 크기·좌표·알파를 유지해 WebP로 인코딩했습니다. 최종 자산은 `public/assets/characters-<id>.webp`입니다.

공통 프롬프트:

```text
Use case: precise-object-edit. Asset: transparent animation sprite sheet for a miniature office web app.
The supplied image is the EDIT TARGET. Replace the repeated person with the SAME NEW CHARACTER described below in ALL TWELVE frames. Preserve the original high quality soft handmade clay 3D illustration style, rounded proportions, friendly large head, isometric three-quarter view facing right, warm soft lighting.
EXACT layout invariant: 4 equal columns x 3 equal rows, 12 equal SQUARE cells in a 4:3 image. All 12 characters must fit within their own cell, centered at the same relative position and scale as original, no overlaps, no clipping, no extra cells, no labels or furniture. Every cell has identical generous transparent padding.
EXACT poses: row 1 = four slightly different seated typing poses, hands extended (no desk, no chair). Row 2 = walking step A, walking step B, standing arms-raised celebration, standing with coffee mug. Row 3 = seated holding coffee, seated sleepy with eyes closed holding coffee, crouched long-wait pose, standing neutral. Preserve original pose locations and silhouette sizes. Clothing, head, hairstyle, accessories must be consistent across all 12 poses. Actual transparent RGBA background, not a checkerboard, no background, no floor, no cast shadow extending outside a cell, no text, no borders. Treat as a production sprite sheet, not a contact sheet. Render landscape 1536x1152 or equivalent exact 4:3 with square cells.
NEW CHARACTER: <appearance from table>
```

| id | Appearance |
| --- | --- |
| genie | short straight blue-black hair with a side fringe, large over-ear navy headphones, muted denim-blue chore jacket over ivory shirt, charcoal trousers, light sneakers |
| main | neatly side-parted salt-and-pepper hair, round dark spectacles, dark olive cardigan over cream collared shirt, warm brown trousers, brown shoes |
| marketing | bald head, small round orange glasses, burnt-orange knit sweater, dark brown trousers and beige shoes; friendly mature face, no beard |
| design | short chin-length black bob haircut with bangs, mustard yellow beret, dusty plum loose overshirt, ivory trousers, dark shoes |
| red | close-cropped curly black hair, neat short dark beard, brick-red work jacket over charcoal shirt, navy trousers, brown boots |
| hj | medium-length chestnut hair tied into a high ponytail, sage green lightweight jacket over ivory shirt, tan trousers, white sneakers |
| taxops | smooth silver-grey hair in a neat bun, narrow dark rectangular glasses, muted teal waistcoat over white shirt, dark charcoal trousers, black shoes |
| codex | a friendly small humanoid robot assistant with matte ivory rounded head, a dark rectangular face panel with two tiny warm amber eyes, muted indigo utility jacket, graphite trousers, ivory shoes. Same clay handmade style and full 12 human-like office poses. Distinctly a robot, no human hair. |


## connected-building

저장: `public/assets/building.png` (1024×1536). 아래 기존 층별 4개 이미지를 스타일/인테리어 참조로 사용해, 하나의 연결된 건물 단면을 imagegen 내장 도구로 생성했습니다. 사람과 실제 작업 정보는 DOM 레이어로 표시합니다.

```text
Create one portrait 1024x1536 architectural visualization asset for LCML office web app. The four attached images are style/interior REFERENCES ONLY. Transform these four rooms into ONE REAL CONNECTED FOUR-STORY BUILDING shown as a front cutaway dollhouse, stacked VERTICALLY, fourth story directly above third directly above second directly above first. Exactly FOUR inhabitable stories, no fifth floor, no basement. This is NOT a grid, collage, separated exploded-view diagram, cards, or floating slabs. Floors physically join the same continuous structural columns, same footprint, shared solid left elevator shaft and continuous rear wall. Exterior Barcelona Disseny Hub inspired sculptural warm grey zinc/concrete museum architecture, pale limestone, oak, soft warm lighting. Premium photoreal miniature architectural render. Camera orthographic near-frontal three-quarter perspective (only slight view from right and modest above) so each of four story interiors is clearly visible through fully removed front facade. Each story has generous tall clear space for overlaying small human sprites. A flat thin roof caps the top; every floor slab aligns across the full width. Building fills almost entire portrait with small cream #f5f1e9 margins, isolated ground shadow. Main usable central scene x20%-85%; left core/elevator x9%-21%. Four floor interiors occupy four approximately equal horizontal bands, top to bottom. Elegant believable building, warm inviting inhabited furniture but NO PEOPLE.
TOP story / owner: one walnut executive desk and forest-green chair at center, sage waiting bench and glass garden reading corner on right. Calm and spacious.
SECOND from TOP / business: long dark walnut conference table across center, burgundy chairs, strategy card panel and bookshelves.
THIRD from TOP / customer: orange/terracotta circular interview lounge in center, a workshop corner and five colored translucent customer-journey panels on right.
GROUND story / product: blue-chair computer workbenches across center, server rack on left, knowledge library/workbench on right.
Each floor has one BLANK wide cream whiteboard on rear wall in a visible area at left/center-left, no writing or marks. Keep clear floor walking lanes in front of furnishings on every story for animated characters to be added by app. Furniture should stay consistent with provided references while adapting to this connected building cutaway.
No text, letters, numerals, icons, UI, charts with data, watermarks, signage, people or characters. Software adds all labels and people. No extra floor, no split disconnected rooms.
```

2026-11-11 사용자 요청에 따라 imagegen 내장 도구로 기존 사무실 이미지를 편집했습니다. 기준 이미지: `public/assets/office.png`. 캐릭터 스프라이트는 별도 레이어입니다.

## product

저장: `public/assets/floor-product.png`

```text
Use case: precise-object-edit. Asset: isometric LCML office floor background for an interactive web app, landscape 1536x1024.
Edit the supplied office architectural render. Keep the same high-end miniature architectural visualization quality, warm Barcelona Disseny Hub museum atmosphere, zinc/concrete structural shell, soft cream off-white backdrop (#f5f1e9), orthographic isometric camera, exact floor footprint, large right rear windows, and elevator at far left foreground. No people anywhere; software will add animated people later.
IMPORTANT invariants: retain the large EMPTY ivory whiteboard at the exact same back-left wall position and quadrilateral as the reference (rough bounding box x24%-42%, y21%-45%). It must be completely blank. Retain left elevator location x10%-18%, y49%-68%. Keep cutaway front walls low and the whole floor slab visible, with generous uninterrupted walking paths. No text, letters, logos, numbers, graphs with values, watermarks, or UI. Do not put tiny fake text on any paper or screen. Screens may show abstract luminous shapes only.
Completely redesign the interior furniture layout for this floor's function so it is visually unmistakable at thumbnail scale; it must not look like a recolor of the original three-desk office. Retain shared architectural identity. Render full room beautifully in soft daylight, not a flat diagram.
FLOOR 1 — PRODUCT DEVELOPMENT LAB, led by Genie. This is an active product-making studio. Build three clearly differentiated work zones: left-central development bench with dual monitors and a small dark blue server rack near elevator; right-central execution/operations bench with organized task trays and several monitors; foreground knowledge library workbench with a low double-sided bookcase and open reference folios. Center layout still allows multiple collaborating software workers. Replace the entire old lounge and glass meeting room: put an electronics/prototyping workshop with precision tools and small white geometric mockups in the right glazed room, and equipment shelving along the rear. Furniture: brushed aluminum, pale oak, slate blue task chairs, low pegboard storage, careful cobalt details. Visible maker workbenches and server equipment distinguish this floor from the other floors. No decorative seating circle, no executive desk, no large boardroom table. Leave floor pathways for sprites. Empty seats.
```

## customer

저장: `public/assets/floor-customer.png`

```text
Use case: precise-object-edit. Asset: isometric LCML office floor background for an interactive web app, landscape 1536x1024.
Edit the supplied office architectural render. Keep the same high-end miniature architectural visualization quality, warm Barcelona Disseny Hub museum atmosphere, zinc/concrete structural shell, soft cream off-white backdrop (#f5f1e9), orthographic isometric camera, exact floor footprint, large right rear windows, and elevator at far left foreground. No people anywhere; software will add animated people later.
IMPORTANT invariants: retain the large EMPTY ivory whiteboard at the exact same back-left wall position and quadrilateral as the reference (rough bounding box x24%-42%, y21%-45%). It must be completely blank. Retain left elevator location x10%-18%, y49%-68%. Keep cutaway front walls low and the whole floor slab visible, with generous uninterrupted walking paths. No text, letters, logos, numbers, graphs with values, watermarks, or UI. Do not put tiny fake text on any paper or screen. Screens may show abstract luminous shapes only.
Completely redesign the interior furniture layout for this floor's function so it is visually unmistakable at thumbnail scale; it must not look like a recolor of the original three-desk office. Retain shared architectural identity. Render full room beautifully in soft daylight, not a flat diagram.
FLOOR 2 — CUSTOMER RESEARCH & GROWTH STUDIO, led by Godin. Remove ALL old rows of computer desks. Main centerpiece: a welcoming circular interview lounge on a large terracotta circular rug, four sculptural warm coral/orange armchairs around a low round table, with a small recording microphone on a side pedestal. Front right: a collaborative rounded workshop table with three colorful chairs and physical blank research cards laid out. The right glazed room becomes a usability interview booth with TWO chairs facing one another and one single screen, not a boardroom. Along the right rear window side, place FIVE sculptural vertical freestanding translucent panels in a descending/ascending journey arrangement, with empty peach, amber, sage, dusty blue, lavender tinted surfaces (no printed chart or text), representing stages of a customer journey. Back left whiteboard must remain blank. Small pinboard with unmarked colored card swatches beside the elevator, paper material samples on a shelf. Warm social research atelier, pink-clay upholstery, honey oak, cream limestone. This should be recognizably a place to meet/listen to customers from silhouette alone. No rows of coding stations.
```

## business

저장: `public/assets/floor-business.png`

```text
Use case: precise-object-edit. Asset: isometric LCML office floor background for an interactive web app, landscape 1536x1024.
Edit the supplied office architectural render. Keep the same high-end miniature architectural visualization quality, warm Barcelona Disseny Hub museum atmosphere, zinc/concrete structural shell, soft cream off-white backdrop (#f5f1e9), orthographic isometric camera, exact floor footprint, large right rear windows, and elevator at far left foreground. No people anywhere; software will add animated people later.
IMPORTANT invariants: retain the large EMPTY ivory whiteboard at the exact same back-left wall position and quadrilateral as the reference (rough bounding box x24%-42%, y21%-45%). It must be completely blank. Retain left elevator location x10%-18%, y49%-68%. Keep cutaway front walls low and the whole floor slab visible, with generous uninterrupted walking paths. No text, letters, logos, numbers, graphs with values, watermarks, or UI. Do not put tiny fake text on any paper or screen. Screens may show abstract luminous shapes only.
Completely redesign the interior furniture layout for this floor's function so it is visually unmistakable at thumbnail scale; it must not look like a recolor of the original three-desk office. Retain shared architectural identity. Render full room beautifully in soft daylight, not a flat diagram.
FLOOR 3 — BUSINESS STRATEGY & HYPOTHESIS ROOM, led by SAM. Remove ALL old individual computer desk rows and casual round lounge. Dominant centerpiece is one long beautifully crafted dark walnut boat-shaped conference table laid diagonally across the middle of the room, six deep burgundy upholstered chairs, a few closed folders and simple blank cream strategy cards laid in three organized clusters. A low physical geometric planning model on the table, no readable text. The right glazed room is now a quiet strategic research library with tall dark walnut shelves, a single small side consulting table and two chairs. On the rear right wall/window-adjacent area place a large mobile cream planning panel with a sparse network of thin red thread and plain blank paper cards, and three vertical material sample frames for strategy/value/hypothesis. Preserve the original empty large back-left wall whiteboard exactly. Two low storage credenzas with organized archived binders, sculptural floor lamp, quiet sophisticated strategy studio. Dark walnut and burgundy/muted brass make it distinct. Leave wide clear walking paths along the front and left elevator. No code desks or orange interview circle.
```

## owner

저장: `public/assets/floor-owner.png`

```text
Use case: precise-object-edit. Asset: isometric LCML office floor background for an interactive web app, landscape 1536x1024.
Edit the supplied office architectural render. Keep the same high-end miniature architectural visualization quality, warm Barcelona Disseny Hub museum atmosphere, zinc/concrete structural shell, soft cream off-white backdrop (#f5f1e9), orthographic isometric camera, exact floor footprint, large right rear windows, and elevator at far left foreground. No people anywhere; software will add animated people later.
IMPORTANT invariants: retain the large EMPTY ivory whiteboard at the exact same back-left wall position and quadrilateral as the reference (rough bounding box x24%-42%, y21%-45%). It must be completely blank. Retain left elevator location x10%-18%, y49%-68%. Keep cutaway front walls low and the whole floor slab visible, with generous uninterrupted walking paths. No text, letters, logos, numbers, graphs with values, watermarks, or UI. Do not put tiny fake text on any paper or screen. Screens may show abstract luminous shapes only.
Completely redesign the interior furniture layout for this floor's function so it is visually unmistakable at thumbnail scale; it must not look like a recolor of the original three-desk office. Retain shared architectural identity. Render full room beautifully in soft daylight, not a flat diagram.
FLOOR 4 — FOUNDER'S OFFICE & GARDEN READING ROOM, for the owner. Entirely replace old shared office desks. This top floor should feel calm, private and spacious. One single generous sculptural light walnut executive desk near the rear windows, one forest-green leather executive chair, one slim monitor, one open blank notebook. A low curved glass partition separates the executive workspace from an elegant front-right waiting area: a linear upholstered sage bench with three separated seats and a tiny coffee side table, with a clear route from elevator to the waiting area for a queue. Replace the old right glazed boardroom with a lush indoor winter garden/reading conservatory: dense olives and leafy plants, cream chaise longue and a bookcase; no meeting table. At front left a personal reading nook with one comfortable sage armchair, ottoman and low round table, spacious cream woven rug. Back left original large empty whiteboard remains exactly fixed, surrounded by tasteful low library cabinetry. Soft limestone, light walnut, sage green, warm brass, rich greenery. Wide open central floor and quiet negative space communicate personal executive calm. No multiple computer stations, no boardroom, no orange research lounge. Keep all areas inside the original floor slab and camera framing.
```
