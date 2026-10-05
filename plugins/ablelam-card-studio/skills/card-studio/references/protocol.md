# 편집기 연결 프로토콜

## 문서

`document`는 `{version: 1, title, width, height, background, layers}`이다.
가로·세로는 mm × 12 작업 좌표이며 기본값은 1080×600이다. 규격은 10–300 mm, 0.1 mm 단위로 사용자가 편집한다. 그림 안의 픽셀 좌표를 추측하지 말고 실제 문서 크기를 읽는다.

레이어에는 id, field, label, text, x, y, width, fontSize, fontFamily, fontWeight, align, tracking, color가 있다.
시안에서는 id와 서식 속성만 반환한다. 문구·ID·배경·규격 변경을 레이아웃 시안에 넣지 않는다.

- fontFamily: sans(Noto Sans KR), serif(Noto Serif KR), system(시스템 고딕)
- fontSize: 6–72; 렌더링 시 2.4배로 그린다.
- fontWeight: 400 또는 700
- align: left, center, right
- tracking: -1–5; 렌더링 시 2.4배로 그린다.
- color: #RRGGBB
- x/y/width: 현재 작업 좌표 기준. 클라이언트가 범위를 다시 제한한다.

## 사이트 도구

| 이름 | 동작 |
| --- | --- |
| ablelam_read_design | 현재 규격·레이어·revision·세션 파일 경로를 읽음 |
| ablelam_read_preview | 현재 PNG 미리보기를 세션 폴더에 저장하고 경로를 반환 |
| ablelam_propose_layout | expectedRevision과 기존 ID의 layers를 받아 비교창을 열음 |
| ablelam_propose_background | expectedRevision과 /generated/ 내부 이미지 src를 받아 비교창을 열음 |

## 로컬 전달용 배치 JSON

```json
{
  "clientId": "read 명령에서 받은 현재 값",
  "expectedRevision": 4,
  "layers": [
    {"id": "name", "x": 80, "y": 80, "width": 630, "fontSize": 30, "fontWeight": 700, "align": "left"}
  ],
  "explanation": "이름을 강조하고 정보의 시작점을 맞췄어요."
}
```

숫자와 ID는 예시이다. 현재 문서를 읽어 실제 값으로 작성한다.
clientId와 revision은 페이지를 다시 열거나 사용자가 작업을 바꿨을 때 달라질 수 있다.
원본과 다른 상태의 시안을 강제로 적용하지 않는다.

## 전달 상태

- queued: 로컬 서버에 전달되어 브라우저 수신을 기다림
- proposed: 브라우저 비교창에 전달됨. 아직 적용되지 않음
- rejected: 편집 상태가 바뀌었거나 결과가 유효하지 않아 제안이 거절됨

시안 적용은 사용자가 비교창에서 선택한다. 실제 적용 여부를 위 상태만으로 추측하지 않는다.
새로고침 전부터 대기 중인 제안은 페이지의 clientId가 달라지면 거절한다.

## 데이터 위치

세션 작업 폴더의 `ablelam-session/`에는 session.json, state.json, preview.png, generated/, server.log가 있다.
session.json에는 이번 로컬 서버의 접근 값이 있으므로 내용 전체를 채팅에 출력하지 않는다.
state.json과 preview.png는 고객 정보를 포함할 수 있으며 배포 ZIP에 넣지 않는다.
플러그인 폴더 및 런타임의 전역 인증 파일을 수정하거나 읽을 필요가 없다.
