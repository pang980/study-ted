# File Map

이 문서에 없는 파일은 수정하지 않는다. 새 파일이 필요하면 이 문서를 먼저 갱신한다.

## 생성 파일

### 루트

| 경로 | 역할 |
|---|---|
| `package.json` | Electron 실행 스크립트(`start`/`dev`/`demo`/`test`/`smoke`/`e2e`/`e2e:player`) 및 devDependency |
| `.editorconfig` | UTF-8 / LF / 2 space |
| `.gitattributes` | 텍스트 EOL 고정, 바이너리 지정 |
| `.gitignore` | `node_modules/`, `_tmp/`, 로그 제외 |
| `README.md` | 설치·실행·기능·문제 해결 안내 |

### main (Electron 메인 프로세스)

| 경로 | 역할 |
|---|---|
| `main/main.js` | 앱 생명주기, BrowserWindow, 렌더러 loopback HTTP 서버(127.0.0.1), CSP, 메뉴, 외부링크 차단 |
| `main/preload.js` | `contextBridge` 로 노출하는 화이트리스트 API |
| `main/ipc.js` | IPC 채널 등록 (`invoke` 만 사용) |
| `main/paths.js` | userData 경로, DB 경로, 폴더 열기 |
| `main/logger.js` | 파일 로그 (userData/logs/app.log) |
| `main/demo-data.js` | 데모 시딩(UI.png 목업 데이터) |

### main/db

| 경로 | 역할 |
|---|---|
| `main/db/index.js` | `node:sqlite` 연결, 마이그레이션 실행, 트랜잭션 헬퍼 |
| `main/db/schema.js` | 테이블 DDL 및 마이그레이션 목록 |
| `main/db/channels.js` | 채널 CRUD |
| `main/db/videos.js` | 동영상 CRUD |
| `main/db/transcripts.js` | 자막 저장/조회 |
| `main/db/sentences.js` | 문장 노트 CRUD, 검색·필터·집계 |
| `main/db/settings.js` | 설정 + 비밀값 암호화 저장 |

### main/collect

| 경로 | 역할 |
|---|---|
| `main/collect/index.js` | 수집 오케스트레이션, provider 선택, 진행 이벤트 |
| `main/collect/job-registry.js` | 수집 작업(jobId) 취소 플래그 + AbortController, 취소 오류 생성 |
| `main/collect/net.js` | HTTP fetch, JSON 블록 추출, 지연·재시도 |
| `main/collect/subtitle-parser.js` | json3 / vtt / srt / xml(srv3) / 평문 → 세그먼트 변환 |
| `main/collect/ytdlp-manager.js` | yt-dlp 탐지 / 다운로드 / 버전 확인 |
| `main/collect/ytdlp-provider.js` | yt-dlp 기반 목록·메타·자막 |
| `main/collect/native-provider.js` | HTML·Innertube 기반 채널·영상·자막 트랙 |

### main/ai

| 경로 | 역할 |
|---|---|
| `main/ai/openrouter.js` | 모델 목록, 채팅 호출, 구문분석 프롬프트/응답 정규화 |

### main 기타

| 경로 | 역할 |
|---|---|
| `main/share.js` | JSON / Markdown / HTML 내보내기, JSON 가져오기 |

### renderer

| 경로 | 역할 |
|---|---|
| `renderer/index.html` | 앱 셸 (타이틀바·사이드바·뷰 컨테이너) |
| `renderer/css/tokens.css` | 색상·간격·타이포 토큰 (UI.png 픽셀 샘플 기반) |
| `renderer/css/base.css` | 리셋, 타이포, 스크롤바 |
| `renderer/css/layout.css` | 타이틀바, 사이드바, 그리드 |
| `renderer/css/components.css` | 버튼·입력·카드·탭·테이블·모달·토스트 |
| `renderer/css/views.css` | 뷰별 배치 |
| `renderer/js/app.js` | 부트스트랩, 라우터, 전역 단축키 |
| `renderer/js/api.js` | `window.studyTed` 래퍼 + 오류 정규화 |
| `renderer/js/state.js` | 앱 상태 저장소(구독) |
| `renderer/js/ui.js` | DOM 헬퍼, 토스트, 모달, 포맷터 |
| `renderer/js/player.js` | YouTube IFrame API 래퍼 (모드 전환·시킹·시간 폴링) |
| `renderer/js/components/transcript.js` | 전체 자막 패널 (하이라이트·자동 스크롤·문장 선택) |
| `renderer/js/components/sentence-panel.js` | 선택 문장 저장 + AI 구문분석 + 수동 입력 |
| `renderer/js/components/notes-table.js` | 학습한 문장 목록 테이블 |
| `renderer/js/components/study-workspace.js` | 플레이어 + 자막 + 문장 패널 조합(홈/학습하기 공용) |
| `renderer/js/views/home.js` | 채널 입력 + 채널 카드 + 영상 그리드 + 워크스페이스 + 문장 목록 |
| `renderer/js/views/channels.js` | 채널 관리 |
| `renderer/js/views/learn.js` | 학습하기 (채널/영상 선택 + 워크스페이스) |
| `renderer/js/views/notes.js` | 문장 노트 |
| `renderer/js/views/materials.js` | 학습 자료 (영상·채널별 묶음) |
| `renderer/js/views/share.js` | 공유하기 (내보내기/가져오기) |
| `renderer/js/views/settings.js` | 설정 (키·모델·yt-dlp·데이터) |

### scripts / test

| 경로 | 역할 |
|---|---|
| `scripts/smoke.js` | Electron 부팅 스모크 + 스크린샷 저장 |
| `scripts/e2e-collect.js` | 실제 채널 수집 E2E (`--url=` / `--limit=` / `--native` / `--fresh` / `--cancel-after=<ms>` / `--cancel-limit=<n>`, `_tmp/e2e-userdata` 사용) |
| `scripts/e2e-player.js` | 실제 YouTube 영상 임베드 재생 E2E (`--video=`, `_tmp/e2e-player-userdata` 사용) |
| `test/subtitle-parser.test.js` | 자막 파서 단위 테스트 |
| `test/db.test.js` | DB 스키마·쿼리 단위 테스트 |
| `test/collect-parse.test.js` | YouTube 응답 파싱 단위 테스트 |
| `test/collect-cancel.test.js` | 수집 취소 단위 테스트 (job-registry / net / yt-dlp 자식 프로세스) |
| `test/ai-parse.test.js` | AI 응답 정규화 단위 테스트 |

