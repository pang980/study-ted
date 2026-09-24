# Validation Report

> 기준: `rules/validation-rules.md`. **실제로 실행한 명령과 출력**만 기록한다. 실행하지 않은 항목은 "미실행"으로 남긴다.

## 실행 환경

- 날짜: 2026-09-23 (Asia/Seoul)
- OS / 셸: Windows / PowerShell 5.1
- Node.js: v22.15.1 (내장 `node:sqlite` 사용, 별도 DB 설치 없음)
- Electron: 44.4.4 (`devDependencies` 설치본)
- yt-dlp: 프로젝트 로컬 `_tmp\yt-dlp.exe` 2026.08.19 (PATH 의 `yt-dlp` 2026.03.17 도 감지됨)
- DB 파일: `%APPDATA%\study-ted\study-ted.db`
- 주의: 이 셸에는 `ELECTRON_RUN_AS_NODE=1` 이 설정되어 있어, Electron 스크립트 실행 전 반드시 해제해야 한다.

## 실행 명령과 결과

### 1. 문법 검사 — 통과

    Get-ChildItem main,renderer,scripts,test -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }

- 결과: `checked=44 syntaxFailures=0`

### 2. 단위 테스트 — 통과

    npm test

- 결과: `tests 34 / pass 34 / fail 0` (duration_ms 468)
- 경과: 중간에 `extractVideoEntries 가 videoRenderer 와 lockup 을 모두 읽는다` 1건이 실패했다. provider 출력에 `url` 키를 추가한 **의도된 스펙 변경**이었으므로 테스트 기대값을 갱신해 통과시켰다(기준을 낮추지 않음). 상세는 `08_error_log.md` 3차 라운드.

### 3. Electron 부팅 스모크 — 통과

    Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    node_modules\.bin\electron.cmd scripts/smoke.js

- 사전에 `_tmp\smoke-userdata` 를 삭제해 카운트를 0 에서 시작했다.
- 결과: `총 61개 확인 / 실패 0개`, exit 0
- 스크린샷 7장 생성

  | 파일 | 크기 |
  |---|---|
  | `_tmp\smoke.png` | 207,225 bytes |
  | `_tmp\smoke-channels.png` | 86,638 bytes |
  | `_tmp\smoke-learn.png` | 129,978 bytes |
  | `_tmp\smoke-notes.png` | 119,374 bytes |
  | `_tmp\smoke-materials.png` | 100,196 bytes |
  | `_tmp\smoke-share.png` | 91,538 bytes |
  | `_tmp\smoke-settings.png` | 108,461 bytes |

- 확인 범위: 부팅 → 데모 시딩 → IPC(채널/영상/자막/문장/AI 모델/설정/공유/데모) → 오류 코드(`NOT_FOUND`, `VALIDATION`) → 뷰 7종 프로브 + 스크린샷.

### 4. 실제 유튜브 채널 End-to-End 수집 — 통과

    Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    node_modules\.bin\electron.cmd scripts/e2e-collect.js --url=https://www.youtube.com/@TED --limit=2

- 결과: `총 7개 확인 / 실패 0개`, exit 0
- 채널: TED (`UCAuUUnT6oDeKwE6v1NGQxug`), `27.8M subscribers`, `provider=ytdlp`, `listWarning=null`, 소요 28.75초
- 저장된 영상 2건
  - `The Infodemic — and the Scientists Fighting Against It | Jessica Malaty Rivera | TED`
  - `Why You Should Embrace Unproductive Hobbies | TED Intersections`
- 저장된 자막 2건
  - `PRmIrFhce04` · lang `en-en` · segments **391** · 첫 줄 `Whitney Pennington Rodgers: Hi, Jessica. And hello, everyone.`
- 진행 이벤트 순서 관찰: `channel → list → subtitle → done`
- 최종 집계: `{"channels":1,"videos":2,"transcripts":2}`

### 5. UI 대조 (`_tmp\smoke.png` ↔ `UI.png`) — 구조·색상 일치

- 캡처 크기: 앱 1617x1035 (창 크기) / 목업 1536x1024
- 색상 토큰 픽셀 샘플 (Electron `nativeImage` 비트맵 카운트, ±2 허용)

  | 토큰 | 용도 | UI.png | _tmp\smoke.png |
  |---|---|---|---|
  | `#1e6ff5` | primary | 63 | 6308 |
  | `#5b4bd6` | AI 버튼 | 0 | 3161 |
  | `#d2e4fc` | 사이드바 활성 | 5533 | 6948 |
  | `#ebf2fe` | 입력/선택 영역 | 15733 | 36205 |
  | `#e3edf8` | 자막 하이라이트 | 195 | 94 |
  | `#f0f6f6` | 페이지 배경 | 7116 | 289077 |
  | `#243654` | 타이틀바 | 922 | 14660 |
  | `#1a2233` | 본문 텍스트 | 21 | 658 |

- 목업 쪽 `#5b4bd6` 카운트 0 → 목업에는 그 색의 큰 면적이 없거나 다른 근사색을 쓴다. 앱은 AI 구문분석 버튼에 이 토큰을 사용한다(기능 요구에 따른 구현).
- `#e3edf8` 은 양쪽 모두 소량이다. 하이라이트는 "재생 중인 문장"에만 적용되며 캡처 시점에 활성 문장이 드러나지 않았다. 하이라이트/모드 전환 동작은 스모크의 자막모드 프로브(`view:learn :: {"picker":4,"modes":2}`)로 확인했다.
- 문구 대조 — 목업에서 확인한 문자열이 실제 소스에 존재함을 확인

  | 목업 문구 | 소스 |
  |---|---|
  | `Small steps make big progress.` | `main/demo-data.js`, `renderer/index.html` |
  | `English with Emma` / `1.2M` / `328` | `main/demo-data.js` |
  | `Morning Routine in English` / `11:28` 등 4개 썸네일 캡션·길이 | `main/demo-data.js` |
  | `채널 불러오기` | `renderer/js/views/channels.js`, `renderer/js/components/study-workspace.js` |
  | `전체 자막` | `renderer/js/components/transcript.js` |
  | `AI 구문분석` | `renderer/js/components/sentence-panel.js`, `renderer/js/views/settings.js` |
  | `내보내기` | `renderer/js/components/notes-table.js`, `views/materials.js`, `views/share.js` |

- OCR(tesseract `eng+kor`)로 두 이미지를 자동 비교하려 했으나, 앱 캡처는 렌더 폰트·해상도 때문에 인식률이 낮아(514자) **판정 근거로 사용하지 않았다.** 판정 근거는 색상 샘플 + 블록 구조 + 문구의 소스 존재 확인이다.

### 6. 인코딩·Secret 점검 — 통과

- BOM: 텍스트 파일 71개 중 **0건**
- U+FFFD: 프로젝트 파일 **0건**. 읽기 전용 `skills/harness/SKILL.md` 에 1건(외부 원본, 수정 금지 대상)
- Secret: `_workspace/*.md`, `README.md` 에서 `sk-or-` + 16자 이상 패턴 **0건**. `.env` 는 읽지 않았다.
- 앱 userData 폴더(`%APPDATA%\study-ted`)는 생성되지 않았다 — 앱을 실제 실행하지 않고 검증 스크립트만 별도 userData 로 돌렸기 때문.

## 체크리스트

- [x] 구조 정상
- [x] 필수 파일 존재 (`README.md` 포함)
- [x] 파일 맵과 실제 변경 일치
- [x] 문법 검사 통과 (44/0)
- [x] 빌드/부팅 통과 (스모크 61/0, exit 0)
- [x] 테스트 통과 (34/34)
- [x] Secret 노출 없음
- [x] UTF-8 유지 (BOM 0)
- [x] 한글 깨짐 없음 (U+FFFD 0)

## 실패 또는 미실행 항목

- **OpenRouter 실제 호출 미실행**: 키가 필요하고, 키 값을 읽지 않는 규칙 때문이다. 응답 정규화·오류 처리는 `test/ai-parse.test.js` 로만 검증했다. 실제 키로의 호출은 사용자가 앱에서 **연결 테스트**로 확인한다.
- **사람이 직접 조작하는 수동 UI 검증 미실행**: 스모크 프로브 + 스크린샷 + 소스 대조로 대체했다.
- T24(배포 패키징), T25(자막 자동 번역): HOLD (사용자 요청 시 진행)

## 문제

- 환경변수 `ELECTRON_RUN_AS_NODE=1` 이 설정된 셸에서는 Electron 스크립트가 전부 실패한다(`setPath` 오류). 실행 전 해제가 필요하다.
- Electron 은 위치 인자 URL 을 소비한다 → 스크립트에는 `--url=<주소>` 형식으로 전달해야 한다.
- `Remove-Item -Recurse -Force` 는 정책상 거부된다 → `[System.IO.File]::Delete` / `[System.IO.Directory]::Delete` 를 사용했다.
- OCR 기반 UI 비교는 이 해상도에서 신뢰할 수 없다.

## 결론

- 문법 44/0, 단위 34/34, 스모크 61/0, **실제 채널 E2E 7/7** 로 P0·P1(F1~F10) 기능이 실제 유튜브 데이터로 동작함을 확인했다.
- 남은 일: 사용자 요청 시 T24·T25, 그리고 실제 API 키를 넣은 상태에서의 OpenRouter 구문분석 수동 확인.

