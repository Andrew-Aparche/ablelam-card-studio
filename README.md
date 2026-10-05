# 에이블램 명함 스튜디오 — 로컬 플러그인

로그인된 데스크탑앱의 로컬 Work·Codex에서 여는 명함 편집기입니다. 웹 호스팅과 별도 이미지 API 키를 설정하지 않습니다. 이름·연락처·폰트·배치를 직접 수정하고, 가로·세로 규격을 입력해 PNG/JPEG로 저장합니다. 채팅에서 배경 또는 타이포그래피 시안을 요청하고 편집기에서 비교해 적용합니다.

## 설치

GitHub 저장소: [Andrew-Aparche/ablelam-card-studio](https://github.com/Andrew-Aparche/ablelam-card-studio). 현재 비공개이므로 저장소 접근 권한이 있는 계정으로 설치합니다.

GitHub에서 바로 설치하려면 다음을 실행합니다. 등록 후 데스크탑앱의 플러그인 목록에서 설치하거나 아래 두 번째 명령을 사용합니다.

```sh
codex plugin marketplace add Andrew-Aparche/ablelam-card-studio
codex plugin add ablelam-card-studio@ablelam-studio
```

### 다운로드한 폴더로 설치

압축을 풀면 이 폴더 자체가 로컬 마켓플레이스 소스입니다. **플러그인 ZIP 하나와 마켓플레이스 묶음 ZIP은 서로 다릅니다.** 수강생에게 로컬 설치용으로 전달할 때는 `ablelam-card-studio-distribution.zip`을 사용합니다.

macOS에서 Codex CLI가 설치되어 있다면 `install.command`를 실행합니다. 이 스크립트는 이 폴더를 마켓플레이스로 등록하고 플러그인을 설치합니다. 공개 업로드를 하지 않습니다.

CLI로 직접 설치할 때는 이 폴더 안에서 실행합니다.

```sh
codex plugin marketplace add .
codex plugin add ablelam-card-studio@ablelam-studio
```

CLI가 없는 경우 데스크탑의 로컬 Work·Codex 채팅에 이 폴더를 제공하고 “이 로컬 마켓플레이스의 에이블램 명함 스튜디오를 설치해줘”라고 요청합니다. 설치 기능과 마켓플레이스 표시 여부는 앱 버전·워크스페이스 설정에 따라 달라질 수 있습니다.

설치 후 새 채팅을 열어 `@`에서 **에이블램 명함 스튜디오**를 선택하고 “스튜디오를 열어줘”라고 보냅니다. 활성화된 스킬이 `/` 목록에 나타나는 호스트에서는 해당 목록에서도 선택할 수 있습니다. 정확한 목록 표시는 대상 호스트에서 확인해야 합니다.

## 사용

1. 편집기 위 가로·세로 값을 mm로 입력하고 적용합니다.
2. 이름·직함·회사·전화·이메일·주소를 입력합니다.
3. 글자를 드래그하고 폰트·크기·정렬·색상을 바꿉니다.
4. 디자인을 바꾸려면 채팅에 “현재 글자 배치를 정리해줘” 또는 “텍스트 없는 세이지 배경을 만들어줘”라고 보냅니다. 화면 버튼은 같은 요청 문장을 복사하기 위한 도구입니다.
5. 비교창의 시안을 선택한 뒤 PNG/JPEG로 저장합니다.

첫 실행 자동 시안 생성 및 시안 3개 동시 비교는 포함하지 않았습니다. 고객별 작업 목록·복제, 정렬 가이드, 수정 범위 선택, 추가 납품 기능은 후속 범위입니다.

## 실행 환경

- Node.js 20 이상과 로컬 파일·프로세스 접근이 가능한 데스크탑 Work·Codex
- 내장 브라우저. WebMCP 사이트 도구가 지원되지 않으면 실행 스킬의 로컬 파일 전달 기능을 사용
- 배경 제작에는 호스트의 내장 이미지 생성 도구가 필요함. 로그인 상태만으로 모든 환경에 같은 도구가 제공된다고 보장하지 않음
- 편집기는 localhost에서 실행됨. AI 제작에는 인터넷 연결 및 호스트의 이용 한도가 적용됨

설치에 필요한 프런트엔드 빌드와 폰트를 포함해 사용 시 `npm install`이나 Vite 실행이 필요하지 않습니다. 사용자 작업은 채팅 작업 폴더 아래 `work/ablelam-card-studio/ablelam-session/`에 저장합니다. 플러그인 설치 폴더에는 작업을 저장하지 않습니다.

## GitHub로 수강생에게 배포

이 저장소의 루트에는 `.agents/plugins/marketplace.json`과 플러그인 폴더가 포함되어 있습니다. 수강생에게 저장소 접근 권한을 주거나 저장소를 공개한 후 위 GitHub 설치 명령으로 추가할 수 있습니다. 비공개 저장소에 접근하려면 해당 수강생의 GitHub 인증도 필요합니다.

GitHub 마켓플레이스 배포는 OpenAI 공개 디렉터리 등록과 별도입니다. 계정·워크스페이스·로컬 호스트의 지원 범위에 따라 설치 경로가 달라질 수 있습니다.

## 저장소 구성과 개발

- `.agents/plugins/marketplace.json`: 마켓플레이스 등록 정보
- `plugins/ablelam-card-studio/`: 설치에 사용하는 플러그인, 실행 스킬, 로컬 서버, 빌드된 편집기와 폰트
- `editor-source/`: React 편집기의 원본 코드와 개발 문서
- `install.command`: 다운로드한 폴더를 등록하는 macOS 설치 스크립트

편집기 원본을 수정할 때는 `editor-source/`에서 `npm ci`와 `npm run dev`를 실행합니다. 플러그인에 반영하려면 `npm run build` 후 `dist/` 내용을 `plugins/ablelam-card-studio/assets/editor/`로 복사합니다. 문서 모델을 변경했다면 `src/editor/model.js`도 `plugins/ablelam-card-studio/scripts/document-model.mjs`에 반영합니다. 원본의 일반 개발 모드는 mock이며 플러그인 서버로 열 때 데스크탑 연결 모드가 적용됩니다.

## 내 앱 설치와 공개 등록

| 경로 | 범위 |
| --- | --- |
| 로컬 마켓플레이스 설치 | 설치한 컴퓨터의 로컬 환경 |
| 개인 계정의 비공개 플러그인 저장 | 계정에 패키지를 보관. 로컬 프로세스를 웹·모바일에 배포하는 것은 아님 |
| GitHub 마켓플레이스 배포 | 저장소 접근 권한이 있는 사용자가 지원되는 로컬 환경에 설치 |
| 공개 플러그인 디렉터리 등록 | 제출·심사·승인 후 공개 게시 |

공개 등록 경로 자체는 있습니다. 다만 현재 패키지는 localhost 프로세스와 로컬 실행에 의존하므로 그대로 공개 심사를 통과한다고 보장할 수 없습니다. 공개 제출 단계에서 로컬 실행 지원 범위를 확인하고, 게시자 인증·실제 개인정보처리방침·지원 URL·설명·심사 자료를 준비해야 합니다. 이번 묶음은 **로컬 개발·배포용**이며 공개 제출용 최종본이 아닙니다.

공식 안내: [패키지와 로컬 배포](https://developers.openai.com/plugins/build/plugins), [공개 제출](https://developers.openai.com/plugins/deploy/submission), [로컬 실행을 핵심으로 하는 제출의 추가 확인](https://developers.openai.com/plugins/guides/submit-claude-plugin), [사이트 도구](https://learn.chatgpt.com/docs/webmcp).

## 현재 제작 상태

플러그인 메타데이터, 실행 스킬, 로컬 서버, 사이트 도구 등록, 로컬 상태·미리보기 전달, 배경·배치 비교 시안 수신을 포함했습니다. 사용자 데이터와 세션은 배포물에서 제외했습니다. 프런트엔드 빌드와 패키지 생성은 수행했으며, 데스크탑 플러그인 설치·호스트의 WebMCP 발견·실제 이미지 생성으로 이어지는 전체 흐름은 아직 검증하지 않았습니다. 이 저장소는 GitHub 배포용이며, 앱 설치·개인 계정 업로드·공개 디렉터리 제출은 수행하지 않았습니다.