### rules / _workspace

| 경로 | 역할 |
|---|---|
| `rules/file-edit-rules.md` | 파일 수정 규칙 |
| `rules/coding-rules.md` | 코딩 규칙 |
| `rules/validation-rules.md` | 검증 규칙 |
| `_workspace/*.md` | 하네스 산출물 |

## 수정 파일 (기존 존재)

3차 라운드(실제 채널 E2E 검증)에서 아래 파일을 최소 범위로 수정했다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `main/collect/native-provider.js` | `extractVideoEntries` 의 두 항목 생성 지점에 `url` 추가 | 채널 목록 응답에 URL 이 없어 DB 저장(NOT NULL)이 실패했다 |
| `main/collect/index.js` | `resolveProvider` 구조 분해를 `ytdlp: ytdlpInfo` 로 분리, `syncChannel` 에 `title`/`url` 폴백 추가 | 지역 변수가 provider 모듈을 가리는 버그 + 저장 실패 방어 |
| `main/db/videos.js` | `upsert` 의 `title`/`url` 바인딩을 `?? null` 로 방어 | 다른 컬럼과 동일한 방어 수준 유지 |
| `test/collect-parse.test.js` | `extractVideoEntries` 기대값에 `url` 추가 | 위 스펙 변경 반영(기준 완화 아님) |
| `README.md` | 최초 작성 | 파일 맵에 있으나 누락되어 있던 필수 문서 |

## 4차 라운드 수정 파일 (기존 존재)

사용자 피드백 3건(메타 갱신 옵션 / 동영상 선택 목록 가독성 / 재생 실패 오류)을 최소 범위로 수정했다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `main/main.js` | 커스텀 스킴(`protocol`/`net`/`registerSchemesAsPrivileged`) 제거 → loopback HTTP 서버(`serveAsset`, `startStaticServer`, `closeStaticServer`, Host 헤더 403 가드)로 교체. `constants.ORIGIN`/`HOME_URL` 을 listen 후 주입 | 커스텀 스킴 요청에는 Referer 가 실리지 않아 YouTube 임베드가 error 153 으로 재생을 거부했다 |
| `renderer/index.html` | 메타 CSP 에서 `app:` 제거 | 위 서빙 방식 변경 반영 |
| `renderer/js/player.js` | `describePlayerError(code)` / `isVideoError(code)` 추가 | 재생 실패를 코드별 메시지로 구분 |
| `renderer/js/components/study-workspace.js` | 재생 오류 시 코드별 메시지 + 데모 안내, 토스트 7초 | 오해 소지가 있던 "네트워크 상태를 확인해 주세요" 단일 문구 제거 |
| `main/db/settings.js` | `collect.refreshExisting` 기본값 `1`, `publicSettings().refreshExisting` 노출 | 신규 설정 |
| `main/ipc.js` | `settings:update` 에 `refreshExisting` 저장 분기 | 신규 설정 |
| `main/db/videos.js` | `upsert(video, { refresh = true })` — `refresh=false` 이면 `DO NOTHING` | 기존 영상 메타 갱신 건너뛰기 |
| `main/collect/index.js` | `refreshExisting` 옵션 해석, `addedCount`/`keptCount` 집계, 진행 메시지·반환값 확장 | 위 옵션의 동작·표시 |
| `renderer/js/views/settings.js` | `refreshExisting` 체크박스 + 설명 + 저장 | 위 옵션의 UI |
| `renderer/js/views/learn.js` | 선택 항목을 `thumb()` + 제목/메타 본문 구조로 변경 | 썸네일·제목 가독성 |
| `renderer/css/views.css` | `.picker-item` 96px 썸네일 그리드, 제목/메타 2줄 클램프, 좁은 화면 미디어 쿼리 | 위 레이아웃 |
| `test/db.test.js` | `refresh=false` 스킵 + 설정 기본값 검증 추가 | 회귀 방지 |
| `scripts/smoke.js` | 학습 화면 썸네일 확인, `refreshExisting` 저장 확인 추가 | 회귀 방지 |
| `scripts/e2e-collect.js` | 재수집 시 `refreshExisting=false` 검증 단계 추가 | 회귀 방지 |
| `scripts/e2e-player.js` | 신규: 실제 영상 임베드 재생 E2E | 위 오류 재발 방지 |

## 5차 라운드 수정 파일 (기존 존재)

사용자 피드백 4건(검은 레이어 / 24개 제한 / 채널별 수집 버튼 / 전체 수집 버튼)을 최소 범위로 수정했다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `renderer/css/views.css` | `.player-frame > div` 를 `.player-frame > .player-host` / `.player-frame > .player-note` 로 좁힘. `.player-caption` 에 `width/height:auto`, `max-height:60%`, `overflow:hidden`, 배경 `0.72 → 0.62` | 자막 오버레이가 프레임 전체를 덮는 검은 반투명 레이어가 되던 문제(T30) |
| `main/collect/index.js` | `resolveLimit(raw)` 추가(무제한은 `Infinity`), `collectAll` 로 기본 상한 해제, `limitTotal` 로 진행 `total` 계산, 반환/export 확장 | 채널 전체 수집(T29) |
| `main/collect/ytdlp-provider.js` | `bounded` 판정 후 무제한이면 `--playlist-end` 생략, 타임아웃 30분(유한 5분), `onLine` 진행 카운트, `slice` 는 유한할 때만 | 위 |
| `main/collect/native-provider.js` | 무제한이면 `max = Infinity`, 페이지 상한 6 → 150, 진행 `total` 0 | 위 |
| `main/db/settings.js` | `collect.collectAll` 기본값 `1`, `publicSettings().collectAll` 노출 | 위 |
| `main/ipc.js` | `collectLimit` 에 `'all'`/`0` 허용, `collectAll` 저장 분기, `channels:sync` 가 `collectAll`/`refreshExisting` 전달 | 위 |
| `renderer/js/actions.js` | `resolveCollectLimit()` 추가(`'all'` 또는 숫자), `syncFromUrl` 이 이 값을 전달 | 위 |
| `renderer/js/views/settings.js` | **채널 전체 수집** 체크박스 + 안내 + 저장, 전체 수집이면 개수 입력 비활성 | 위 설정 UI |
| `renderer/js/views/channels.js` | 채널 행 **수집** 버튼, 헤더 **전체 채널 수집** 버튼, 순차 수집 큐와 행별 상태·진행 바, 수집 중 버튼 잠금 | T31 |