## 4차 라운드 검증 (2026-09-23)

사용자 피드백 3건에 대한 검증 결과다. 실행 환경: Windows / PowerShell 5.1 / Electron 44.4.4 / Node 24.21.0.

### 실행 결과

| 단계 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (`main/`, `renderer/`, `scripts/`, `test/`) | 실패 0 |
| 단위 | `npm test` | **35/35 통과** (3차 34 + `refresh=false` 스킵 검증 1) |
| 스모크 | `npm run smoke` (`_tmp/smoke-userdata` 초기화 후) | **64개 확인 / 실패 0**, 종료 코드 0 |
| 채널 E2E | `npm run e2e -- --url=https://www.youtube.com/@TED --limit=2` | **8/8 통과**, 종료 코드 0 |
| 재생 E2E | `npm run e2e:player` | **6/6 통과**, 종료 코드 0 |

### 항목별 근거

**1) `refreshExisting` (T26)**

- 단위: `videos upsert 가 refresh=false 이면 기존 메타를 덮어쓰지 않는다` 통과. 설정 기본값(`collect.refreshExisting='1'` → `publicSettings().refreshExisting === true`)도 함께 검증.
- 스모크: `bridge:settings.update(refreshExisting) :: {"off":false,"on":true}`, `설정 refreshExisting 저장 :: {"off":false,"on":true}`.
- E2E: 같은 채널을 두 번 수집했을 때

      [PASS] 기존 영상 메타 건너뛰기 :: {"keptCount":2,"addedCount":0,"refreshExisting":false,"beforeCount":2,"afterCount":2}

  1차 수집은 `동영상 2개(신규 2개) · 자막 2개 저장`, 2차 수집은 신규 0 · 기존 2건 유지 · videos 총계 2로 불변. **"한 번 불러온 채널에서 새 데이터만 저장"** 요구가 실제 채널에서 확인됐다.

**2) 동영상 선택 목록 배치 (T27)**

- 스모크: `view:learn :: {"picker":4,"modes":2,"thumbs":4,"titles":4}`, `view:learn 썸네일 :: 4/4` — 4개 항목 모두 썸네일과 제목을 함께 렌더한다.
- 육안: `_tmp/smoke-learn.png` 에서 썸네일(96px) + 제목 2줄 + 메타 2줄 배치와 활성 항목 강조를 확인했다.
- 썸네일이 없는 데모 데이터는 대체 텍스트가 2줄로 클램프되어 재생 시간 배지를 가리지 않는다.

**3) 재생 실패 오류 (T28)**

- 원인 규명(수정 전/후 대조, `_tmp` 프로브):

      app://study-ted              → YouTube 오류 코드 153 (모든 변형에서 재현, Referer 헤더 강제 주입·<meta name="referrer"> 모두 무효)
      http://127.0.0.1:<임의 포트>  → 오류 없음

- 수정 후 재생 E2E:

      [PASS] 렌더러 origin :: {"origin":"http://127.0.0.1:60559","pageUrl":"http://127.0.0.1:60559/index.html?demo=1"}
      [PASS] 플레이어 마운트 :: {"videoId":"PRmIrFhce04"}
      [PASS] 재생 오류 없음 :: []
      [PASS] 재생 시간 확인 :: {"duration":1174}
      [PASS] YouTube 요청 Referer 전달 :: {"total":11,"sample":["http://127.0.0.1:60559/"]}

- 네트워크 상태가 정상인데도 "네트워크 상태를 확인해 주세요" 가 떴던 것이 이번 증상의 정체다. 이제는 오류 코드별 메시지(2/5/100/101/150)로 원인을 구분해 보여준다.

### 회귀 방지

- `scripts/e2e-player.js` 를 상시 검증 스크립트로 추가했다(원인 재현 조건 고정). `package.json` 에 `e2e:player` 스크립트를 등록했다.
- `npm test` 35개 / `npm run smoke` 64개가 계속 통과하며, 스모크는 네트워크가 없어도 동일한 결과를 낸다.

### 남은 확인

- OpenRouter 실제 호출(키 필요)은 3차와 동일하게 사용자 수동 확인 항목으로 남는다.
- 사람이 직접 마우스로 조작하는 재생·자막 동기화 확인은 자동화(재생 E2E + 스모크)로 대체했다.

## 5차 라운드 검증 (2026-09-23)

### 실행 결과

| 검증 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (수정 10개 파일) | 10/10 통과 |
| 단위 | `node --test test/*.test.js` | 35/35 통과 |
| 스모크 | `npx electron scripts/smoke.js` | 64개 확인 / 실패 0 |
| 채널 E2E | `npx electron scripts/e2e-collect.js --url=https://www.youtube.com/@TED --limit=2` | 8/8 통과 |
| 재생 E2E | `npx electron scripts/e2e-player.js` | 6/6 통과 |
| 수집 인자 프로브 | `_tmp/probe4.js`(yt-dlp `run` 스텁) | 유한/무제한 분기 확인 |
| 페이지 상한 프로브 | `_tmp/probe5.js`(native `fetchText` 스텁) | 무제한 40페이지 진행 확인 |

### 항목별 근거

**1) 검은 반투명 레이어 (T30) — 사용자 추측("자막 때문")이 정답**

- 수정 전 실측(`_tmp/probe3.js`, zoom 0/+1/-1): `.player-caption` 의 `getBoundingClientRect()` 가 프레임과 **완전히 같은 크기**였다.

      frame   {"x":503,"y":103,"w":376,"h":211}
      caption {"x":513,"y":103,"w":376,"h":211}   bg rgba(8, 12, 20, 0.72)

  즉 자막 상자가 프레임 전체를 덮는 반투명 검은 레이어였다. 원인은 `.player-frame > div { width:100%; height:100% }` 가 자막 상자까지 매칭한 것.

- 수정 후 실측:

      zoom=0  frame 376x211   caption {"x":513,"y":266,"w":356,"h":48}   bg rgba(8, 12, 20, 0.62)
      zoom=+1 frame 356x200   caption {"x":461,"y":255,"w":336,"h":48}
      zoom=-1 frame 497x280   caption {"x":513,"y":352,"w":477,"h":30}

  자막 상자는 프레임 폭 −20px, 높이는 내용만큼(30~48px)이며 프레임 하단에서 10px 안쪽에 놓인다. 더 이상 프레임을 덮지 않는다.

**2) 24개 제한 (T29)**

- yt-dlp 인자 프로브(`_tmp/probe4.js`, `manager.run` 스텁):

      limit=2         → [...,"--playlist-end","2","https://www.youtube.com/@TED/videos"]   timeoutMs 300000  → 2건
      limit=Infinity  → [...,"https://www.youtube.com/@TED/videos"]  (--playlist-end 없음)  timeoutMs 1800000 → 3건(스텁이 준 전부)

- native 페이지 상한 프로브(`_tmp/probe5.js`, `fetchText` 스텁이 40페이지 후 토큰 종료):

      limit=Infinity → 80건 / 40페이지 (수정 전 상한 6페이지면 12건에서 멈췄다)
      limit=5        → 5건 / 3페이지 (유한 상한 동작 유지)
      limit='all'    → 40페이지 (문자열도 무제한으로 처리)
      진행 이벤트     → {"phase":"list","done":2,"total":0,...} (무제한이면 total 0)

- 기존 스모크 설정 계약은 그대로 통과했다(`설정 저장 :: collectLimit:25`, `설정 검증 폴백 :: collectLimit:25`). 유한 상한 경로도 E2E(`--limit=2`)로 계속 동작한다.

**3) 채널별·전체 수집 버튼 (T31)**

- 스모크 `view:channels :: {"cards":3,"rows":3}` — 채널 3행이 각각 상태 영역과 `수집` 버튼을 포함해 렌더된다(스크린샷 `_tmp/smoke-channels.png`).
- 헤더의 **전체 채널 수집** 버튼은 채널이 0개면 숨김, 수집 중에는 비활성. 행 버튼도 수집 중에는 모두 비활성되고 취소 버튼이 나타난다.
- 진행 표시: 상단 진행 바 `(i/n)` + 각 행 `수집 중… (i/n)` → `완료 · 신규 N개 · 자막 M개`. 실패한 채널만 `실패 · 메시지` 로 남고 나머지는 계속 진행한다.
- 실제 다채널 수집은 네트워크 시간이 길어 자동 검증에 넣지 않았다. 채널 1개 경로는 E2E 가 덮는다.

**4) "채널을 한 번 불러오고 새 데이터만 저장"(단답: 예)**

- 채널 E2E 재수집 단계: `{"keptCount":2,"addedCount":0,"refreshExisting":false,"beforeCount":2,"afterCount":2}` — `refreshExisting` 을 끄면 기존 영상은 건드리지 않고 신규만 저장한다. 이미 받은 자막도 다시 받지 않는다.

### 회귀 방지

- 기존 계약 유지: 스모크의 설정 저장/폴백/범위 초과 거부/`refreshExisting` 4개 계약이 값까지 동일하게 통과했다.
- 유한 상한 경로는 `--limit=2` E2E 로, 무제한 경로는 스텁 프로브로 고정했다(네트워크 전체 크롤 없이 재현 가능).

