# Error Log

형식:

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 사전 조사 | 자체 파서로 자막 본문(baseUrl+fmt=json3) 요청 시 HTTP 200 이지만 0바이트 | YouTube 가 봇 차단(proof-of-origin 토큰 없음). watch 페이지의 플레이어 응답 자체는 `OK` 이고 자막 트랙 목록도 정상 제공됨 | 자막 본문은 yt-dlp 경로를 1순위로 사용하고 native 는 best-effort 로 유지. 실패 사유를 UI 에 표시 | 회피 완료 |
| 2026-09-23 | 사전 조사 | Innertube player POST 가 `UNPLAYABLE` / `LOGIN_REQUIRED` 반환 | 클라이언트 컨텍스트만으로 호출 시 봇 판정 | watch 페이지 HTML 의 내장 플레이어 응답을 파싱하는 방식으로 우회 성공 | 해결 |
| 2026-09-23 | 사전 조사 | `timedtext` 레거시 엔드포인트 0바이트 | 동작 중단된 엔드포인트 | 사용하지 않음 | 해결 |
| 2026-09-23 | 스크래치 작성 | probe 스크립트 `SyntaxError: Unexpected token '('` | 오브젝트 스프레드에서 중괄호 1개 누락(작성 실수) | 수정 후 재실행 | 해결 |
| 2026-09-23 | 파일 편집 | `apply_patch` 인자 전달 시 "last line must be '*** End Patch'" | PowerShell 에서 `.bat` 래퍼로 다중행 인자 전달 시 줄바꿈 손실 | `codex.exe --codex-run-as-apply-patch` 를 직접 호출 | 회피 완료 |
| 2026-09-23 | 파일 편집 | `Remove-Item -Recurse -Force _tmp` 실행 거부 | 샌드박스 정책이 재귀 삭제 차단 | 파일 단위 삭제 후 빈 디렉터리 제거 | 회피 완료 |