## 6차 라운드 수정 파일 (기존 존재)

사용자 피드백 3건(채널별 수집 개수 표시 / 자막 줄 "문장 전송" 버튼 / 줄 클릭 재생)을 최소 범위로 수정했다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `main/db/channels.js` | `COLUMNS` 에 `savedVideoCount`/`savedTranscriptCount`/`savedSentenceCount` 상관 서브쿼리 추가 | 채널별 수집 개수(T32). `list()`·`getByPk()`·`getByChannelId()`·`touchSync()` 가 같은 컬럼을 함께 돌려주므로 `main/ipc.js` 는 수정하지 않았다 |
| `renderer/js/views/channels.js` | `channelRow()` 에 `수집 동영상 N개 · 자막 N개 · 저장 문장 N개`(`.channel-counts`) 추가, `renderList` 갱신 필드에 개수 3개 포함 | T32 |
| `renderer/js/components/transcript.js` | 옵션 `onSend` 추가, 각 줄에 `문장 전송` 버튼(`transcript-line__send`, `stopPropagation`), 안내 문구 갱신 | T33 |
| `renderer/js/components/study-workspace.js` | `TranscriptPanel` 배선(`onSeek`→`replayFrom`, `onSend`→`sendSentence`), `sendSentence()`·`replayFrom()`·`selectSentence(text, startSec, {focus})` 추가 | T33 |
| `renderer/css/views.css` | `.transcript-line__text`(flex:1), `.transcript-line__send`(소형 버튼, hover/활성 시 불투명), `.channel-counts`(muted, tabular-nums) | T32/T33 레이아웃 |
| `test/db.test.js` | 채널 개수 컬럼 단위 검증 4건 추가(영상/자막/문장 삽입 후 개수) | T32 회귀 방지 |
| `scripts/smoke.js` | 채널 개수 표시·전송 버튼 개수/배치/동작·줄 클릭 재생 추적 검증 추가 | T32/T33 회귀 방지 |


## 7차 라운드 수정 파일 (기존 존재)

사용자 요청 2건(모델 가격 표시 / 가성비 추천 + 모델 검색)을 최소 범위로 수정했다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `main/ai/openrouter.js` | 가격 파생 함수(`pricePerToken`/`pricePerMillion`/`formatUsd`/`formatRate`/`priceParts`/`priceLabel`/`priceShort`/`priceScore`), 정렬·검색(`rankModels`/`filterModels`/`searchTextOf`), `decorateModels(raw)` 추가. `listModels` 는 `decorateModels` 를 거친 목록을 캐시·반환하고 export 를 늘렸다 | T34/T35 계산은 한 곳에서만. IPC 응답 모양은 그대로 두고 필드만 추가 |
| `renderer/js/views/settings.js` | `optionText`·`modelRow`·`filterModels` 헬퍼, `renderList`/`listSignature`/`modelQuery`/`lastState` 상태, 검색 입력 리스너, 가성비 추천(`.model-list--value`)·검색 목록(`.model-list--all`) 렌더 | T34/T35 UI |
| `renderer/css/views.css` | `.model-list`/`.model-list--all`/`.model-row--pick`/`.model-row--on`/`.model-row__badge`/`.model-row__price`/`.model-row__meta` 추가 | 목록 행 클릭·순위 뱃지·가격 정렬. 색은 `tokens.css` 변수만 사용 |
| `test/ai-parse.test.js` | 가격 표기(무료/가격 미정/단가), 가중 평균 점수, 가성비 정렬, 이름·ID 검색, `decorateModels` 순위 부여 5건 추가 | T34/T35 회귀 방지 |
| `scripts/smoke.js` | `VIEW_PROBES.settings` 에 `modelSearch`/`valueList`/`modelRows` 추가 + `view:settings 모델 검색/가성비 추천` 항목 | 키가 없어 목록이 비어도 두 영역이 자리를 잡는지 확인 |
| `README.md` | 설정 항목 8번(모델)에 가격 표시·가성비 추천·검색 반영 | 문서 동기화 |

수정하지 않은 파일: `main/ipc.js`(응답 모양 유지), `main/preload.js`, `renderer/js/api.js`, `renderer/js/actions.js`(모델 목록은 이미 `state.models` 로 전달됨).

## 8차 라운드 수정 파일 (신규 1개 + 기존 8개)

사용자 요청 1건(수집 중 정지)을 최소 범위로 수정했다. 취소 로직은 새 모듈 한 곳에 모으고, 나머지는 signal 전달과 UI 배선만 손댔다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `main/collect/job-registry.js` (신규) | `begin`/`end`/`cancel`/`isCancelled`/`signalOf`/`assertNotCancelled`/`activeCount`/`makeError` — jobId 단위 취소 플래그 + AbortController | 취소 상태를 여러 모듈에 흩지 않고 한 곳에서 관리 (T36) |
| `main/collect/index.js` | `syncChannel` 을 래퍼로 바꾸고 `runSyncChannel(options, partial, signal)` 에 위임. 자막 루프를 인덱스 `for` 로 바꿔 매 반복 `assertNotCancelled` + 50개마다 진행 emit. 취소 시 `partial.cancelled=true` · `phase:'cancelled'` · `error.detail` 보존 · `finally` 정리 | 루프 경계 검사 + 취소 결과 보존 (T36) |
| `main/collect/net.js` | `fetchText(url, { signal })`, `cancelledError()` 신설. 진입 시 `signal.aborted` 즉시 throw, 외부 signal → 내부 controller 브리지, abort 시 재시도 금지, `finally` 에서 리스너 제거 | 진행 중 네트워크 요청 즉시 중단 (T36) |
| `main/collect/ytdlp-manager.js` | `run` 의 `signal` 경로가 `child.kill()` 로 이어지고 `code='CANCELLED'` 반환 | 자막 1건이 150초 걸려도 즉시 중단 (T36) |
| `main/collect/ytdlp-provider.js` | `listVideos`/`getVideo` 에 `signal` 옵션 추가 → `manager.run(..., { signal })` | 호출부 dead code 제거 (T36) |
| `main/collect/native-provider.js` | `resolveChannel`/`innertubeKey`/`browse`/`listVideos`/`getVideo`/`fetchCaptionBody`/`getTranscript` 에 `signal` 배선 | 위와 동일 (T36) |
| `renderer/js/views/channels.js` | 진행 바 옆 `cancelInline`("수집 정지", `.btn--sm.btn--danger`) 추가, `paintCancelButtons(busy)` 로 버튼 상태·문구 통합, `requestCancel()` 비동기 처리 + `cancelling` 플래그 | 정지 버튼 UI (T37) |
| `test/collect-cancel.test.js` (신규) | 6건 — registry begin/cancel/end, 선취소 job 즉시 abort, `net.fetchText` 취소(사전 abort + 진행 중 abort + 재시도 없음), 비취소 재시도 유지, `manager.run` 취소 시 자식 프로세스 kill(<20s), 이미 취소된 신호 | 회귀 방지 (T37) |
| `scripts/smoke.js` | channels 프로브에 `stopButtons` 추가 + `view:channels 정지 버튼` 확인 항목 | 정지 버튼 회귀 방지 (T37) |
| `scripts/e2e-collect.js` | `--fresh` / `--cancel-after=<ms>` / `--cancel-limit=<n>` 옵션, `verifyCancel()` 로 취소 즉시성·부분 결과 보존 3항목 확인 | 실제 취소 동작 검증 (T37) |
| `README.md` | 수집 범위 안내에 **수집 정지** 버튼과 부분 결과 보존 설명 추가 | 문서 동기화 |