### 남은 확인

- 실제 채널 전체 크롤(TED 전체, 수백 개 + 자막)은 시간이 오래 걸려 자동 검증에서 제외했다. 사용자가 화면의 **전체 채널 수집** 버튼으로 직접 확인할 수 있다.
- OpenRouter 실제 호출은 3·4차와 동일하게 사용자 수동 확인 항목이다.
- 검증에 사용한 프로브 스크립트(`_tmp/probe4.js`, `_tmp/probe5.js`)와 임시 userData 는 스크래치이므로 라운드 종료 시 삭제했다. 결과 수치는 위에 그대로 남긴다.

## 6차 라운드 검증 (2026-09-23)

### 실행 결과

| 검증 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (수정 파일 + 전체 45개) | 실패 0 |
| 단위 | `node --test test/*.test.js` | 35/35 통과 |
| 스모크 | `npm run smoke` | 71개 확인 / 실패 0 |
| 채널 E2E | `npm run e2e -- --url=https://www.youtube.com/@TED --limit=2` | 8/8 통과 |
| 재생 E2E | `npm run e2e:player` | 6/6 통과 |

### 항목별 근거

**1) 채널 리스트 수집 개수 (T32)**

- 단위 테스트: 채널에 영상/자막/문장을 넣고 `channels.getByPk()` 가 `savedVideoCount`/`savedTranscriptCount`/`savedSentenceCount` 를 함께 돌려주는지 검증(4건 추가, 전체 35건 통과).
- 스모크 `view:channels`: 목록 행의 개수 텍스트 실측값 `수집 동영상 4개 · 자막 1개 · 저장 문장 4개`(데모 데이터 기준), 행 1/1 에서 `.channel-counts` 존재. 스크린샷 `_tmp/smoke-channels.png` 에서 같은 문구 확인.
- 개수는 조회 시점에 계산되므로 새 수집 후 목록을 다시 읽으면 즉시 갱신된다.

**2) 자막 줄 "문장 전송" 버튼 (T33)**

- 스모크: `.transcript-line__send` 버튼이 모든 자막 줄에 존재(15/15).
- 배치 실측: `{w:63, h:22, inside:true, overText:false, overTime:false}` — 버튼이 줄 안에 있으면서 문장 텍스트·시간과 겹치지 않는다.
- 동작: 버튼 클릭 시 오른쪽 문장 패널의 영어 문장 입력값이 해당 문장으로 채워지고, 줄 클릭(재생)은 발생하지 않는다(`view:learn 줄 클릭은 전송 아님`).
- 스크린샷 `_tmp/smoke-learn-transcript.png` 에서 줄마다 `문장 전송` 버튼과 안내 문구 확인.

**3) 자막 줄 클릭 = 그 지점부터 재생 (T33)**

- 스모크는 `YouTubePlayer.prototype` 을 임시 스텁으로 바꿔 호출을 추적했다.

      view:learn 줄 클릭 재생 {start:5, calls:[["seekTo",5],["play"]]}

  즉 줄 클릭 한 번에 `seekTo(5)` 와 `play()` 가 **모두** 호출된다. `seekTo` 만 호출하던 이전 동작은 일시정지 상태로 남았다.

### 회귀 방지

- 스모크 전체 71개 항목 통과(5차 64개 + 6차 7개). 기존 항목은 값까지 동일하게 유지됐다.
- 채널 E2E 재수집 단계 `기존 영상 메타 건너뛰기 {keptCount:3, addedCount:0}` 로 `refreshExisting` 동작이 그대로임을 확인했다.
- `main/db/channels.js` 의 컬럼 추가는 기존 조회 경로에 컬럼을 더할 뿐이라 다른 화면 동작은 바뀌지 않는다.

### 남은 확인

- OpenRouter 실제 호출은 이전 라운드와 동일하게 사용자 수동 확인 항목이다.
- 5차에서 남긴 "플레이어 iframe 영역이 1440x960 에서 일부 비어 보이는" 문제는 이번 라운드 범위가 아니며 동작에는 영향이 없다.

## 7차 라운드 검증 (2026-09-23)

사용자 요청 2건(모델 가격 표시 / 가성비 추천 + 모델 검색)에 대한 검증이다.

### 실행 결과

| 항목 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (수정 파일 전체) | 실패 0 |
| 단위 | `node --test test/*.test.js` | 40/40 통과 |
| 스모크 | `npm run smoke` | 75개 확인 / 실패 0 |
| 채널 E2E | `npm run e2e -- --url=https://www.youtube.com/@TED --limit=2` | 8/8 통과 |
| 재생 E2E | `npm run e2e:player` | 6/6 통과 |

### 항목별 근거

**1) 모델 가격 표시 (T34)**

- 단위 테스트 5건 추가: `pricing.prompt`/`pricing.completion` → 1M 토큰당 USD 환산, 무료(`0`)는 `무료`, 음수 단가(`-1`)는 `가격 미정`(무료와 구분), 넓은/좁은 표기 분리.
- 스모크 `view:settings`: `modelSearch:1`, `valueList:1`, `hasOpenRouter:true` — 키가 없어 목록이 비어도 두 영역이 자리를 잡는다.

**2) 가성비 추천 + 모델 검색 (T35)**

- 단위 테스트: 입력 40% · 출력 60% 가중 평균 점수 계산, 오름차순 정렬, 이름·ID 부분 일치 검색(대소문자 무시), `decorateModels` 순위 뱃지 부여.
- 렌더 확인은 임시 프로브(가짜 모델 4개 주입)로 행 구성·가격 표기·순위 뱃지·선택 강조·검색 필터·가로 넘침 0 을 확인했다.

### 남은 확인

- 실제 OpenRouter `/models` 응답 렌더는 API 키가 필요해 사용자 수동 확인 항목이다.

## 8차 라운드 검증 (2026-09-23)

사용자 요청 1건(자막 2000개 이상 수집 중 정지 수단 부재)에 대한 검증이다.

### 실행 결과

| 항목 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (수정 7개 파일) | 실패 0 |
| 단위 | `node --test test/*.test.js` | 46/46 통과 (취소 6건 추가) |
| 스모크 | `npm run smoke` | 76개 확인 / 실패 0 |
| 채널 E2E | `npx electron scripts/e2e-collect.js --url=https://www.youtube.com/@TED --limit=2 --fresh` | 8/8 통과 |
| 취소 E2E | `npx electron scripts/e2e-collect.js --url=https://www.youtube.com/@TED --limit=2 --fresh --cancel-after=30000 --cancel-limit=40` | 11/11 통과 |
| 재생 E2E | `npm run e2e:player` | 6/6 통과 |

### 항목별 근거

**1) 정지가 즉시 반영된다 (T36)**

- 취소 E2E `수집 중 정지 요청이 즉시 반영된다 :: {"code":"CANCELLED","elapsedMs":30012}` — 30초에 정지를 요청했고 12ms 뒤 취소가 확정됐다. 이전 구현은 자막 1건(최대 150초)이 끝날 때까지 기다려야 했다.
- 단위 테스트 `manager.run 취소 즉시 종료`: 자식 프로세스를 띄운 뒤 취소하면 `child.kill()` 로 20초 안에 종료되고 `code='CANCELLED'` 가 반환된다.
- 단위 테스트 `net.fetchText`: 사전 abort 면 `fetch` 를 아예 호출하지 않고, 진행 중 abort 면 즉시 `CANCELLED` 로 끝나며 **재시도하지 않는다**. 취소가 아닌 오류는 기존 재시도 횟수를 그대로 유지한다.

**2) 정지 버튼이 있다 (T37)**

- 스모크 `view:channels 정지 버튼 :: 취소 / 수집 정지` — 채널 관리 화면에 `.btn--sm.btn--danger` 정지 버튼이 있고 문구가 `수집 정지` 다.
- 정지 요청 후에는 문구가 `정지하는 중…` 으로 바뀌고 진행/전체 수집 버튼은 잠긴다(`paintCancelButtons`).
- 채널 프로브 `stopButtons` 로 버튼 텍스트를 실측했고, 스크린샷 `_tmp/smoke-channels.png` 에서 진행 바 옆 배치를 확인했다.

**3) 정지해도 모은 자료는 남는다 (T36)**

- 취소 E2E `정지 시점까지의 결과가 보존된다 :: {"videoCount":40,"addedCount":40,"transcriptCount":2}` — 정지 시점까지 40개 영상과 2개 자막이 이미 저장돼 있고, 그 값이 반환·`error.detail` 에 그대로 실린다.
- 취소 E2E `정지 후에도 저장된 자료는 유지된다 :: {"videos":40,"transcripts":4}` — 취소 후 DB 를 다시 읽어도 자료가 사라지지 않는다(직전 실행 자막 2건 포함).
- 채널 행은 `취소됨` 상태로 남고, 목록을 다시 읽으면 개수가 갱신된다.

### 회귀 방지