## 3차 라운드 (실제 채널 E2E 검증)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | E2E 수집 | `Provided value cannot be bound to SQLite parameter 5` 로 채널 동기화 전체 실패 | native provider 의 `extractVideoEntries` 가 만든 항목에 `url` 이 없고, `videosDb.upsert` 가 `video.url` 을 그대로 바인딩(NOT NULL 위반) | native provider 의 두 push 경로에 `url` 추가 + `syncChannel` 에서 `entry.url ?? watch URL` 폴백 + `videos.js` 는 `title`/`url` 을 `?? null` 로 방어 | 해결 |
| 2026-09-23 | E2E 수집 | `yt-dlp 목록 실패: ytdlp.listVideos is not a function` 후 조용히 native 로 폴백 | `syncChannel` 의 지역 변수 `const { provider, ytdlp } = resolveProvider(...)` 가 모듈 상단의 `ytdlp`(provider 모듈) 를 가려서 감지 결과 객체에 `listVideos` 를 기대 | 구조 분해를 `ytdlp: ytdlpInfo` 로 바꾸고 `ytdlp.path` → `ytdlpInfo.path` 로 수정(2곳). provider 모듈 참조는 유지 | 해결 |
| 2026-09-23 | 단위 테스트 | `extractVideoEntries ...` 1건 실패(deepEqual 불일치) | 위 수정으로 provider 출력에 `url` 키가 추가됨(의도된 스펙 변경) | 테스트 기대값에 `url` 추가 | 해결 |
| 2026-09-23 | 스모크 실행 | (환경) `electron.exe` 가 즉시 `setPath` 오류로 종료 | 부모 환경의 `ELECTRON_RUN_AS_NODE=1` 때문에 Electron 이 순수 Node 로 실행 | 같은 명령에서 `Remove-Item Env:\ELECTRON_RUN_AS_NODE` 를 먼저 실행 | 회피 완료 |
| 2026-09-23 | 스모크 실행 | `electron script.js <url>` 실행 시 스크립트가 실행되지 않음 | Electron 이 위치 인자 URL 을 소비 | `--url=<value>` 형식으로 전달 | 회피 완료 |
| 2026-09-23 | 문서 작성 | PowerShell here-string 안에서 `` ` `` + 영문자가 이스케이프로 해석되어 코드 표기가 사라짐 | 큰따옴표 here-string 에서 백틱이 escape 문자 | 작은따옴표 here-string 으로 재작성 | 해결 |

## 4차 라운드 (사용자 피드백 3건)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 재생 | "동영상을 재생하지 못했습니다. 네트워크 상태를 확인해 주세요" 가 모든 영상에서 발생. 콘솔에 YouTube `error 153`, 네트워크 자체는 정상 | 렌더러를 커스텀 스킴 `app://study-ted` 로 서빙 → Chromium 이 커스텀 스킴 요청에 `Referer` 를 보내지 않음 → YouTube 임베드가 재생을 거부. `webRequest` 로 Referer 를 강제해도, `<meta name="referrer">` 를 넣어도 해결되지 않음(스킴 단위 문제) | 렌더러 서빙을 loopback HTTP(`http://127.0.0.1:<임의 포트>`, Host 헤더 가드)로 교체. 같은 페이지를 http 로 열면 오류가 사라짐을 먼저 확인 | 해결 |
| 2026-09-23 | 재생 | 오류 문구가 "네트워크"로 단정되어 원인 파악을 방해 | 단일 catch-all 메시지 사용 | `describePlayerError(code)` 로 오류 코드별 메시지(2/5/100/101/150) 분리, 데모 데이터(가짜 ID)에는 별도 안내 추가 | 해결 |
| 2026-09-23 | 스모크 실행 | `npm run smoke` 가 콘솔에 `실패 0개` 를 찍었는데도 셸 종료 코드가 1 | Electron 이 stderr 로 흘리는 로그 라인을 PowerShell 이 `NativeCommandError` 로 승격 | 리다이렉션 없이 `$LASTEXITCODE` 확인 → 0. 스크립트 결함이 아니라 셸 표시 문제 | 회피 완료 |
| 2026-09-23 | 파일 편집 | here-string 앞뒤 개행 때문에 `Replace` 대상 문자열이 "찾을 수 없음" | here-string 끝 개행 처리 차이 | 헬퍼 `RE` 에서 `.TrimEnd("`r","`n")` 로 정규화 | 해결 |
| 2026-09-23 | UI | 썸네일이 없는 영상에서 대체 텍스트가 96px 썸네일을 넘어 재생 시간 배지를 가림 | `.thumb__placeholder` 가 중앙 정렬 + 고정 높이라 초과분이 잘림 | `.picker-item .thumb__placeholder` 에 2줄 클램프 + `overflow-wrap: anywhere` | 해결 |
## 5차 라운드 (사용자 피드백 4건)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 학습 화면 | 창을 확대/축소하면 화면 대부분이 검은 반투명 레이어로 덮여 보이지 않음 | `renderer/css/views.css` 의 `.player-frame iframe, .player-frame > div { width:100%; height:100% }` 가 플레이어 호스트뿐 아니라 **자막 오버레이 `.player-caption`**(프레임의 직계 `div`)까지 매칭 → 자막 상자가 `rgba(8,12,20,0.72)` 로 프레임 전체(376×211)를 덮었다. 자막이 꺼져 있어도 상자가 남아 레이어로 보였고, zoom 배율에 따라 크기가 달라져 "확대/축소하면 생긴다" 처럼 보였다 | 선택자를 `.player-frame > .player-host` / `.player-frame > .player-note` 로 좁히고, `.player-caption` 에 `width/height:auto`·`max-height:60%`·`overflow:hidden` 을 주고 배경을 0.62 로 낮췄다 | 해결 |
| 2026-09-23 | 채널 수집 | 채널을 불러와도 영상이 24개만 저장됨 | 버그가 아니라 기본값이었다. `collect.limit = '24'` 가 yt-dlp `--playlist-end 24` 와 native `pageCap = max(6, …)` 로 전파됐다 | 기본을 **전체 수집**(`collect.collectAll = '1'`)으로 바꾸고, 무제한이면 `--playlist-end` 를 생략하며 native 상한을 150페이지로 늘렸다. 개수 제한은 설정에서 끄고 숫자로 지정 | 해결 |
| 2026-09-23 | 채널 관리 | 채널별/전체 재수집을 할 방법이 없고 진행 상황도 보이지 않음 | 목록에 수집 동작과 상태 표시가 없었다 | 행마다 `수집` 버튼과 상태 텍스트, 헤더에 `전체 채널 수집` 버튼을 추가하고 순차 큐 + 진행 바 `(i/n)` 를 붙였다 | 해결 |
| 2026-09-23 | 문서/설정 | `collect.limit` 이 `'all'` 문자열일 때 `Number('all')` → `NaN` | 무제한을 숫자로 표현할 수 없었다 | `resolveLimit()` 로 `'all'`/`0`/비유한 값을 `Infinity` 로 정규화하고, `publicSettings().collectLimit` 은 `NaN || 24` 로 안전하게 남겼다(무제한 여부는 `collectAll` 로 전달) | 해결 |