수정하지 않은 파일: `main/preload.js`, `main/ipc.js`(`collect:cancel` 이 이미 전역 처리), `renderer/js/api.js`, `renderer/js/actions.js`(취소 배선 기존 유지).
## 9차 라운드 수정 파일 (신규 1개 + 기존 5개)

사용자 피드백 2건(자막 수집 속도 · 내부 상태 카드)을 최소 범위로 수정했다. 취소 계약(8차)은 그대로 재사용하고 수집 단계의 실행 방식만 바꿨다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `main/collect/ytdlp-provider.js` | `LANG_ATTEMPTS = ['en', 'en.*,en']` + `downloadSubtitleFiles()` 분리. 파일이 하나도 안 생기면 넓은 패턴으로 **1회만** 재시도, `kind` 는 `'asr'` 대신 `null` | 편당 2~3개 받던 자막 파일을 1개로 (T38) |
| `main/collect/index.js` | `videoDir()`/`clearVideoDir()` 로 편 단위 임시 폴더, `DEFAULT_SUBTITLE_CONCURRENCY = 4` + `resolveConcurrency()`, `collectSubtitles(context)` 워커 풀, `runSyncChannel` 의 자막 `for` 루프 대체, `concurrency` export | 순차 → 동시 수집 (T38) |
| `main/db/settings.js` | `'collect.concurrency': '4'` 기본값 + `publicSettings().concurrency` | 설정 영속화 (T38) |
| `main/ipc.js` | `settings:save` 에서 `requireInt(payload.concurrency, '동시 수집 개수', { min:1, max:8 })`, `collect:sync` payload 에 `concurrency` 전달 | 입력 검증 (T38) |
| `renderer/js/views/settings.js` | 수집 설정에 `concurrencyInput` + `적용` 버튼, 하이드레이션 | 동시 개수 UI (T38) |
| `renderer/js/views/channels.js` | `statusCard.hidden = true` 기본, `refreshStatus()` 끝에서 ytdlp 미사용 시에만 표시 | 진단 카드 숨김 (T39) |
| `test/collect-subtitles.test.js` (신규) | 5건 — 동시 개수 상한, 동시 실행, 동시 1이면 순차, 기존 자막 재사용, 동시 수집 중 즉시 정지 + 받은 자막 보존 | 회귀 방지 (T38) |

수정하지 않은 파일: `main/preload.js`, `main/collect/job-registry.js`(취소 계약 재사용), `renderer/js/actions.js`, `renderer/js/api.js`.

## 10차 라운드 수정 파일 (기존 4개)

사용자 피드백 2건(문장 전송이 기존 입력을 덮어씀 · 저장 없이 AI 분석)을 최소 범위로 수정했다. 스키마·IPC 계약은 바뀌지 않았다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `renderer/js/components/sentence-panel.js` | `MAX_ANALYZE_LINES = 5` + `normalizeLine()`, `startSecs` 맵, `appendSentence()`·`getSentences()`·`removeSentences()`·`startSecFor()` 신설, `setBusy(busy, total, step)`, `save()` 문장별 루프 + 문장별 `startSec`, `analyze()` 결과 즉시 표시 + 저장된 문장 입력칸에서 제거 | 문장 누적 (T40) · AI 즉시 저장 (T41) |
| `renderer/js/actions.js` | `analyzeAndSaveSentence()` 신설 — `api.ai.analyze` → `api.sentences.create({ source:'ai', analysis, startSec, 영상 메타 })` → `loadSentences()`/`loadInfo()` → `{ ...result, saved }` 반환. 기존 `analyzeSentence` 는 그대로 유지 | 저장 없는 AI 분석 (T41) |
| `renderer/js/components/study-workspace.js` | `selectSentence()`/`sendSentence()` 가 `appendSentence()` 사용(덮어쓰기 제거, 중복 시 `이미 문장 패널에 있는 문장입니다.`), `saveSentence()` 의 `startSec` 전역 폴백 제거(문장별 시각 보존), `analyzeSentence()` → `analyzeAndSaveSentence` 로 교체 | 누적 전송 + AI 배선 (T40~T41) |
| `scripts/smoke.js` | `view:learn 문장 누적 전송`·`중복 문장 무시`·`AI 분석 즉시 저장`·`AI 분석 결과 표시` 4항목 추가 | 회귀 방지 (T40~T41) |

수정하지 않은 파일: `main/ipc.js`(`sentences:create` 가 이미 `source:'ai'`·`analysis`·`startSec` 지원), `main/db/*`(스키마 변경 없음), `renderer/js/views/notes.js`(기존 목록 갱신 경로 사용).

## 스크래치 (산출물 아님)

| 경로 | 내용 |
|---|---|
| `_tmp/**` | 검증용 프로브 스크립트·스크린샷·임시 userData. 최종 산출물이 아니며 라운드 종료 시 정리한다. |

## 읽기 전용 파일