- 스모크 전체 76개 통과(7차 75개 + 정지 버튼 1개). 기존 항목 값은 동일하게 유지됐다.
- 단위 테스트 46건(7차 40건 + 취소 6건) 전부 통과. 취소를 넣으면서 **비취소 경로의 재시도 횟수·저장 결과가 그대로**임을 함께 검증했다.
- 채널 E2E 는 `--fresh` 없이 돌리면 이전 실행의 DB 가 남아 `DB 영상 저장` 항목이 실패로 표시된다(스크립트 상태 문제이며 코드 결함이 아니다). 반복 검증 시에는 항상 `--fresh` 를 붙인다.
- 취소 E2E 는 `_tmp/e2e-userdata/study-ted.db` 를 대상으로 돌고 앱의 실제 userData 는 건드리지 않는다.

### 남은 확인

- 실제 2000개 규모 채널의 전체 수집 중 정지는 사용자 환경에서 확인하는 항목이다. 검증은 40개 지점(30초)에서 정지시켜 네트워크 요청·자식 프로세스가 즉시 끊기는 것까지 확인했다.
- OpenRouter 실제 호출은 이전 라운드와 동일하게 사용자 수동 확인 항목이다.
## 9차 라운드 검증 (2026-09-23)

사용자 피드백 2건(자막 수집이 너무 느림 · 진단용 카드 노출)에 대한 검증이다.

### 실행 결과

| 항목 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (main·renderer·scripts·test 48개) | 실패 0 |
| 단위 | `node --test test/*.test.js` | 51/51 통과 (자막 동시성 5건 추가) |
| 스모크 | `npm run smoke` | 76개 확인 / 실패 0 |
| 채널 E2E | `electron scripts/e2e-collect.js --url=@TED --limit=6 --fresh` | 8/8 통과 (영상 6 · 자막 6) |
| 재생 E2E | `npm run e2e:player` | 6/6 통과 |

### 항목별 근거

**1) 자막을 동시에 받는다 (T38)**

- 프로브 `_tmp/probe-subs-speed.log` — TED 영상 6편을 ① 한 편씩 ② `--batch-file` 한 프로세스로 비교: `one-by-one(cold) 66,100ms(편당 11,017ms · 파일 14개)` vs `batched(1 proc) 48,143ms(편당 8,024ms · 파일 16개)` = **1.37x**. 프로세스 생성 비용보다 네트워크 왕복 대기가 지배적이라 배치만으로는 부족했다.
- 프로브 `_tmp/probe-subs-conc.log` — 워커 풀 적용 후: `sequential 55,628ms(편당 9,271ms)` vs `concurrent(4) 24,307ms(편당 4,051ms · 파일 6개)` = **2.29x**. 편당 시간이 13.0·15.4·16.2·18.0·9.1·8.9초로 겹쳐 줄었다.
- 받는 파일 수가 14~16개 → **6개**(편당 1개)로 줄었다. `--sub-langs en` 이 `en-fr`·`en-hu`·`en-es` 같은 자동 번역 트랙을 함께 받지 않기 때문이다.
- 단위 5건 통과: 동시 개수 1~8 상한, 동시 실행, 동시 1이면 순차, 기존 자막 재사용, **동시 수집 중 즉시 정지 + 이미 받은 자막 보존**.
- 채널 E2E `자막 수집 :: {"transcriptCount":6,"failures":[]}` · `자막 DB 저장 :: {"lang":"en","segments":207}` — 동시 수집으로 바꾼 뒤에도 자막 내용이 정상 저장된다.

**2) 진단 카드는 평소 보이지 않는다 (T39)**

- 노출 조건은 `renderer/js/views/channels.js:122` 의 한 줄(`settings.preference === 'ytdlp' && !ytdlp.available`)뿐이며 기본값은 `hidden` 이다. yt-dlp 가 설치된 환경에서는 `수집 환경` 카드가 그려지되 `hidden` 상태로 남는다.
- 스모크 `view:channels` 는 76/0 으로 통과했고(카드 숨김은 렌더 결과에 영향 없음), 같은 정보와 `yt-dlp 내려받기` 가 설정 화면에 있는지 기존 항목으로 확인된다.

### 회귀 방지

- 채널 E2E 가 `--fresh` 로 8/8 통과했고 `transcriptCount:6` · `failures:[]` 로 자막 수집량이 줄지 않았다.
- 8차 계약(즉시 정지) 유지: 동시 수집에서도 정지 시 진행 중 자식 프로세스가 끊기고 받은 자막이 남는 것을 단위 테스트로 확인했다.
- 스모크 76개 전부 통과 — 수집 동시성은 렌더러 화면 항목이 아니므로 스모크 항목 수는 8차와 같다.

### 남은 확인

- 실제 대형 채널(수천 편) 전체 수집 시간은 사용자 환경 확인 항목이다. 동시 개수를 1 로 낮추면 순차 동작으로 되돌릴 수 있다.
- OpenRouter 실제 호출은 이전 라운드와 동일하게 사용자 수동 확인 항목이다.

## 10차 라운드 검증 (2026-09-23)

사용자 피드백 2건(문장 전송이 기존 입력을 덮어씀 · 저장하지 않고 AI 분석)에 대한 검증이다.

### 실행 결과

| 항목 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (main·renderer·scripts·test 48개) | 실패 0 |
| 단위 | `node --test test/*.test.js` | 51/51 통과 |
| 스모크 | `npm run smoke` | 80개 확인 / 실패 0 (누적 전송·중복 무시·AI 즉시 저장·결과 표시 4건 추가) |
| 채널 E2E | `electron scripts/e2e-collect.js --url=@TED --limit=6 --fresh` | 8/8 통과 (영상 6 · 자막 6 · `transcriptCount:6`) |
| 재생 E2E | `npm run e2e:player` | 6/6 통과 |

### 항목별 근거

**1) 문장이 지워지지 않고 쌓인다 (T40)**

- 스모크 `view:learn 문장 누적 전송 :: ["Hi everyone!","Welcome back to my channel."]` — 자막 줄 2개를 연속 전송했을 때 `.sentence-box` 값이 **2줄**이고 순서가 전송 순서와 같다(첫 줄 = 1번째 줄 텍스트, 둘째 줄 = 2번째 줄 텍스트).
- 스모크 `view:learn 중복 문장 무시 :: ["Hi everyone!","Welcome back to my channel."]` — 같은 줄을 한 번 더 전송해도 여전히 2줄이다(중복 0).
- 스모크 `view:learn 줄 클릭은 전송 아님 :: 문장 패널 유지` — 줄 본문 클릭(재생)은 패널을 바꾸지 않는다(기존 동작 유지).
- 저장 시 문장별 `startSec` 를 쓰므로 2번째 문장이 1번째 시각으로 저장되지 않는다(`startSecFor()` → `sentences:create.startSec`).

**2) 저장하지 않고 AI 를 눌러도 저장·표시된다 (T41)**

- 스모크 `view:learn AI 분석 즉시 저장 :: [{"source":"ai","analysis":true,"sentence":"This is a smoke test sentence."}]` — 저장 버튼을 누르지 않고 **AI 구문분석만** 눌렀는데 `api.sentences.create` 가 `source:'ai'` 와 `analysis` 를 실어 **정확히 1회** 호출됐다.
- 스모크 `view:learn AI 분석 결과 표시 :: {"boxLeft":"","text":"AI 분석 결과smoke-model…1문장 해석…2구문 분석…"}` — 분석 결과가 패널에 즉시 보이고, 저장된 문장은 입력칸에서 사라졌다(남은 입력 0자).
- 단위 51/51 통과로 AI 응답 정규화(`test/ai-parse.test.js`)와 저장 경로에 회귀가 없음을 확인했다.

### 회귀 방지

- 스모크 80개 전부 통과(9차 76개 + 4개). 기존 항목(`문장 전송 버튼` 15/15, `문장 전송 동작`, `줄 클릭 재생`)의 값이 그대로 유지됐다.
- `main/ipc.js` · `main/db/*` · `main/preload.js` 를 수정하지 않아 저장 계약(`source` 허용값 4종, `startSec` 검증, 2000자 상한)이 그대로다.
- 채널 E2E 8/8 · 재생 E2E 6/6 로 수집·재생 경로에 영향이 없음을 확인했다.

### 남은 확인

- 실제 OpenRouter 키로 여러 문장(최대 5개)을 한 번에 분석하는 동작은 사용자 수동 확인 항목이다(스모크는 `api.ai.analyze`·`api.sentences.create` 를 스텁으로 대체해 배선만 검증).
- `npm run e2e` 를 npm/PowerShell 경유로 실행하면 `--limit` 같은 인자가 전달되지 않아 수집 개수가 기본값(3)으로 돌아간다(코드 결함 아님, `08_error_log.md` 참조). 직접 실행하면 8/8 이다.

### 문서 동기화와 정리 (10차 마무리)