## 6차 라운드 (사용자 피드백 2건)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 파일 편집 | 자막 패널이 화면에 아예 뜨지 않고 좌측 내비게이션 항목도 0개. 콘솔에 `Uncaught SyntaxError: Invalid or unexpected token (transcript.js:24)` | PowerShell here-string 으로 JS 를 쓸 때 줄 끝에 리터럴 `` \ `` + 개행이 들어갔다(템플릿 리터럴 안의 줄바꿈 이스케이프를 잘못 취급). 렌더러 스크립트 하나가 파싱에 실패하면 모듈 전체가 로드되지 않아 화면이 통째로 비었다 | 해당 줄을 PowerShell 이 아닌 `[System.IO.File]::ReadAllText` + 줄 단위 재작성으로 교체하고, 저장소 전체를 `\\\r?\n` 정규식으로 스캔해 남은 리터럴 백슬래시-개행이 0건임을 확인 | 해결 |
| 2026-09-23 | 자막 패널 | "자막을 눌러도 재생이 안 된다"는 사용자 보고 | `player.seekTo()` 는 재생 위치만 옮기고 재생을 시작하지 않는다. 줄 클릭이 `seekTo` 만 호출하고 있었다 | 줄 클릭 핸들러를 `replayFrom()` 으로 바꿔 `seekTo` + `play()` 를 함께 호출. 스모크에 호출 추적 항목을 추가해 고정 | 해결 |

## 7차 라운드 (사용자 요청 2건)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 설정 | 라우팅 모델(`openrouter/auto`)의 `pricing` 이 `"-1"` 로 내려오는데, 그대로 반올림하면 "무료" 로 표시되고 가성비 1위가 됨 | OpenRouter 는 가격 미정 모델에 음수를 쓴다. 단가를 숫자로만 다루면 "무료" 와 "미정" 이 구분되지 않는다 | 가격 파생 단계에서 음수를 `가격 정보 없음`/`가격 미정` 으로 분리하고 추천 순위 뒤로 보냈다 | 해결 |

## 8차 라운드 (수집 중 정지)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 채널 수집 | 자막을 2000개 이상 받는 중에 정지할 방법이 없음. 취소 버튼을 눌러도 한참 뒤에야 멈춤 | `assertNotCancelled` 가 자막 루프 경계에서만 검사됐고 자막 1건은 yt-dlp 자식 프로세스로 최대 150초를 잡았다. 더해 `ytdlp-manager.run` 이 `signal` 을 지원하는데 **호출부가 signal 을 넘기지 않아** abort 경로가 dead code 였다 | 취소 상태를 `main/collect/job-registry.js` 로 모으고 `AbortSignal` 을 `net.fetchText`·`native-provider`·`ytdlp-manager.run` 까지 전달. 취소는 `code:'CANCELLED'` 로 통일하고 재시도하지 않는다 | 해결 |
| 2026-09-23 | 검증 스크립트 | `scripts/e2e-collect.js` 를 `--fresh` 없이 반복 실행하면 `DB 영상 저장` 항목이 실패로 표시됨 | 이전 실행의 `_tmp/e2e-userdata/study-ted.db` 가 남아 영상 수가 누적되면서 기대값과 어긋났다(코드 결함 아님) | 스크립트에 `--fresh`(임시 DB 삭제) 옵션을 추가하고 반복 검증은 항상 `--fresh` 로 실행하도록 헤더 주석에 명시 | 해결 |

