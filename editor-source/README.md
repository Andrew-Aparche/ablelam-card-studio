# 에이블램 명함 스튜디오 — 편집기 원본 0.3.0

React + Canvas로 구현한 앞·뒷면 명함 편집기입니다. 설치용 플러그인에는 빌드 파일이 포함되어 있습니다. 설치·배포·복원 안내는 [저장소 설치 안내](https://github.com/Andrew-Aparche/ablelam-card-studio#설치)를 참고하세요.

## 개발

```sh
npm ci
npm run dev
```

일반 개발 서버는 mock 모드입니다. 사용자가 입력한 글자를 편집하고 앞·뒷면을 개별 다운로드합니다. 브라우저 다운로드는 완료 여부와 실제 경로를 확인할 수 없습니다.

플러그인 로컬 서버로 열면 세션 설정이 주입되어 데스크탑 연결 모드가 적용됩니다. 문서는 작업 폴더에 자동 저장되고 PNG/JPEG 원본은 exports/에 저장됩니다. 사이트 도구와 로컬 CLI는 같은 시안 기록을 사용합니다.

## 구성

- `src/editor/model.js`: 양면 프로젝트, 기존 단면 데이터 변환, 공통 규격과 면별 문서
- `src/editor/useDocument.js`: 양면 편집 이력, 작업 상태, 브라우저 모드 저장
- `src/editor/render.js`: 기존 단면 렌더러를 재사용하는 PNG/JPEG 생성
- `src/desktop/useDesktopBridge.js`: 작업 폴더 저장, 면별 revision, 시안 상태 및 사이트 도구
- `src/components/ExportDialog.jsx`: 현재 면·양면 저장과 실패 재시도, 원본 경로 표시
- `src/ai/`: mock와 선택적인 원격 어댑터. 플러그인의 실제 이미지 생성은 호스트 에이전트가 담당

## 플러그인 반영

`npm run build` 후 dist/ 내용을 `../plugins/ablelam-card-studio/assets/editor/`에 복사합니다. 모델을 변경했다면 model.js를 `../plugins/ablelam-card-studio/scripts/document-model.mjs`에도 반영합니다.

고객 문서·세션·생성 이미지·내보낸 파일은 이 원본 저장소에 포함하지 않습니다. 과거 QA.md와 preview.png는 초기 단면 MVP의 기록이며 0.3.0의 동작 검증 결과가 아닙니다.
