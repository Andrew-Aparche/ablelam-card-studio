# AI Provider 계약

UI와 렌더러는 AI 서비스에 의존하지 않습니다. `src/ai/index.js`에서 선택하는 provider는 아래 두 메서드를 구현합니다.

```js
generateBackground({ prompt, style, variant, width, height }): Promise<Background>
refineLayout({ document, preview, direction }): Promise<{ layers, explanation }>
```

기본은 `mockProvider`입니다. `remoteProvider`는 자체 서버의 HTTP 엔드포인트를 호출하는 어댑터입니다. 원격 서버 구현이 준비된 뒤 Vite 설정 `VITE_AI_PROVIDER=remote`, `VITE_AI_BASE_URL=/api`로 선택합니다. `VITE_*`는 브라우저에 공개되는 설정이므로 API 키는 서버에서 관리합니다. 이 MVP는 키를 읽거나 저장하지 않습니다.

## POST /api/background

요청:

```json
{ "prompt": "텍스트 없는 세이지 명함 배경", "style": "sage", "variant": 0, "width": 1080, "height": 600 }
```

응답:

```json
{
  "id": "generated-unique-id",
  "type": "image",
  "label": "생성한 배경",
  "src": "data:image/png;base64,...",
  "ink": "#183e32",
  "color": "#fcfbf7"
}
```

선택적인 원격 연결에서는 서버에서 OpenAI Images API를 호출하고 이미지를 data URL로 반환합니다. 배경 생성 프롬프트에는 **글자/숫자/로고 없음, 요청의 width:height 비율, 편집할 글자를 위한 충분한 여백**을 포함합니다. 1080×600은 기본 규격의 예시이며 규격을 바꾸면 요청 크기도 바뀝니다. `src`는 data URL을 권장하며, 원격 URL을 사용할 때는 Canvas 출력이 허용되도록 이미지 서버의 CORS를 설정합니다.

## POST /api/refine

요청은 전체 편집 상태와 현재 명함의 PNG data URL입니다. `direction`은 `tidy`, `center`, `editorial` 중 하나입니다.

```js
{
  document: { version: 1, title, width: 1080, height: 600, background, layers },
  preview: 'data:image/png;base64,...',
  direction: 'tidy'
}
```

레이어 속성:

```js
{
  id: 'name', field: 'name', label: '이름', text: '김지우',
  x: 80, y: 78, width: 630,
  fontSize: 32, fontFamily: 'sans', fontWeight: 700,
  color: '#183e32', align: 'left', tracking: 0
}
```

좌표와 텍스트 박스 너비는 **document.width×document.height 작업 좌표**입니다. mm 규격의 각 변을 12배 한 값이며 기본 90×50 mm일 때 1080×600입니다. 자유 규격을 처리할 때 기본 크기를 고정해서 사용하지 마세요. `fontSize`와 `tracking`은 에디터의 디자인 단위이며 렌더링 시 2.4배 합니다. 폰트는 `sans`(Noto Sans KR), `serif`(Noto Serif KR), `system` 중 하나, 굵기는 400/700, 정렬은 left/center/right입니다.

응답:

```json
{
  "layers": [
    { "id": "name", "x": 82, "y": 83, "width": 790, "fontSize": 30, "fontFamily": "sans", "fontWeight": 700, "color": "#183e32", "align": "left", "tracking": 0 }
  ],
  "explanation": "이름을 강조하고 정보의 시작점과 간격을 맞췄어요."
}
```

서버에서는 이미지 입력을 받는 Responses API와 JSON Schema를 사용해 **각 ID의 위치와 서식만** 반환하도록 구성합니다. 모든 기존 레이어의 ID를 포함하는 것을 권장합니다. UI는 누락된 레이어를 그대로 유지하고, 반환된 새 레이어 및 문구/배경 변경을 무시합니다. 값 범위도 다시 검증합니다. 응답으로 받은 레이어를 원본에 병합해 다시 그리므로 한글을 정확하게 보존하고 계속 편집할 수 있습니다.

배경을 바꾸는 이미지 생성과 텍스트 배치를 정리하는 작업은 서로 독립된 계약입니다. 타이포그래피를 PNG에 직접 구워 넣기보다 서식 데이터로 반환하는 구조를 사용합니다.

요청 타임아웃은 120초입니다. 2xx가 아닌 응답은 사용자에게 오류로 안내하고 현재 편집 상태를 유지합니다.


## 데스크탑 플러그인 0.3.0

일반 mock/선택적 원격 어댑터는 위 단면 document 구조를 유지합니다. 앞·뒷면 프로젝트에서 선택한 면을 어댑터에 전달합니다. 실제 플러그인 연결은 ../plugins/ablelam-card-studio/skills/card-studio/references/protocol.md를 따릅니다. 저장 프로젝트는 version 2, face는 front/back이며 시안 전달·상태 조회와 원본 파일 저장은 세션 로컬 서버를 사용합니다. 원격 이미지 API나 OAuth로 호스트 이미지 도구를 연결하지 않습니다.