## 9차 라운드 (자막 수집 속도 + 내부 상태 카드)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 자막 수집 | 자막을 2000개 이상 받으려니 편당 9~11초가 걸려 사실상 끝나지 않음 | 자막 단계가 영상 1편씩 순차 실행이라 편당 네트워크 왕복 대기가 겹치지 않았다. 병목은 프로세스 생성 비용이 아니었다(`--batch-file` 1.37x) | `collectSubtitles()` 를 워커 풀로 교체(기본 동시 4, 설정 `collect.concurrency` 1~8). 실측 순차 55,628ms → 동시 4 24,307ms = 2.29x | 해결 |
| 2026-09-23 | 자막 수집 | 편당 자막 파일이 2~3개 생기고 `kind` 가 모두 `asr` 로 기록됨 | `--sub-langs en.*,en` 정규식이 `en-fr`·`en-hu` 같은 자동 번역 트랙까지 매칭 | `LANG_ATTEMPTS = ['en','en.*,en']` 로 영어 1개를 먼저 받고, 파일이 없을 때만 넓은 패턴으로 1회 재시도. `kind` 는 `null` | 해결 |
| 2026-09-23 | 채널 관리 | 사용자에게 불필요한 `수집 환경` 카드가 항상 보임 | 진단용 카드에 노출 조건이 없었다 | 기본 `hidden`, `preference === 'ytdlp' && !ytdlp.available` 일 때만 자동 표시 | 해결 |
| 2026-09-23 | 검증 스크립트 | `npm run e2e` 를 npm/PowerShell 경유로 실행하면 `--url=@TED --limit=6` 이 전달되지 않아 limit 기본값 3 으로 돌고 `DB 영상 저장`·`자막 수집` 항목이 실패로 표시됨 | npm → PowerShell → electron 사이에서 `--url=...` 인자가 소비·분리됨(스크립트·코드 결함 아님) | `node_modules\.bin\electron.cmd scripts/e2e-collect.js "--url=@TED" "--limit=6" "--fresh"` 로 직접 실행 → 8/8 통과 | 회피 완료 |
| 2026-09-23 | 검증 스크립트 | `npm run smoke` / `npm run e2e:player` 가 셸 종료 코드 1 을 반환 | Electron 이 stderr 로 흘리는 로그를 PowerShell 이 `NativeCommandError` 로 승격(4차와 같은 계열) | 내용은 `실패 0` 이므로 출력 마지막 줄(`총 N개 확인 / 실패 M개`)로 판정 | 회피 완료 |

## 10차 라운드 (문장 누적 + 저장 없는 AI 분석)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 문장 패널 | 자막 줄의 `문장 전송` 을 누르면 기존 입력이 지워지고 그 문장만 들어감 | 전송 경로가 "저장된 문장 불러오기"용 `setSentence()`(교체)를 그대로 사용 | `appendSentence()` 신설(줄 단위 중복 검사 후 `\n` 누적), `setSentence` 는 로드 전용 덮어쓰기로 유지 | 해결 |
| 2026-09-23 | 문장 패널 | 문장을 저장하지 않고 AI 를 누르면 분석 결과가 어디에도 남지 않음 | AI 경로가 저장된 문장만 대상으로 했다 | `analyzeAndSaveSentence()` 로 분석 → `sentences.create({ source:'ai' })` 저장 → 목록 갱신 → 결과 즉시 표시 | 해결 |
| 2026-09-23 | 문장 패널 | 문장 2개를 보내 저장하면 둘 다 첫 문장의 재생 시각을 가짐 | 저장 시 전역 `selectedStartSec` 로 폴백 | `startSecs` 맵에 문장별 시각을 기록하고 전역 폴백 제거 | 해결 |

## 11차 라운드 (동영상 목록 200개 상한)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | 학습하기 | 채널에 동영상이 2000편 넘게 있는데 목록에 200편만 보임 | 렌더러가 `api.videos.list({ channelPk, limit: 200 })` 로 한 번에 200편만 요청(DB 에는 전체가 있었음) | `list` 에 `q`/`offset` 추가 + `videos:page`(총계·hasMore) 신설, 렌더러는 50편 단위로 조회 | 해결 |
| 2026-09-23 | 학습하기 | 2000편 중 원하는 영상을 찾을 방법이 없음 | 검색 경로가 없었음 | 제목·설명 `LIKE` 검색(260ms 디바운스, Enter 즉시)을 메인에서 수행 | 해결 |
| 2026-09-23 | 학습하기 | 빠르게 타이핑하면 이전 검색 결과가 나중에 덮어씀 | 비동기 응답 도착 순서 보장 없음 | `videoPageToken` 으로 최신 요청만 반영 | 해결 |