| 경로 | 이유 |
|---|---|
| `AGENTS.md` | 하네스 규칙 원본. 이번 라운드에서 변경하지 않는다 |
| `skills/harness/SKILL.md` | 스킬 원본 |
| `UI.png` | UI 기준 이미지 |
| `유튜브 동영상을 활용해서 영어 공부하는 프로그램을 제작할꺼야..txt` | 사용자 원본 요청 |

## 수정 금지 파일

| 경로 | 이유 |
|---|---|
| `.env` | 비밀값. 읽지도, 출력하지도, 수정하지도 않는다 |
| `node_modules/**` | 설치 산출물 |
| `_tmp/**` | 임시 스크래치 (최종 산출물 아님, 종료 시 정리) |

## 영향 범위

- 신규 파일만 생성하므로 기존 동작에 대한 회귀 영향 없음.
- 사용자 로컬 데이터는 `userData` 경로에 생성되며 프로젝트 폴더를 오염시키지 않는다.

## 11차 라운드 수정 파일 (기존 10개 + 신규 0개)

사용자 피드백 1건(동영상 선택 목록 200개 상한 → 전체 + 검색 + 페이징)을 최소 범위로 수정했다.

| 경로 | 수정 내용 | 이유 |
|---|---|---|
| `main/db/videos.js` | `escapeLike()`, `buildFilter({channelPk, q})` 신설. `list` 에 `q`/`offset` 추가, `count({channelPk, q})` 로 조건별 개수 지원(인자 없으면 기존 전체 개수) | 검색·페이징은 메인(SQLite)에서 하고, 목록과 개수가 같은 조건을 쓰도록 |
| `main/ipc.js` | `videoQuery()` 헬퍼(`channelPk`/`q`/`limit`/`offset` 검증)와 `videos:page` 핸들러 추가(`{items,total,offset,limit,hasMore}`), `videos:list` 도 같은 헬퍼 사용 | 총계·다음 페이지 여부를 렌더러가 알 수 있게 |
| `main/preload.js` | `videos.page` 브리지 추가(`list` 유지) | 위 IPC 노출 |
| `renderer/js/api.js` | `videos.page(payload)` 추가 | 위 브리지 래핑 |
| `renderer/js/state.js` | `videoPage: { q, offset, limit, total, hasMore, loading }` 추가 | 검색어/페이지 상태 보관 |
| `renderer/js/actions.js` | `VIDEO_PAGE_SIZE = 50`, `defaultVideoPage()`, `loadVideoPage()` 신설(요청 토큰으로 늦게 온 응답 무시). `loadVideos()` 는 첫 페이지 로더로 위임, `selectChannel`/`loadChannels`/`removeChannel` 은 페이지 상태 초기화 | 기존 호출부 계약 유지 + 200편 상한 제거 |
| `renderer/js/views/learn.js` | 픽커 카드에 검색 입력(디바운스 260ms·Enter 즉시), `‹ 이전 / n / 총페이지 / 다음 ›` 페이저, 카드 헤드 `전체 N개 중 i–j` 표시. 빈 결과 문구 분기 | T42 UI |
| `renderer/css/views.css` | `.picker-search`, `.picker-count`, `.picker-pager`, `.picker-pager__info` 추가 + 1360px 미디어 쿼리 보정 | 좁은 픽커 카드에서도 검색/페이저가 겹치지 않게 |
| `test/db.test.js` | 검색·페이징·LIKE 이스케이프·조건별 count 테스트 추가 | 회귀 방지 |
| `scripts/smoke.js` | `videos.page` 브리지 단계 + 기대값 5건, `view:learn 검색/페이징`·`검색/페이저 배치`·`제목 검색` 확인 추가 | 회귀 방지 |

수정하지 않은 파일: `renderer/js/views/home.js`(`state.videos` 는 "현재 페이지" 의미가 되어 최신 50편 중 앞 4편을 보여준다 — 동작 회귀 없음), `main/demo-data.js`, `renderer/js/components/**`.

## 12차 라운드 (AI 구문분석 자동저장 + 노트 노출)

| 파일 | 변경 | 이유 |
|---|---|---|
| `main/ai/openrouter.js` | `RETRY_STATUSES`·`RETRY_ATTEMPTS`·`RETRY_BASE_MS`·`RETRY_MAX_MS`, `sleep()`, `retryDelayMs()`, `httpError()`, `sendOnce()` 추가 + `request()` 재시도 루프, `module.exports` 에 `request`·`retryDelayMs` | 429/5xx/네트워크 오류로 분석이 통째로 실패해 자동저장까지 도달하지 못하던 문제 제거 |
| `renderer/js/components/analysis-card.js` | 신규. `analysisCounts`·`hasAnalysis`·`analysisSummaryText`·`renderAnalysisCard`·`renderAnalysisFailure` | 분석 카드 마크업을 문장 패널·노트·자료 목록이 공유 |
| `renderer/js/components/sentence-panel.js` | `renderAnalysis()` 가 공용 카드로 위임, `analyze()` 문장별 try/catch + `failures` 수집, `appendFailures()` | 한 문장 실패가 나머지 분석을 막지 않고, 실패를 성공처럼 보이지 않게 |
| `renderer/js/components/notes-table.js` | `분석` 컬럼(`COLUMNS` 9개), `tr.is-detail` 상세 행 + `분석 보기` 토글, `.analysis-summary` 요약 | 저장된 분석을 문장 노트에서 바로 보고 펼칠 수 있게 |
| `renderer/js/views/materials.js` | `sentenceRow()` 에 `list-block`/`list-row__detail` 상세 + 요약 pill + `분석` 토글 | 학습 자료 목록에서도 같은 분석 확인 |
| `renderer/js/actions.js` | `analyzeAndSaveSentence()` 가 저장 분석에 `model` 을 함께 기록 | 어떤 모델의 분석인지 노트에서 확인 |
| `renderer/css/views.css` | `.analysis--error`, `.data-table tbody tr.is-detail > td`, `.list-block`, `.list-row__detail` | 펼친 분석 행·실패 카드 스타일 |
| `test/ai-parse.test.js` | 재시도 5건(`fakeResponse`·`withFetch` 헬퍼) | 429·5xx 재시도, 401 즉시 실패, Retry-After 우선순위 회귀 방지 |
| `scripts/smoke.js` | `notes` 프로브 확장(상세 행·카드·요약·토글 버튼) + `view:notes 분석 표시`·`view:notes 분석 펼치기`·`view:learn AI 분석 실패 표시` | 회귀 방지 |