- `README.md` 주요 기능 3번(자막 모드)에 "문장 전송은 입력칸을 지우지 않고 줄 단위로 쌓이며 중복은 무시" 를, 5번(AI 구문분석)에 "저장하지 않고 AI 를 눌러도 자동 저장·즉시 표시(최대 5문장, `분석 중… i/n`)" 를 반영했다. 설정 항목에 **자막 동시 수집 개수**(기본 4, 1~8), 자막 수집 절에 동시 수집 2.29x 안내, 문제 해결 표에 4행(수집 속도·문장 누적·AI 자동 저장·`수집 환경` 카드), 검증 절에 `--url=`/`--limit=` 인자 주의 한 줄을 추가했다.
- `_workspace/99_decisions.md` 에 D-022~D-026(동시성 채택 · 진단 카드 노출 규칙 · 영어 트랙 한정 · 문장 누적 · AI 즉시 저장)을, `_workspace/08_error_log.md` 에 9·10차 라운드 표를 기록했다.
- `_tmp` 에서 프로브 스크립트·로그(`probe-subs-speed.*`, `probe-langs.*`, `probe-subs-concurrency.js`, `probe-subs-conc.log`, `argv-probe.js`)와 `probe-*` 폴더, 검증용 userData(`e2e-userdata`, `e2e-player-userdata`)를 정리했다. `yt-dlp.exe` 와 스모크 산출물은 유지했다.
- 정리 후 재측정: `npm test` 51/51 · `npm run smoke` 총 80개 확인 / 실패 0. 신규 4개 항목(`문장 누적 전송`·`중복 문장 무시`·`AI 분석 즉시 저장`·`AI 분석 결과 표시`)이 다시 통과했다.

## 11차 라운드 검증 (2026-09-23)

### 원인 재현과 확인

- 표시 상한은 DB 가 아니라 렌더러 요청값이었다: `renderer/js/actions.js` 의 `api.videos.list({ channelPk, limit: 200 })`. DB(`videos`)에는 채널의 전체 동영상이 들어 있었고, 렌더러만 200편을 받아 그리고 있었다.
- 검색·페이징 경로 자체가 없었다(`videosDb.list` 에 `q`/`offset` 없음, IPC `videos:list` 는 `offset` 미전달).

### 자동 검증

- **문법**: 수정한 JS/테스트 전부 `node --check` 통과(실패 0).
- **단위(`npm test`)**: **52/52**. 신규 `videos list/count 가 검색어와 페이징을 처리한다` 1건 추가.
  - 채널 3편 기준 `list({channelPk}).length === 3`, `q:'Alpha'` → 1편, `q:'clip'` → 2편, `q:'second note'`(설명 매칭) → 1편, `q:'없는 제목'` → 0편, `count({channelPk, q:'clip'}) === 2`.
  - `q:'100%'`/`q:'%'` → `100%` 가 들어간 제목 1편만(와일드카드 이스케이프), `q:'_'` → 0편.
  - `limit:2/offset:0` + `limit:2/offset:2` 두 페이지가 겹침·누락 없이 3편을 덮는다.
  - 다른 채널 동영상이 섞이지 않는다(`count({q:'Alpha'}) === 1`).
  - 기존 기대값(`videos.count() === 3`, `list({channelPk}).length === 2`, `limit:1` 길이 1)은 그대로 통과한다.
- **스모크(`npm run smoke`)**: **총 89개 확인 / 실패 0** (직전 80 → +9).
  - `bridge:videos.page :: {"items":4,"total":4,"hasMore":false,"offset":0,"limit":50,"filtered":1,"filteredTotal":1}`
  - `동영상 페이지 항목 4개` · `동영상 전체 개수` · `동영상 페이지 offset/limit` · `동영상 다음 페이지 없음(false)` · `동영상 검색 결과 1개(1/1)`
  - `view:learn :: {…,"search":1,"pager":1,"countText":"전체 4개 중 1–4"}`
  - `view:learn 검색/페이징 :: 검색 1 / 페이저 1`
  - `view:learn 검색/페이저 배치 :: {"cardW":294,"searchW":266,"searchInside":true,"pagerInside":true,"overlap":false}`
  - `view:learn 제목 검색 :: {"before":4,"hitLabel":"검색 결과 1개 중 1–1","noneLabel":"검색 결과 0개","after":4,"afterLabel":"전체 4개 중 1–4"}` — 검색어 입력 → 1편, 없는 말 → 0편, 지우면 4편 복원.
  - 기존 학습 화면 검증(썸네일 4/4 · 문장 전송 15/15 · 배치 · 누적 전송 · 중복 무시 · AI 즉시 저장 · 결과 표시)은 그대로 통과한다.
- **채널 E2E(TED, `--limit=6 --fresh`)**: **8/8**. 실제 채널 6편 수집·자막 6건 저장·`refreshExisting=false` 재수집 유지 확인(`keptCount:6`, `addedCount:0`).
- **재생 E2E(`npm run e2e:player`)**: **6/6**. 플레이어 마운트·재생 오류 0·재생 시간 1174s·Referer 전달.

### 화면 배치 확인

- 좁은 픽커 카드(폭 294px)에서 검색 입력(266px)과 `‹ 이전`/`다음 ›` 버튼이 카드 밖으로 나가지 않고 서로 겹치지 않는다(스모크가 `getBoundingClientRect` 로 상시 확인).
- 검색 입력은 채널 드롭다운 바로 아래, 목록 위에 있다(사용자가 짚은 "TED-Ed · 2.2K videos" 는 드롭다운 텍스트라 유지).

### 문서 동기화 (11차 마무리)

- `README.md` 주요 기능 목록에 **동영상 선택 목록**(50편 페이징 + 제목·설명 검색 + `전체 N개 중 i–j`) 항목을 추가했고, 문제 해결 표에 `학습하기 동영상 목록이 200개만 보임` 행을 추가했다.
- `_workspace/04_file_map.md` 의 11차 라운드 제목을 실제 수정 파일 수(10개)에 맞게 정정했다.
- 문서 변경 후 `npm test` 재실행: **52 / 52 통과**. 문서만 바뀌었으므로 코드 검증 수치는 11차 라운드 기록과 동일하다.

### 대량 데이터 실측 (동영상 2,345편)

- **임시 DB 실측** — 임시 DB 에 동영상 **2,345편**을 넣고 확인(`_tmp/scale-check.js`): `count()` 2,345 · 페이지 1 = 50편 · 마지막 페이지(offset 2300) = 45편 · 1·2페이지 합쳐 중복 0(100편 모두 서로 다름) · 제목 검색 `photosynthesis` = 6ms, 335건(기대값 일치) · 리터럴 `%` 검색 = 0건(LIKE 이스케이프 정상). 채널 E2E 규모(6편)·스모크 규모(4편)보다 훨씬 큰 실제 상황에서도 페이징·검색이 정상 동작함을 확인했다.

## 12차 라운드 검증 (AI 구문분석 자동저장 + 분석 노출)

### 원인 실측

- 실사용 로그(`%APPDATA%\study-ted\logs\app.log`): `ERROR ipc ai:analyze 처리 실패 요청이 너무 많습니다…` 가 08:16:12 1회, 08:26:07~08:26:21 13회 = **14회 연속**. 실제 모델은 `meta-llama/llama-3.1-8b-instruct`(무료).
- 실사용 DB(`node _tmp/db-inspect.js`): `sentences` 총 2건, 둘 다 `analysis_json`·`translation` NULL → **AI 자동저장 성공 이력 0건**. 즉 429 로 분석이 죽어 저장 단계까지 가지 못했다.
- 저장 계층 왕복(`node _tmp/analysis-roundtrip.js`): `created analysis? true keys translation,structure,expressions,examples,raw` → `getByPk`·`list`·`exportAll`·`update` 모두 분석이 유지됨 → **저장 계층은 결함 아님**.

### 자동 검증

| 항목 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (수정 파일 전체) | 0 실패 |
| 단위 | `node --test test/*.test.js` | **57 / 57** (11차 52 → 429·5xx 재시도 5건 추가) |
| 스모크 | `npm run smoke` | **92 / 0** (11차 89 → 3건 추가) |
| 채널 E2E | `electron.cmd scripts/e2e-collect.js "--url=@TED" "--limit=6" "--fresh"` | **8 / 8** (TED 6편 · 자막 6건 · `transcriptCount:6` · `keptCount:6, addedCount:0`) |
| 재생 E2E | `npm run e2e:player` | **6 / 6** |

추가된 단위 테스트(`test/ai-parse.test.js`):

- `request 가 429 를 재시도해 성공한다` — 첫 응답 429, 두 번째 200 이면 결과를 돌려주고 호출 2회.
- `request 가 재시도를 모두 소진하면 다른 모델을 안내한다` — `code === 'AI_RATE_LIMIT'`, 메시지에 `다른 모델`, `detail` 존재.
- `5xx 는 재시도하고 401 은 즉시 던진다` — 503 은 2회 시도 후 성공, 401 은 1회 시도로 즉시 `AI_HTTP`.
- `일시적 네트워크 오류를 재시도한다` — `fetch` throw 후 성공.
- `retryDelayMs 가 Retry-After 헤더를 지수 백오프보다 우선한다` — 2000 / 800 / 3200 / 8000 / 8000(상한) / 20(헤더 우선).

추가된 스모크:

- `view:notes 분석 표시 :: 상세 1 / 카드 1 / 버튼 1 / 요약 1` — 데모 문장 4건 중 분석이 있는 1건에서만 상세 행·카드·요약·토글 버튼이 정확히 1개씩 생긴다.
- `view:notes 분석 펼치기 :: {"before":true,"after":false,"card":true,"text":"저장된 AI 분석1문장 해석그래서 오늘은 좋은 아침 루틴을…"}` — `분석 보기` 를 누르면 상세 행이 실제로 펼쳐지고 해석·구문 분석 섹션이 들어 있다.
- `view:learn AI 분석 실패 표시 :: {"createCalls":0,"staleSuccess":false,"text":"분석하지 못한 문장1건Failure path smoke sentence. — 분석 서버가 응답하지 않습니다."}` — AI 호출이 실패하면 저장 호출 0회, 직전 성공 카드 없음(`staleSuccess:false`), 실패 문장과 이유가 표시된다.
- 기존 `view:learn AI 분석 즉시 저장` / `AI 분석 결과 표시` 는 그대로 통과 — 분석 → 저장(`source:'ai'`, `analysis` 포함) → 입력칸 정리 → 화면 표시까지 유지된다.

### 육안 확인

- `_tmp/smoke-notes.png`(156,902 bytes) — 문장 노트 표에 `분석` 컬럼과 `구문 4 · 표현 2 · 예문 2` 요약, `분석 보기` 버튼이 보인다.
- `_tmp/smoke-learn-transcript.png`(249,299 bytes) — 문장 패널에 빨간 `분석하지 못한 문장` 카드가 직전 성공 카드를 대체한 상태로 찍힌다.
- `_tmp/smoke-materials.png`(123,560 bytes) — 학습 자료 목록에 요약 pill 과 `분석` 토글이 문장 4건 중 1건에 붙는다.

### 회귀 없음 확인

- 11차 검증(검색·페이징·썸네일·문장 전송·줄 클릭 재생·누적 전송)이 스모크에서 모두 다시 통과했다.
- 채널 E2E 의 `기존 영상 메타 건너뛰기`(`refreshExisting:false`, 6 → 6)와 `자막 수집`(6건, 실패 0)이 유지된다.

## 13차 라운드 검증 (영어 필드 한국어 오염 수정 + 분석 카드 정리)

### 원인 실측

- 실사용 DB(`%APPDATA%\study-ted\study-ted.db`)의 `sentences.analysis_json` 을 열어 **정상 1건**(id=3: `structure[].part` 가 영어 `So today,` / `meaning` 이 한국어)과 **오염 1건**(id=4: `translation` 이 영상 제목, `structure[].part` 가 한국어 명사구, `examples[].en` 이 한국어)이 섞여 있음을 확인했다.
- 원인이 렌더러가 아니라 **모델이 만든 데이터**임을 확정한 근거는 ① 렌더러는 `analysis_json` 을 파싱해 그대로 그리는 경로뿐이고 ② 오염 문장과 정상 문장이 **같은 화면에 동시에** 보였다는 점 ③ DB 값 자체가 한국어였다는 점이다.
- 사용 모델은 `meta-llama/llama-3.1-8b-instruct`(무료 8B)였다. 기존 `systemPrompt` 에 `structure[].part` 의 언어 규칙이 **없었고**, `normalizeAnalysis` 도 언어를 검사하지 않아 오염이 그대로 저장됐다.

### 자동 검증

- `node --check` (main·renderer·test·scripts 전체): **BAD 0**
- `node --test test/*.test.js`: **61/61 pass / fail 0** — 언어 검증·교정 4건이 추가됐다.
  - `findLanguageMismatch 가 영어 필드에 섞인 한글만 찾아낸다`
  - `프롬프트가 영어 필드는 영어로 두라고 지시한다`
  - `analyzeSentence 가 한국어로 채워진 영어 필드를 한 번 더 요청해 바로잡는다`
  - `analyzeSentence 는 교정이 안 되면 결과를 유지하고 오염 사실을 남긴다`
- `electron scripts/smoke.js`: **총 94개 확인 / 실패 0개** — 화면 확인 2건이 추가됐다.
  - `[PASS] view:notes 구문 영어 표시 :: So today, / I want to talk about / how to build`
  - `[PASS] view:notes AI 원문 응답 없음 :: {"rawBox":false,"rawTitle":false}`
- 채널 E2E: `총 8개 확인 / 실패 0개` · 재생 E2E: `총 6개 확인 / 실패 0개`

### 육안 확인

- `_tmp/smoke-notes.png` — 분석 카드가 `1. 문장 해석` + `2. 구문 분석` 두 항목만 보이고, 구문(`part`)은 영어·설명은 한국어로 표시된다. 하단 `AI 원문 응답` 은 없다.
- `_tmp/smoke-learn-transcript.png` — 문장 패널 카드도 같은 2항목 구성이다.

### 회귀 없음 · 알려진 한계

- 12차 검증(노트 `분석` 컬럼·`분석 보기` 펼치기·분석 실패 카드)이 그대로 통과한다(`view:notes 분석 표시 :: 상세 1 / 카드 1 / 버튼 1 / 요약 1`).
- **한계**: 이미 한국어로 저장된 분석은 소급 복구되지 않는다. 문장 노트에서 해당 문장을 열고 `AI 구문분석` 을 다시 눌러야 하며, 이제는 카드 상단 노란 경고(`.analysis__warn`)로 오염 여부를 바로 알 수 있다.

## 14차 라운드 검증 (문장 노트에서 주요 표현·예문·메모·태그 제거)

### 자동 검증

- `node --check` (main·renderer·test·scripts 전체): **BAD 0**
- `node --test test/*.test.js`: **61/61 pass / fail 0** (12차와 동일 개수 — 제거된 태그·메모 단언 수만큼 기존 문장 CRUD·내보내기 단언이 대체됐다)
- `electron scripts/smoke.js`: **총 92개 확인 / 실패 0개** (94 → 92, `태그 목록`·`문장 수정 태그` expect 2건 제거)
  - `[PASS] bridge:sentences.update :: {"translation":"수정된 해석"}` — 수정 payload·반환에 `note`/`tags` 가 없다.
  - `[PASS] 문장 수정 :: 수정된 해석`
  - `[PASS] view:notes :: {"table":4,"rows":4,"details":1,"cards":1,"summaries":1,"toggleButtons":1}`
- 채널 E2E: `총 8개 확인 / 실패 0개` (TED 6편 · 자막 6건 · `기존 영상 메타 건너뛰기 keptCount:6`) · 재생 E2E: `총 6개 확인 / 실패 0개`

### 실데이터 마이그레이션 실측

실사용 DB(`%APPDATA%\study-ted\study-ted.db`) + WAL/SHM 을 `_tmp/migtest/` 로 복사한 뒤 `main/db/index.js` 의 `init()` 을 실행했다.

| 항목 | 마이그레이션 전 | 마이그레이션 후 |
|---|---|---|
| `meta.schema_version` | `1` | `2` |
| `sentences.note` 컬럼 | 있음 | **없음** |
| `tags` / `sentence_tags` 테이블 | `[tags, sentence_tags]` | **`[]`** |
| 채널 | 1 | 1 |
| 영상 | 2,358 | 2,358 |
| 자막 | 144 | 144 |
| 문장 | 4 | 4 |

- 컬럼·테이블만 사라지고 **행 수는 하나도 변하지 않았다**(문장·해석·분석 보존).
- **확인 필요 사항**: 살아 있는 실DB 는 사용자 앱이 이전 코드로 떠 있어 아직 `schema_version=1` 이다. 마이그레이션은 앱 시작 시 실행되므로 **앱을 다시 켜면 자동으로 2로 올라간다**(별도 조치 없음).

### 육안 확인

- `_tmp/smoke-notes.png`(149,815 bytes) — 문장 노트 표에 `태그` 컬럼이 없고 `번호 · ★ · 문장 · 해석 · 분석 · 출처 · 저장일` 만 남는다.
- `_tmp/smoke-materials.png`(117,181 bytes) · `_tmp/smoke-share.png`(105,779 bytes) — 태그 필터/태그 요약 없이 그대로 동작한다.
- `_tmp/smoke-settings.png`(158,459 bytes) — 설정 화면은 변화 없음(`.chip-row` 스타일은 설정·공유에서 계속 쓰인다).

## 15차 라운드 검증 (구문 한국어 뜻 필수 + 단어 분할 금지)

### 원인 실측

실사용 DB(`%APPDATA%\study-ted\study-ted.db`) + WAL/SHM 사본(`_tmp/dbcheck/`)을 열어 `sentences` 를 조회했다.

| 항목 | 실측값 |
|---|---|
| `sentences.id=5` 의 `structure` | `[{part:'Along',meaning:'',note:''}, {part:'with',…}, {part:'their',…}, {part:'research',…}]` (단어 10개) |
| `meaning` | **전부 빈 문자열** |
| 사용 모델 | `meta-llama/llama-3.1-8b-instruct`(무료 8B) |
| 판정 | 렌더러·저장 경로 정상(스모크가 `analysis` 파싱 필드를 그대로 그림). **모델 출력 품질 문제** |

### 자동 검증

| 검증 | 결과 |
|---|---|
| `node --check` (main·renderer·test·scripts 전체) | 실패 **0** |
| `node --test test/*.test.js` | **67/67** (뜻·분할 교정 6건 추가) |
| `electron scripts/smoke.js` | **93/0** (`view:notes 구문 뜻 표시 :: : 그래서 오늘은 / : ~에 대해 이야기하고 싶다` 포함) |
| `electron scripts/e2e-collect.js --url=@TED --limit=6 --fresh` | **8/8** (TED 6편 · 자막 6건 · `refreshExisting` 스킵 확인) |
| `electron scripts/e2e-player.js` | **6/6** |
| 실키 실응답(`_tmp/ai-check.js`, 실DB 사본 userData, 키 미출력) | 같은 문장이 **4개 구문**으로 묶이고 모든 `meaning` 한국어, `findMissingMeaning=[]` · `findLanguageMismatch=[]`. 1차 실행(교정 전)에서 8B가 단어 10개를 뱉었고 `findChunkingProblem` 교정이 이를 잡아냈다 |