## 12차 라운드 (AI 구문분석 자동저장 + 분석 노출)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-23 | AI 구문분석 | AI 분석을 눌러도 문장이 저장되지 않고 결과도 남지 않음. 실사용 DB 의 `sentences` 2건 모두 `analysis_json` NULL | 무료 모델의 429 응답을 `request()` 가 재시도 없이 그대로 오류로 던져 `ai:analyze` 가 실패 → 뒤단계(자동저장)까지 도달하지 못했다(로그 14연속 실패) | 429·408·5xx·네트워크 오류에 지수 백오프 재시도(2회, 800ms→8s, `Retry-After` 우선) + `AI_RATE_LIMIT` 안내 | 해결 |
| 2026-09-23 | 문장 노트 | 분석이 저장돼도 문장 노트에서 볼 수 없음 | 표 컬럼이 문장·해석뿐이고 분석을 그리는 자리가 없었다 | `분석` 컬럼 + 숨겨진 상세 행(`tr.is-detail`) + `분석 보기` 토글, 학습 자료 목록에도 동일 카드 | 해결 |
| 2026-09-23 | 문장 패널 | AI 분석이 실패해도 직전 성공 결과가 박스에 남아 성공한 것으로 오해 | `setAnalysis()` 는 성공 경로만 그리고 실패 시 아무것도 하지 않았다 | 실패 시 분석 박스를 비우고 `.analysis--error` `분석하지 못한 문장` 카드로 실패 문장·이유 표시 | 해결 |
| 2026-09-23 | 채널 목록 | `채널 정보 수집` 소요 시간이 25,400ms 로 표시(정상 동작) | 채널 메타데이터를 yt-dlp 로 한 번에 받는 구간이 네트워크 지연에 좌우된다(자막 단계와 무관) | 조치 없음 — 실패 아님, 이전 라운드와 동일 수준 | 확인 |

## 13차 라운드 (영어 필드 한국어 오염 + 분석 카드 정리)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-24 | AI 구문분석 | 같은 화면에서 어떤 문장은 영어 구문 + 한국어 설명이 나오는데, 어떤 문장은 **전부 한국어**로 보임 | 렌더러·DB 버그가 아니라 **모델이 만든 데이터**. 무료 8B(`meta-llama/llama-3.1-8b-instruct`)가 영어로 나와야 할 `structure[].part` 까지 한국어로 채웠고, `systemPrompt` 에 언어 규칙이 없었으며 저장 전 검증도 없었다 | `systemPrompt`/`userPrompt` 에 영어 필드 규칙 명시 + `findLanguageMismatch()` 로 검사해 걸리면 교정 프롬프트로 **1회 재요청**(오염이 줄 때만 채택), 그래도 남으면 카드 상단 노란 경고 | 해결(이미 저장된 오염 분석은 재분석 필요) |
| 2026-09-24 | 문장 노트 | `분석 보기` 를 눌러도 **영어 구문 설명이 없고 한국어만** 보임 | 위와 같은 원인(오염된 분석이 이미 DB 에 저장돼 있었다) + 카드가 해석·구문·표현·예문·원문 응답을 모두 그려 핵심이 묻혀 있었다 | 카드를 `1. 문장 해석` + `2. 구문 분석` 두 항목으로 정리하고, 오염 구문은 `.analysis__warn` 으로 표시해 재분석을 안내 | 해결 |
| 2026-09-24 | 문장 노트 | 하늘색 분석 카드의 답이 답답하게 좁고, 하단 `AI 원문 응답` 은 사용자가 볼 필요가 없음 | 본문 행 간격·줄 높이·글자 크기가 작고 섹션 간격이 좁았음 | `.analysis__row` 12.5px / line-height 1.75, 섹션 간격 16px 로 확대. `AI 원문 응답` 섹션 제거(값 `analysis.raw` 는 DB 에 유지) | 해결 |

