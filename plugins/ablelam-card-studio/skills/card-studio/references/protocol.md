# 편집기 연결 프로토콜 — 0.3.0

## 문서와 양면

저장 프로젝트는 `{version: 2, title, width, height, sides: {front: {background, layers}, back: {background, layers}}}`이다.
기존 version-1 문서는 앞면으로 옮기고 빈 뒷면을 만든다. 원본 state.json은 최초 변환 시 state-v1.backup.json에 보존한다.
기존 렌더러와 시안의 `document`는 선택한 면을 담은 `{version: 1, title, width, height, background, layers}`를 그대로 사용한다.
규격은 양면 공통이며 10–300 mm, 0.1 mm 단위다. 작업 좌표는 mm × 12이다.

문서 수정마다 stateRevision이 올라가고, 대상 면의 내용 또는 공통 규격이 바뀌면 해당 faceRevision이 올라간다. 읽기 결과의 revision은 대상 면의 값이다. 화면 전환이나 다른 면 편집으로 해당 면의 시안을 무효화하지 않는다. 새 브라우저 클라이언트는 clientId가 달라져 과거 시안은 무효화된다.

레이어에는 id, field, label, text, x, y, width, fontSize, fontFamily, fontWeight, align, tracking, color가 있다.
배치 시안은 기존 id와 서식만 반환한다. 문구·ID·배경·규격은 유지한다.

- fontFamily: sans(Noto Sans KR), serif(Noto Serif KR), system(시스템 고딕)
- fontSize: 6–72, fontWeight: 400 또는 700
- align: left, center, right
- tracking: -1–5, color: #RRGGBB
- x/y/width: 현재 문서 작업 좌표. 클라이언트가 범위를 제한한다.
- fontSize와 tracking은 렌더링 시 2.4배로 그린다.

## 사이트 도구

| 이름 | 동작 |
| --- | --- |
| ablelam_read_design | face가 없으면 화면의 면, 있으면 지정한 면의 현재 문서·revision 읽기 |
| ablelam_read_preview | 지정한 면의 최신 PNG 경로 반환 |
| ablelam_propose_layout | face·expectedRevision·layers로 비교창 전달 |
| ablelam_propose_background | face·expectedRevision·src로 배경 비교창 전달 |
| ablelam_proposal_status | id로 전달 및 적용 상태 조회 |
| ablelam_list_exports | 원본 파일의 저장 결과·절대 경로 조회 |

사이트 도구와 로컬 전달은 같은 서버의 시안 ID와 기록을 사용한다. 제안은 자동 적용되지 않는다.

## 로컬 배치 JSON

```json
{
  "face": "back",
  "clientId": "읽기에서 받은 값",
  "expectedRevision": 4,
  "layers": [{"id": "현재 레이어 ID", "x": 80, "y": 80, "width": 630, "fontSize": 30, "fontWeight": 700, "align": "left"}],
  "explanation": "문구의 시작점과 간격을 정리했어요."
}
```

ID와 숫자는 예시다. 실제 대상 면을 읽어 작성한다. 규격·문구·배경이 달라졌으면 변경 내용을 판단한 뒤 최신 요청을 만든다.

## 시안 상태

- queued: 서버 저장 완료, 브라우저 수신 대기
- proposed: 비교창으로 전달됨. 사용자의 적용 여부는 아직 결정되지 않음
- applied: 사용자가 적용하고 해당 문서가 서버에 저장됨
- declined: 사용자가 현재 명함 유지 또는 비교창 닫기 선택
- invalidated: 대상 면 변경, 페이지 재접속 또는 새 시안으로 대체
- rejected: 잘못된 결과, 이미지 읽기 실패 등 브라우저 처리 실패

전달 명령은 최대 4초 기다린다. 기다림이 만료되면 queued와 deliveryTimedOut을 반환한다. 별도 조회는 정확한 ID를 사용한다. applied는 과거 적용 사건이며, 이후 실행 취소나 편집 여부는 현재 문서로 확인한다.

## 데이터 위치와 저장

`ablelam-session/`에 session.json, workspace-id, state.json, preview-front.png, preview-back.png, proposals.json, exports.json, generated/, exports/, server.log를 보관한다.
workspace-id는 작업 폴더에 영구 보관하며 임시 서버 포트와 독립적이다. 서버 모드는 다른 브라우저 저장값을 복원하지 않는다.
read/status/exports 명령은 로컬 파일을 읽어 반복 네트워크 권한 요청을 줄인다. read의 source는 last_saved_local_file이며 자동 저장 완료를 확인해야 한다. previewPath가 null이면 최신 미리보기가 없다.

이미지 저장은 브라우저에서 PNG/JPEG를 렌더링하고 서버가 exports/에 임시 파일을 쓴 뒤 파일명을 확정한다. 응답에는 status=saved, filename, path, bytes, savedAt, face, revision이 있다. 파일명에 면·시간·고유값을 붙여 이전 파일을 덮어쓰지 않는다. 양면은 순차 저장하고 실패한 면을 구분한다.
복사본 다운로드는 선택 기능이며 브라우저의 완료 여부·최종 경로를 보장하지 않는다. UI에 표시한 path는 원본의 경로다.

session.json은 세션 접근 값을 포함한다. 내용 전체를 채팅에 출력하지 않는다. 고객 데이터·세션 파일은 플러그인 설치 폴더나 배포물에 넣지 않는다.