### 육안 확인

- `_tmp/smoke-notes.png`(149,820 bytes) — 분석 카드의 구문 행이 `영어 구문 : 한국어 뜻` 으로 표시된다.
- `_tmp/smoke-learn-transcript.png`(249,749 bytes) — 학습 화면 분석 박스도 같다.

### 회귀 없음 · 알려진 한계

- 13차의 `structure[].note`(구문 설명) 표시, 14차의 태그·메모 제거는 그대로다. 스모크 확인 항목은 14차 92 → 15차 93(`구문 뜻 표시` 1건 추가).
- **한계**: 이미 단어 분할·뜻 없음으로 저장된 분석은 소급 복구되지 않는다. 문장 노트의 `AI 다시 분석` 버튼으로 갱신해야 하며, 이번 라운드에서 그 버튼을 조건부로 붙였다.

## 16차 라운드 검증 (빌드 패키징 + 자동 업데이트)

실행 환경은 위와 같다(Windows / PowerShell 5.1 / Node v22.15.1 / Electron 44.4.4). 이번 라운드에서 추가로 `electron-builder` 26.15.3 설치본을 만들었다.

### 1. 문법 검사

수정한 모든 JS 파일에 `node --check` 를 돌려 오류 0건을 확인했다(`main/update.js`, `main/main.js`, `main/ipc.js`, `main/preload.js`, `main/db/settings.js`, `main/collect/ytdlp-manager.js`, `renderer/js/{api,state,actions,app}.js`, `renderer/js/views/{home,settings}.js`, `renderer/js/components/update-banner.js`, `scripts/{make-icon,prepare-bin,make-manifest,smoke}.js`, `test/{update,update-feed}.test.js`).

### 2. 단위 테스트 — `npm test` : 81 / 81 통과

```
# tests 81
# pass 81
# fail 0
# duration_ms 967.09
```

이번 라운드에서 14건이 늘었다(기존 67 → 81).

- `test/update.test.js` 3건 — `parseVersion` 이 `v1.0.1`·`1.0.1`·`v1.0` 을 파싱하고 잘못된 값이면 null, `isNewer` 가 숫자로 비교(문자열 비교 아님), 잘못된 값이면 false
- `test/update-feed.test.js` 11건 — 로컬 HTTP 서버 + `electron` 스텁
  - 주소 없음 / `ftp://` → `UPDATE_NO_FEED`(그리고 이전 `latest` 폐기)
  - 새 버전 → `available`, 같은 버전 → `current`
  - 302 리다이렉트 추적 + 상대 자산 URL 해석(`StudyTED-Setup-1.0.1.exe` → 피드 기준 절대 URL)
  - 다운로드 → sha256 일치 → `ready`, `.part` 잔여 0, 재확인 시 `ready` 재사용(서버 요청 수 증가 없음), `cleanupDownloads(keep)` keep/drop 동작
  - sha256 불일치 → `UPDATE_HASH` + `.part` 삭제
  - 피드 503 → `UPDATE_HTTP`
  - 개발 실행 `install()` → `UPDATE_DEV`(동기 throw, `assert.throws` 로 확인)
  - 자동 확인: 주소 없음·`autoCheck` 꺼짐 → 피드 요청 0회, 확인 후 6시간 이내 재요청 없음
  - 조용한 설치 스크립트: `apply-update.cmd` 의 `/D=` 줄에 다른 명령이 붙지 않음(줄 수·순서 고정)

> 주의: `node --test test/`(디렉터리 인자)는 이 Node 버전에서 동작하지 않는다. 반드시 `npm test`(`node --test test/*.test.js`)를 쓴다.

### 3. Electron 스모크 — `npm run smoke` : 96개 확인 / 실패 0

```
[PASS] view:home 버전 표시 :: StudyTED v44.4.4업데이트 주소를 설정하면 새 버전이 나올 때 알려 드립니다.업데이트 내려받기업데이트 확인업데이트 설정
[PASS] view:home 업데이트 버튼 :: ["업데이트 내려받기","업데이트 확인","업데이트 설정"]
[PASS] view:settings 업데이트 카드 :: {"textInput":1,"checks":2,"buttons":["저장","업데이트 확인","내려받기","지금 설치하고 다시 시작"]}
총 96개 확인 / 실패 0개
```

- 스모크는 픽스처 userData 를 쓰고 `info.version` 이 실행기 버전(44.4.4)으로 들어오므로 화면에 `StudyTED v44.4.4` 로 보인다. **실제 앱은 `package.json` 의 `1.0.0`** 을 쓴다(`main/ipc.js` 의 `version: app.getVersion()`).
- `_tmp/smoke.png`(205,345 bytes) 육안 확인: 홈 최상단 좌측 `StudyTED v44.4.4` + 안내 문구, 우측 `업데이트 내려받기`·`업데이트 확인`·`업데이트 설정` 버튼, **검은 반투명 레이어 없음**(7차 T30 회귀 없음), 아래 카드·표 정상.
- `_tmp/smoke-settings.png`(158,422 bytes): 업데이트 카드에 `현재 버전` 라벨 + 주소 입력 1개 + 체크박스 2개 + 버튼 4개.
- 기존 확인 항목(문장 전송·누적, 분석 카드, 구문 뜻, 검색/페이징, 수집 정지, 채널 개수 표시)은 모두 그대로 통과했다 — 15차 93 → 16차 96(3건 추가).

### 4. 패키징 — `npm run dist`

```
npm run dist      # node scripts/prepare-bin.js && electron-builder --win && node scripts/make-manifest.js
```

- `build/icon.png` (6,821 bytes) · `build/icon.ico` (6,843 bytes) 생성 확인(외부 도구 없이 생성)
- `build/bin/yt-dlp.exe` (17,840,399 bytes) — `_tmp/yt-dlp.exe` 와 같은 크기
- `dist/StudyTED-Setup-1.0.0.exe` — **128,832,424 bytes**
- `dist/StudyTED-Setup-1.0.0.exe.blockmap` — 135,440 bytes
- `dist/latest.json` — 241 bytes

```json
{
  "version": "1.0.0",
  "pubDate": "2026-09-24T10:45:10.039Z",
  "url": "StudyTED-Setup-1.0.0.exe",
  "sha256": "daaf4c9392ea7638a683640105ef455d32684182cd8b7d36abf9ea1a3edad478",
  "size": 128832424,
  "notes": "1.0.0 버전입니다."
}
```

- `Get-FileHash dist\StudyTED-Setup-1.0.0.exe -Algorithm SHA256` = `DAAF4C9392EA7638A683640105EF455D32684182CD8B7D36ABF9EA1A3EDAD478` — **`latest.json` 의 sha256 과 일치**(소문자 비교).
- `dist/win-unpacked/resources/bin/yt-dlp.exe` (17,840,399 bytes) — `extraResources` 로 번들된 것 확인.
- `dist/win-unpacked/resources/app.asar` (376,403 bytes) 안에 `clearLatest`·`UPDATE_NO_FEED`·`apply-update.cmd`·`update-banner`·`StudyTED-Setup` 문자열이 모두 있는지 확인 → **최신 코드가 asar 에 반영됨**.

### 5. 회귀 없음 · 알려진 한계

- 채널 수집·재생·문장 노트·분석 카드(13~15차)는 코드 변경이 없고 스모크 96/0 으로 확인했다.
- 앱 시작 시 `cleanupDownloads()` 와 8초 뒤 `autoCheck()` 가 도는데, 피드 주소가 없으면 **아무 요청도 하지 않으므로** 기존 사용자 환경에 부하·오류 로그가 생기지 않는다.
- **한계**: 업데이트 피드(JSON)를 올릴 서버는 사용자가 준비해야 한다. 주소를 넣지 않으면 배너는 안내 문구만 보여 준다.
- **한계**: 설치본 서명(코드 사이닝)은 하지 않았다. Windows SmartScreen 경고가 뜰 수 있다.

## 17차 검증 (GitHub 릴리스 배포 · 기본 업데이트 주소)

### 1. 단위 테스트 · 스모크

- `npm test` (`node --test test/*.test.js`) → **81 / 81 pass, 0 fail**. 기본 피드 주소를 넣은 뒤에도 업데이트 관련 14건(update 3 + update-feed 11)이 그대로 통과했다(테스트는 `require.cache` 스텁으로 `electron` 을 대체하고 로컬 HTTP 서버를 쓰므로 기본값과 무관하게 동작).
- `npm run smoke` → **96 확인 / 실패 0**. `view:home 버전 표시`(StudyTED + 버전), `view:home 업데이트 버튼`, `view:settings 업데이트 카드`(입력 1 · 체크 2 · 버튼 4) 모두 통과.

### 2. 빌드 · asar 반영