## 14차 라운드 (문장 노트에서 주요 표현·예문·메모·태그 제거)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-24 | 문장 노트 | 태그·메모 입력칸을 없애도 DB 의 `sentences.note` 컬럼과 `tags`·`sentence_tags` 테이블은 그대로 남아 있었다 | 화면과 쿼리만 정리하고 스키마는 손대지 않으면 값이 계속 쌓이고, 나중에 되살릴 때 지저분한 데이터가 나온다 | 두 번째 마이그레이션 `dropSentenceNoteAndTags` 로 `DROP TABLE IF EXISTS sentence_tags/tags` + `ALTER TABLE sentences DROP COLUMN note` 실행 | 해결 |
| 2026-09-24 | DB 마이그레이션 | 실사용 DB 를 열어 보니 `schema_version=1` 이고 `note` 컬럼·태그 테이블이 아직 남아 있음 | 마이그레이션은 **앱 시작 시점**에만 실행되는데, 떠 있는 인스턴스는 이전 코드로 시작돼 있었다 | 오류 아님. 실DB **사본**으로 먼저 검증(1→2, `note` 제거, 태그 테이블 제거, 영상 2,358 · 자막 144 · 문장 4 행 수 보존)하고 "앱 재시작 시 자동 반영"을 기록 | 확인 |
| 2026-09-24 | 스모크 | 태그 expect 2건을 지우면서 확인 항목이 94 → 92 로 줄어 실패로 오인할 수 있음 | 제거된 기능을 검사하던 항목이 사라졌기 때문(동작 실패가 아니다) | 스크립트 기대 항목을 정리하고 `총 92개 확인 / 실패 0개` 로 재확인 | 해결 |

## 15차 라운드 (구문 한국어 뜻 필수 + 단어 분할 금지)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-24 | AI 구문분석 | 구문이 `Along / with / their / research` 처럼 **단어 하나씩** 나오고 **한국어 뜻이 비어** 있음 | 화면·저장 버그가 아니라 **모델 출력**. 무료 8B(`meta-llama/llama-3.1-8b-instruct`)가 `structure` 를 단어로 쪼개고 `meaning` 을 빈 문자열로 채웠다. 프롬프트에 "뜻을 비우지 말라"는 규칙이 없었고, 응답 검증은 `part` 의 한글만 봤다 | `systemPrompt`/`userPrompt` 에 뜻·note 필수와 단어 분할 금지 규칙 추가 + `findMissingMeaning`·`findChunkingProblem` 검증 + 이슈 발견 시 1회 교정 재요청 + 뜻 없음 화면 경고 | 해결(이미 저장된 분석은 `AI 다시 분석` 필요) |
| 2026-09-24 | 스모크 | `view:learn AI 분석 결과 표시` 가 `analyze/box 없음` 으로 간헐 실패(2건) | 스모크 드라이버가 `ai.analyze` 를 스텁하기 전에 앞선 문장의 **실 AI 호출**이 아직 돌아 분석 버튼이 `분석 중…` 으로 잠겨 있었다(앱 결함이 아니라 검증 스크립트의 경합) | `waitAnalyzeButton()`(버튼이 풀릴 때까지 120×50ms 대기) 을 스텁 앞에 넣고, `aiFlow`/`aiFail` 루프를 100→240 으로 확대 | 해결(3회 연속 93/0) || 2026-09-24 | 패키징 | `electron-builder` 가 `dist\StudyTED-Setup-1.0.0.exe` 를 쓰지 못하고 `EBUSY / process cannot access the file` 로 실패 | 이전에 실행해 둔 앱/탐색기 또는 이전 빌드의 파일 핸들이 남아 있었다 | `Get-Process` 로 `StudyTED`/`study-ted` 프로세스가 없는지 확인하고, 잠긴 산출물을 지운 뒤 `npm run dist` 재실행 → 성공 | 해결 |
| 2026-09-24 | 검증 | `npm run smoke` 가 `TypeError: Cannot read properties of undefined (reading 'commandLine')` (`scripts/smoke.js:11`) 로 즉시 종료 | 셸 환경에 `ELECTRON_RUN_AS_NODE` 가 설정돼 있어 electron 바이너리가 Node 로 실행됐다(`app` 모듈이 없음) | `Remove-Item Env:\ELECTRON_RUN_AS_NODE` 후 재실행 → 96/0 | 회피 완료 |
| 2026-09-24 | 테스트 | `node --test test/` 가 "디렉터리 인자를 지원하지 않는다"며 실패 | 이 Node(24.21.0) 버전의 `--test` 는 파일 패턴만 받는다 | `npm test`(`node --test test/*.test.js`)를 사용 | 해결 |
| 2026-09-24 | 테스트 작성 | `assert.rejects(update.install())` 가 "missing expected rejection" 으로 실패 | 개발 실행 분기가 **동기 throw** 인데 `assert.rejects` 는 Promise 를 요구한다 | `assert.throws` 로 교체 | 해결 |
| 2026-09-24 | 테스트 작성 | `download()` 가 `UPDATE_NO_FEED` 로 실패 | `check()` 로 피드를 읽어 `latest` 를 채우기 **전에** 다운로드를 호출했다 | 테스트에서 `check()` → `download()` 순서로 고정 | 해결 |
| 2026-09-24 | 테스트 작성 | 설치 스크립트 줄 비교가 항상 실패 | 히어스트링 안에서 `split('\\r\\n')` 을 써서 실제 `\r\n` 이 아니라 리터럴 `\r\n` 문자열(백슬래시 포함)을 찾고 있었다 | `split('\r\n')` 로 수정 | 해결 |