수정하지 않은 파일: `main/db/sentences.js`(왕복 검증 결과 정상), `main/ipc.js`(`ai:analyze` 가 `analysis` 를 그대로 반환), `main/demo-data.js`.

## 13차 라운드 (영어 필드 한국어 오염 수정 + 분석 카드 정리)

| 파일 | 변경 | 이유 |
|---|---|---|
| `main/ai/openrouter.js` | `systemPrompt` 에 `structure[].part` 영어 유지 규칙(`must stay in English`, `never put a Korean word inside it`), `userPrompt` 는 JSON 스키마를 `translation` + `structure` 두 키로 축소하고 `Language rules` 블록(“`part` MUST be English only · 문장에서 그대로 복사 · 한국어는 `translation`·`meaning`·`note` 에만”) 추가. `HANGUL_RE`·`hasHangul()`·`findLanguageMismatch()`·`languageRepairPrompt()` 신설, `analyzeSentence` 가 오염 시 교정 프롬프트로 **1회 재요청**(오염 개수가 줄 때만 채택)하고 `{ analysis, parseFailed, model, usage }` 반환. `module.exports` 에 `findLanguageMismatch`·`hasHangul`·`systemPrompt`·`userPrompt` 추가 | 소형 모델이 "설명은 한국어" 지시를 따라 영어로 나와야 할 구문(`part`)까지 한국어로 채우는 문제 제거 |
| `renderer/js/components/analysis-card.js` | `analysisCounts` → `{ structure }` 만, `hasAnalysis`·`analysisSummaryText`(`"구문 4"`) 정리. `koreanEnglishFields()` 로 렌더 시 한 번 더 검사해 `.analysis__warn` 경고 박스 표시. **주요 표현·예문 섹션 제거**, **`AI 원문 응답` 섹션 제거**(`analysis.raw` 는 DB 에 유지) → 카드는 `1. 문장 해석` + `2. 구문 분석` 만 | 구문이 한국어로 저장된 사실을 화면에서 바로 알리고, 사용자가 요청한 대로 카드를 해석·구문분석 두 항목으로 정리 |
| `renderer/js/components/sentence-panel.js` | `parseExpressionText`·`parseExampleText` 삭제, 수동 입력 모달에서 표현/예문 필드 제거, 저장 시 `analysis: structure.length \|\| translation ? { translation, structure } : null` | 더 이상 쓰지 않는 입력 경로 제거 |
| `renderer/js/components/notes-table.js` | import 를 `parseStructureText` 만 남김, 문장 수정 모달에서 표현/예문 필드 제거(예전 저장값은 `analysis.expressions`/`analysis.examples` 를 그대로 보존) | 위와 동일 |
| `renderer/css/views.css` | `.analysis__section + .analysis__section` 12→16px, `.analysis__section-title` 6→8px, `.analysis__row` `9px 0 9px 22px`·line-height 1.75·12.5px, `.analysis__translation` `6px 0 10px 22px`, `.analysis__raw` 블록 → `.analysis__warn`(노랑 배경·테두리·글자) | 답이 나오는 자리를 아래로 넓게 + 오염 경고 스타일 |
| `test/ai-parse.test.js` | 언어 검증·교정·프롬프트 규칙 4건 추가(총 61건 중 22건이 이 파일) | 회귀 방지 |
| `scripts/smoke.js` | `notes` 프로브 확장(`englishParts`·`parts`·`rawBox`·`rawTitle`)과 `view:notes 구문 영어 표시`·`view:notes AI 원문 응답 없음` 확인 추가 | 회귀 방지 |

수정하지 않은 파일: `main/share.js`(내보내기는 예전에 저장된 표현·예문도 그대로 넘긴다), `main/demo-data.js`(정상 예시 fixture), `main/db/*.js`(저장 왕복은 정상), `main/ipc.js`(`ai:analyze` 반환 계약 유지).

## 14차 라운드 (문장 노트에서 주요 표현·예문·메모·태그 제거)