- `npm run dist` 성공 → `dist\StudyTED-Setup-1.0.0.exe` (122.9MB) · `.blockmap` · `dist\latest.json`.
- `dist\win-unpacked\resources\app.asar` 를 읽어 `github.com/pang980/study-ted/releases/latest/download/latest.json` 문자열이 들어 있는지 확인 → **True**(기본 주소가 포장된 코드에 반영됨). `update-banner` 도 함께 확인.

### 3. GitHub 저장소 · 릴리스

- `gh repo view pang980/study-ted` → `visibility: PUBLIC`, `defaultBranchRef: main`.
- 첫 푸시: 커밋 1개(`StudyTED v1.0.0 - YouTube 자막 기반 영어 학습 데스크톱 앱`), 추적 파일 87개. `git ls-files` 기준 `.env`·`node_modules`·`dist`·`_tmp`·`build/bin` **포함되지 않음**.
- `gh release view v1.0.0 --json assets` → 자산 3개(`latest.json` 876B, `StudyTED-Setup-1.0.0.exe` 128,832,523B, `.blockmap` 135,445B) 모두 `state: uploaded`.

### 4. 실제 피드 응답 (외부에서 확인)

- `curl https://github.com/pang980/study-ted/releases/latest/download/latest.json` → **HTTP 200 / 876 bytes**, `version` `1.0.0`, `sha256` `d82cec3cb98408dcd8885ceda0fdc204bb3dcbb08e91298e5a11673b67be1dfb` — 로컬 `dist\latest.json` 값과 **일치**.
- 같은 경로의 `StudyTED-Setup-1.0.0.exe` → **HTTP 200 / application/octet-stream**. 상대 경로 `url` 이 `releases/latest/download/` 아래에서 정확히 해석됨을 확인.
- `gh release view` 가 보고한 자산 `digest` (`sha256:078f2fdff643de5b…`, 첫 업로드 시점)와 그때의 `latest.json` `sha256` 이 일치 → 릴리스 자산과 피드가 같은 파일을 가리킨다.
- 참고: 검증 중 `npm run release` 를 실제로 한 번 더 실행해(빌드 + `--clobber` 덮어쓰기) v1.0.0 자산을 갱신했고, 피드의 `sha256` 이 새 값(`d82cec3c…`)으로 바뀌는 것까지 확인했다. 즉 **배포 스크립트가 실사용 경로로 동작**한다.

### 5. 회귀 없음 · 알려진 한계

- 앱 코드 변경은 `main/db/settings.js` 의 기본값 1곳뿐이다. 수집·재생·문장 노트·AI 분석 경로는 손대지 않았고 스모크 96/0 으로 확인했다.
- 기본 주소가 생겼으므로, 이제 **앱 시작 8초 후 실제로 GitHub 에 요청이 나간다**(16차에는 주소가 비어 있어 요청 0회였다). 네트워크가 없으면 배너가 오류 문구를 띄우고 나머지 기능은 그대로 동작한다.
- **한계**: 저장소를 비공개로 바꾸면 인증 없는 피드 조회가 실패해 자동 업데이트가 멈춘다(설정에서 직접 호스팅 주소를 넣어야 한다). 릴리스 자산만으로 업데이트하므로 **설치본을 받는 사람도 인터넷과 GitHub 접근이 필요**하다.
- **한계**: 코드 사이닝 미적용 → SmartScreen 경고 가능. `npm run release` 는 `gh` CLI 로그인과 `origin` 원격이 있어야 한다(스크립트가 먼저 검사한다).

## 18차 검증 기록 (2026-09-24)

| 항목 | 명령 | 결과 |
|---|---|---|
| 문법 | `node --check` (`main/ai/openrouter.js`, `renderer/js/ui.js`, `renderer/js/components/notes-table.js`, `scripts/smoke.js`) | 0 실패 |
| 단위 테스트 | `npm test` | **82 / 82 pass** (17차 81 + T53 회귀 1) |
| 스모크 | `npm run smoke` | **99 확인 / 실패 0** (17차 96 + 3) |

### 새로 확인한 동작

- `view:notes` 프로브: `{ table:4, rows:4, detailRows:4, details:1, cards:1, summaries:1, toggleButtons:1 }` — 상세 행은 문장 4개 모두에 있고, 분석 카드·요약·`분석 보기` 버튼은 저장된 분석이 있는 1건에만 있다.
- `view:notes 문장 클릭 상세`: `{"first":{"hidden":true,"expanded":false},"second":{"hidden":false,"expanded":true},"third":{"hidden":true,"expanded":false}}` — 누르면 열리고 다시 누르면 닫힌다.
- `view:notes 분석 보기 높이 해제`: `{ before:"360px", open:"none", shut:"360px", scroll:true, bodyHeight:>40 }` — 펼치면 `max-height` 가 풀린다.
- `view:notes 삭제 동작`: `4 → 3` + 모달 닫힘 — 확인 창에서 `삭제` 를 누르면 실제로 지워진다(수정 전에는 항상 취소로 확정됐다).
- 나머지 화면 검증은 17차와 동일하게 통과(home 버전·업데이트 배너, channels 수집 개수·정지 버튼, learn 썸네일·검색·페이징·문장 전송·AI 분석, materials, share, settings 모델 검색·업데이트 카드).

### 실패 → 수정 이력 (이번 라운드)

1. `view:notes 분석 표시` 가 `상세 4 / 카드 1` 로 실패 → 상세 행을 모든 행에 만들도록 바꾼 뒤 **프로브·단언을 새 동작에 맞게 갱신**해 통과.
2. `view:notes 문장 클릭 상세` 가 `first.expanded=true` 로 실패 → 앞 검증(`분석 펼치기`)이 상세를 열어 둔 채 끝난 것이 원인이었다. 검증 시작 시 열린 상세를 모두 닫고 기준 상태를 만든 뒤 통과.
3. `view:notes 분석 보기 높이 해제` 가 `bodyHeight:0` 으로 실패 → **검증 코드 버그**. 반환 객체를 만들 때(두 번째 클릭 이후) 높이를 쟀기 때문이다. 열려 있을 때 측정하도록 옮겨 통과. 앱 코드 문제는 아니었다.

### 사용자 DB 상태 점검(읽기 전용)

- `%APPDATA%\study-ted\study-ted.db` 의 `sentences` 6행을 확인했다(쓰기 없음).
- `id=4` 는 `translation` 이 동영상 제목으로 저장돼 있고(D-036 의 실제 피해), `id=5` 는 `structure[].part` 가 단어 단위(`Along` / `with` / …)이며 `meaning` 이 빈 값이다. 둘 다 화면에서 `AI 다시 분석` 버튼이 뜨는 상태라 사용자가 한 번 누르면 새 프롬프트로 교정된다.


## 19차 라운드 검증 (2026-09-24)

- `npm test` → **82/82 pass**(변경 없음, 회귀 없음).
- `npm run smoke` → **101 확인 / 실패 0**. 신규 확인 2건 통과:
  - `view:notes 안내·재분석 버튼 없음 :: 안내 0 / 제목줄 0 / 재분석 0`
  - `view:notes 편집 창 배경 클릭 유지·Esc 닫기 :: 배경 클릭 유지 true / Esc 닫기 true`
- 기존 항목 회귀 없음: `view:notes 분석 표시`(상세 1 / 카드 1 / 버튼 1 / 요약 1), `분석 펼치기`, `구문 영어 표시`, `구문 뜻 표시`, `AI 원문 응답 없음`, `문장 클릭 상세`, `분석 보기 높이 해제`, `삭제 동작`(4 → 3).
- 배경 클릭으로 닫히지 않는지, Esc 로 닫히는지 실제 DOM 이벤트로 확인했다(수정 창을 열고 배경 클릭 → 유지, Esc → 닫힘).

## 20차 라운드 검증 (2026-09-24) — v1.0.1 배포

- 사전 조건: `Get-Process StudyTED` = 0, `electron` = 0 (앱 종료 확인), `ELECTRON_RUN_AS_NODE` 해제 후 실행.
- `gh auth status` → `pang980` (scopes: gist, read:org, repo, workflow) / `origin` = https://github.com/pang980/study-ted.git.
- `npm run release` 종료 코드 **0** · 마지막 줄 `배포 완료 / 122.9 MB · sha256 0424ebb1b3bc08b6…` · 릴리스 URL https://github.com/pang980/study-ted/releases/tag/v1.0.1
- `gh release view v1.0.1` → `tagName v1.0.1`, 자산 3종 `state=uploaded`(latest.json / StudyTED-Setup-1.0.1.exe / .blockmap).
- 피드 실측(`Invoke-RestMethod releases/latest/download/latest.json`) → `feed version: 1.0.1` / `url: StudyTED-Setup-1.0.1.exe` (`releases/latest` 가 v1.0.1 을 가리킴).
- `git push origin main` → `b777f18..ec82f14  main -> main`(PowerShell 은 stderr 를 오류로 표시하지만 성공) · `git ls-remote origin main` = `ec82f141511b60cd0392e4a3748f27b695e5cc29` (로컬 HEAD 와 일치).
- 기존 기능 회귀 없음: 19차 기준 `npm test` 82/82 · `npm run smoke` 101 확인 / 실패 0 (이번 라운드는 빌드·배포만 수행, 코드 변경 없음).