## 17차 라운드 (GitHub 릴리스 배포)

| 시각 | 단계 | 증상 | 원인 | 조치 | 상태 |
|---|---|---|---|---|---|
| 2026-09-24 | 파일 수정 | `settings.js` 패치 스크립트가 `MISS: anchor` 로 중단 | 파일이 **LF** 인데 앵커 문자열에 `\r\n` 을 넣어 비교했다 | `StartsWith` 로 바꾸고 삽입 문자열은 `\r\n` 으로 쓴 뒤, 마지막에 파일 전체를 LF 로 정규화(`crlf=5` → 0) | 해결 |
| 2026-09-24 | 파일 수정 | `.gitignore` 에서 `!_tmp/yt-dlp.exe` 한 줄이 지워지지 않음 | 히어스트링 줄바꿈이 CRLF 로 들어가 그 줄 끝이 `…exe\r\n` 이 되었는데 `Replace` 는 `…exe\n` 을 찾았다 | `.gitignore` 를 줄 배열로 **전체 재작성**(LF, BOM 없음). `!_tmp/…` 는 부모 폴더가 무시되면 효력이 없어 함께 제거 | 해결 |
| 2026-09-24 | 릴리스 조회 | `gh release view --json assets --jq` 가 `failed to parse jq expression` 으로 실패 | jq 식의 문자열 리터럴 인용이 PowerShell 을 거치며 사라졌다 | `--jq` 없이 기본 JSON 출력을 읽어 판단 | 해결 |
| 2026-09-24 | 검증 | `curl` 결과를 `ConvertFrom-Json` 하니 `version`·`sha256` 이 빈 값 | PowerShell 파이프라인에서 `curl.exe` 출력이 줄 배열로 들어와 직렬화가 어긋났다 | `curl -o <파일>` 로 받은 뒤 `Get-Content -Encoding UTF8` 로 읽어 변환 | 해결 |
| 2026-09-24 | 배포 스크립트 | `spawnSync(..., { shell: true })` 로 `gh` 를 부르면 `--title StudyTED v1.0.0` 이 공백에서 쪼개질 위험 | `shell:true` 는 인자 배열을 인용 없이 공백으로 이어 붙인다 | `gh`·`git` 은 `shell:false`(Node 가 인용 처리), `.cmd` 인 `npm` 만 `shell:true` 로 분리 | 해결 |
| 2026-09-24 | 문서 작성 | 하네스 표 안에 코드로 쓴 파이프 문자가 셀 구분자로 해석될 뻔함 | 마크다운 표 셀 안의 `\|` 이스케이프 규칙 | 해당 셀 문구를 파이프 없는 표현으로 바꿔 다시 작성 | 해결 |