| 파일 | 변경 | 이유 |
|---|---|---|
| `main/db/schema.js` | 두 번째 마이그레이션 `dropSentenceNoteAndTags` 추가(`DROP TABLE IF EXISTS sentence_tags` → `DROP TABLE IF EXISTS tags` → `ALTER TABLE sentences DROP COLUMN note`) | 사용자 요청대로 메모·태그를 DB 에서 실제로 제거. `initial` 의 CREATE 문은 이력 보존을 위해 유지 |
| `main/db/sentences.js` | 197→153행. `TAG_NAMES`·`TAG_PKS`, `COLUMNS` 의 `s.note`·태그 조인, `mapRow` 의 `tags`/`tagIds`, `create`/`update` 의 `note`·`tags`, `list` 의 `tag` 필터, `setTags`, `listTags`, `exportAll` 의 `note`/`tags` 제거 | 태그·메모를 쓰지 않으므로 조인·서브쿼리 비용과 죽은 경로를 함께 제거 |
| `main/ipc.js` | `sentences:list` 의 `tag` 인자·`tags` 반환 제거, `sentences:create`/`update` 의 `note`·`tags` 제거, `tags:list` 핸들러 삭제 | 화면에 없는 값을 IPC 계약에 남기지 않는다 |
| `main/preload.js` | `tags: { list: () => invoke('tags:list') }` 블록 삭제 | 위와 동일 |
| `renderer/js/api.js` | `tags` 네임스페이스 삭제 | 위와 동일 |
| `renderer/js/state.js` | `sentences: { items: [], total: 0 }`, `filters` 에서 `tag: ''` 제거(`q`·`channelPk`·`favoriteOnly`·`sort` 만) | 태그 필터 상태 제거 |
| `renderer/js/actions.js` | `loadSentences` payload 에서 `tag` 제거 | 위와 동일 |
| `renderer/js/components/notes-table.js` | `COLUMNS` 9→8개(`['번호','★','문장','해석','분석','출처','저장일','']`), `lastTagSignature`·`tagSelect`·`applyFilters` 의 tag 분기·`syncControls` 태그 블록·수정 모달의 메모/태그/표현/예문 필드·행의 태그 `<td>` 제거 | 표에서 `태그` 컬럼을 없애고 수정 모달도 요청대로 문장·해석·구문만 남긴다 |
| `renderer/js/components/sentence-panel.js` | 수동 입력 모달의 메모·태그 필드와 저장 payload 에서 `note`·`tags` 제거 | 수동 입력 경로에도 같은 규칙 적용("수동수정할때도 마찬가지") |
| `renderer/js/components/study-workspace.js` | `saveSentence` payload 에서 `note`·`tags` 제거 | 위와 동일 |
| `main/share.js` | JSON/Markdown/HTML/CSV 내보내기와 병합에서 태그·메모 제거, `formatAnalysis` 의 표현·예문 줄 제거, `tagsAdded`·`mergedTags` 제거 | 공유 파일에 없는 기능의 값을 싣지 않는다 |
| `renderer/js/views/share.js` | 결과 문구에서 `추가된 태그 N개 · ` 제거(`문장이 내 목록에 합쳐집니다`) | 표시 정리 |
| `main/demo-data.js` | `ANALYSIS_ROUTINE` 의 `expressions`·`examples`, 문장 시드의 `tags`, `tagId()`·`linkTag()`, `clear()` 의 tags 정리, INSERT 의 `note` 컬럼/값, 시드 루프의 `linkTag()` 제거 | 새 스키마와 데모 데이터 일치 |
| `main/ai/openrouter.js` | `normalizeAnalysis` 가 `{ translation, structure, raw }` 만 반환, `systemPrompt` 의 반환 키 설명을 `(translation, meaning, note)` 로 정리 | 더 이상 만들지 않는 표현·예문을 파싱 경로에서도 제거 |
| `test/db.test.js` | 테이블 목록에서 `tags`·`sentence_tags` 제거, CRUD/내보내기 단언에서 note·tags 제거, `update` 는 `{ translation: '다시 쓴 해석' }`, 데모 태그 단언 2건 제거 | 회귀 방지선을 새 스키마에 맞춤 |
| `test/ai-parse.test.js` | `expressions`·`examples` 키 블록 9곳 제거 | 위와 동일 |
| `scripts/smoke.js` | `sentences:list` 의 `tags`, create/update 의 `tags`, `태그 목록`·`문장 수정 태그` expect 제거(94 → 92) | 위와 동일 |

수정하지 않은 파일: `renderer/css/views.css`(`.chip-row` 는 설정·공유 화면에서도 쓰므로 유지), `renderer/js/components/analysis-card.js`(13차의 `structure[].note` 구문 설명 표시 유지), `main/db/videos.js`, `main/db/channels.js`, `main/collect/*`.

## 15차 라운드 (구문 한국어 뜻 필수 + 단어 분할 금지)

| 파일 | 변경 | 이유 |
|---|---|---|
| `main/ai/openrouter.js` | `systemPrompt` 에 한국어 `meaning`/`note` 필수 규칙, `userPrompt` 에 `structure` 3~6개·단어 분할 금지·빈 값 금지 규칙 추가. `findMissingMeaning`·`findChunkingProblem`·`analysisIssues`·`languageRepairPrompt` 신설(327·336·345·382행), `analyzeSentence` 가 이슈 발견 시 1회 교정 재요청, `normalizeAnalysis` meaning 별칭에 `뜻`·`뜻풀이` 추가, exports 4개 추가 | 뜻 빈 값·단어 분할을 프롬프트 + 응답 검증으로 막는다 |
| `renderer/js/components/analysis-card.js` | `missingMeaningFields(analysis)` export 추가(37행), 뜻 없음 경고(`.analysis__warn`) + 행 렌더링(`.analysis__meaning` 101행 / `.analysis__missing` 102행) 분기 | 화면에서도 뜻 누락을 숨기지 않고 보여 준다 |
| `renderer/css/views.css` | `.analysis__meaning`·`.analysis__missing` 스타일 추가(449~465행) | 뜻/뜻 없음 색 구분 |
| `renderer/js/actions.js` | `reanalyzeSentence(pk, { sentence, videoTitle })` 추가(263행) | 저장된 오염 분석을 다시 분석할 수 있게 |
| `renderer/js/components/notes-table.js` | `needsReanalyze` 판단(314행) + `AI 다시 분석` 버튼(330~335행) 조건부 노출 | 소급 복구 수단 제공 |
| `test/ai-parse.test.js` | 프롬프트 단언 2건, `findMissingMeaning`/별칭, 뜻 교정 2건, `findChunkingProblem` + 단어 분할 교정 1건 추가(61 → 67) | 회귀 방지선 |
| `scripts/smoke.js` | notes 프로브에 `meanings`/`missingMeanings`/`meaningOk`, 검증 `view:notes 구문 뜻 표시` 추가, `aiFlow`(601행)·`aiFail`(651행) 루프 100→240 + `waitAnalyzeButton()` 헬퍼(628~644행) | 화면 검증 + 실 AI 호출과의 경합 제거 |

수정하지 않은 파일: `main/db/*.js`(저장 왕복 정상), `main/ipc.js`(`ai:analyze` 반환 계약 유지), `main/share.js`, `main/demo-data.js`, `renderer/js/components/sentence-panel.js`(전송·누적 경로 무변경).

## 16차 라운드 (빌드 패키징 + 자동 업데이트)

### 생성 파일

| 경로 | 역할 |
|---|---|
| `main/update.js` | 피드(JSON) 기반 업데이터. 버전 비교(`parseVersion`·`isNewer`), 상태 머신(`idle/checking/current/available/downloading/ready/installing/error`), 302 추적 다운로드 + sha256 검증, 조용한 설치 스크립트(`apply-update.cmd`) 생성, 6시간 주기 자동 확인, `cleanupDownloads` |
| `renderer/js/components/update-banner.js` | 홈 상단 배너. `StudyTED v<버전>` + 상태 문구 + 진행 바 + `업데이트 내려받기`/`지금 설치하고 다시 시작`/`업데이트 확인`/`업데이트 설정` |
| `scripts/make-icon.js` | 외부 도구 없이 `build/icon.png`(256×256) 와 `build/icon.ico` 생성 (`npm run icon`) |
| `scripts/prepare-bin.js` | `_tmp/yt-dlp.exe` → `build/bin/yt-dlp.exe` 복사(같은 크기면 건너뜀, 없으면 경고 후 통과) (`npm run prepare:bin`) |
| `scripts/make-manifest.js` | `dist` 에서 `StudyTED-Setup-*.exe` 를 찾아 `dist/latest.json` 생성 (`npm run manifest`) |
| `test/update.test.js` | `parseVersion`·`isNewer` 단위 3건 |
| `test/update-feed.test.js` | 로컬 HTTP 서버 + `electron` 모듈 스텁으로 피드 확인·다운로드·검증·설치 스크립트 11건 |
| `build/icon.png`, `build/icon.ico` | 창/설치본 아이콘 (`electron-builder` `buildResources`) |
| `build/bin/yt-dlp.exe` | 설치본에 `resources/bin` 으로 실려 나가는 yt-dlp (`.gitignore` 에 `build/bin/` 추가) |

