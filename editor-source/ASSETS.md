# 디자인 및 배경 에셋

기본 페이퍼 배경은 Codex의 built-in image_gen으로 생성했습니다. 앱 실행 시에는 포함된 이미지를 로컬에서 읽습니다. 데모에서 변형하는 선 패턴과 네이비·세이지 배경은 Canvas로 그리는 mock 템플릿입니다.

파일: `public/backgrounds/paper.png`

최종 생성 프롬프트:

> Create a production asset: a completely text-free business-card background only, flat front-facing rectangular canvas with exact 90:50 aspect ratio (landscape, 1.8:1). Minimal premium white warm paper with very subtle natural fine grain texture. Use a warm-white base #fcfbf7. On the far right only, a thin muted dark forest-green vertical line coming down from the top near 92% width ending at 35% height, and restrained fine abstract sweeping circular arcs at the bottom right. All line work stays in rightmost 25% of the canvas. Leftmost 75% is entirely clean blank paper for separately editable typography. No text, no letters, no numbers, no logos, no symbols, no watermark, no surrounding scene, no shadow, no perspective, no border. This is a background image that will be used inside a business card text editor, not a photograph of a physical card. Entire image fills the rectangular background.

화면 시안은 `docs/design-reference.png`입니다. 실제 편집 화면은 HTML 컨트롤과 Canvas 렌더링으로 구현했습니다. UI와 명함 위 글자는 시안 이미지에 포함된 픽셀을 사용하지 않습니다.