### 수정 파일

| 파일 | 변경 | 이유 |
|---|---|---|
| `package.json` | `version` 1.0.0, `author`, 스크립트 `test`/`icon`/`prepare:bin`/`manifest`/`dist`/`dist:dir` 추가, `build` 블록 신설(appId `com.studyted.desktop`, productName `StudyTED`, output `dist`, buildResources `build`, `files` 4항목, `extraResources` `build/bin`→`bin`, asar, win nsis x64 + `build/icon.ico` + `artifactName StudyTED-Setup-${version}.${ext}`, nsis 옵션 11개) | 배포 패키징 기반 |
| `.gitignore` | `build/bin/` 추가 | 17MB 바이너리는 소스에 넣지 않는다 |
| `main/main.js` | `app.setAppUserModelId('com.studyted.desktop')`, whenReady 에서 `updater.cleanupDownloads()` + `setTimeout(() => updater.autoCheck(), 8000)` | 시작 직후 자동 확인 + 이전 다운로드 정리 |
| `main/ipc.js` | `require('./update')`, `updater.onStatus()` → `update:status` 전송(94행), `settings:update` 에 `updateFeedUrl`(http/https 검증)·`updateAutoCheck`·`updateSilentInstall` 처리(155~165행), 핸들러 `update:state`/`update:check`/`update:download`/`update:install`(412~418행) | 메인에서만 외부 통신(CSP) |
| `main/preload.js` | `update: { state, check, download, install, onStatus }` 노출 | 화이트리스트 유지 |
| `main/db/settings.js` | DEFAULTS 에 `update.feedUrl`/`update.autoCheck`/`update.silentInstall`/`update.lastCheckAt`, `publicSettings()` 에 `update: { feedUrl, autoCheck, silentInstall, lastCheckAt }` | 설정 저장 |
| `main/collect/ytdlp-manager.js` | `detect()` 후보에 `process.resourcesPath/bin/yt-dlp.exe` 추가(탐색 순서: 설정 경로 → `<userData>/bin` → `<resources>/bin` → `<rootDir>/bin` → PATH) | 설치본에서 yt-dlp 탐지 |
| `renderer/js/api.js` | `update` 네임스페이스 추가 | IPC 브리지 |
| `renderer/js/state.js` | `update: null` | 상태 보관 |
| `renderer/js/actions.js` | `wireUpdateEvents()`, `loadUpdateState()`, `checkUpdate({force})`, `downloadUpdate()`, `installUpdate()` | 배너·설정 화면 공용 액션 |
| `renderer/js/app.js` | 부팅 시 `wireUpdateEvents()` + `await loadUpdateState()` | 상태 구독 |
| `renderer/js/views/home.js` | view 최상단에 `createUpdateBanner({ onOpenSettings: () => onNavigate?.('settings') })` 배치(73행) | 홈 상단 버전 표시 |
| `renderer/js/views/settings.js` | `updateCard` 추가 + element 순서 `keyCard, collectCard, modelCard, updateCard, dataCard`(185행), `현재 버전 v…` 라벨(403행), 단계별 버튼 문구 전환(438행) | 업데이트 설정 |
| `renderer/css/components.css` | `.update-banner*` (행 배치 · 버전 라벨 · 상태 문구 · 진행 바 · 버튼 묶음) | 배너 스타일 |
| `scripts/smoke.js` | home 프로브에 `view:home 버전 표시`·`view:home 업데이트 버튼`, settings 프로브에 `view:settings 업데이트 카드`(`textInput===1 && checks===2 && buttons.includes('업데이트 확인') && /현재 버전/`) | 회귀 방지선 |

## 17차 (GitHub 릴리스 배포) — 추가·수정 파일

### 추가 파일

| 파일 | 역할 |
|---|---|
| `scripts/release.js` | 배포 도우미(`npm run release`). `gh auth status`·`origin` 원격 점검 → `npm run dist` → `dist/latest.json` 버전 일치·자산 3종 존재 확인 → `gh release create`(태그가 있으면 `upload --clobber` + `edit --notes-file`) → 피드 주소 출력 |
| `build/release-notes.md` | 릴리스 설명 원문. `scripts/make-manifest.js` 가 `latest.json` 의 `notes`(2000자 상한)로 넣고, `scripts/release.js` 가 `gh release --notes-file` 로도 쓴다 |
| `.git/` | 새로 만든 로컬 저장소(`main` 브랜치, `origin` = `https://github.com/pang980/study-ted.git`) |

### 수정 파일

| 파일 | 변경 | 이유 |
|---|---|---|
| `.gitignore` | `.env`, `.env.*` 추가 | openrouter 키가 든 `.env` 가 공개 저장소로 올라가는 것을 막는다(16차까지는 `node_modules/`·`_tmp/`·`dist/`·`build/bin/`·`*.log`·`data/` 만 있었다) |
| `main/db/settings.js` | `DEFAULT_UPDATE_FEED_URL` 상수 신설 + `DEFAULTS['update.feedUrl']` 을 그 값으로 | 설치만 하면 자동 업데이트가 동작해야 한다(D-035). DB 행이 없을 때만 쓰이므로 사용자가 설정한 주소가 항상 우선한다 |
| `package.json` | 스크립트 `release` 추가 | 배포 한 줄 명령 |
| `README.md` | 명령 목록에 `npm run release`, **GitHub 릴리스로 배포 (기본 경로)** 절 신설, 주요 기능 9번에 "기본 주소 내장" 문구, 업데이트 배포 3번 단계에 기본값 안내, 폴더 구조 `scripts/` 설명에 릴리스 보조 추가 | 배포·업데이트 사용법 |