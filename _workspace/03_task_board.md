# Task Board

갱신 규칙: 상태는 `TODO` / `DOING` / `DONE` / `BLOCKED` / `HOLD` 중 하나만 사용한다.
근거 없는 `DONE` 금지. 검증하지 않은 항목은 `DOING` 또는 `HOLD` 로 둔다.

| ID | 작업 | 상태 | 산출물 |
|---|---|---|---|
| T01 | 하네스 문서 구조 생성 (`_workspace`, `rules`, `.editorconfig`, `.gitattributes`) | DONE | `_workspace/*`, `rules/*` |
| T02 | 프로젝트 골격 및 `package.json` / Electron 설치 | DONE | `package.json`, `node_modules` |
| T03 | Electron 메인 프로세스 (창, 커스텀 `app://` 프로토콜, 보안 설정) | DONE | `main/main.js` |
| T04 | preload + IPC 화이트리스트 | DONE | `main/preload.js`, `main/ipc.js` |
| T05 | SQLite 스키마·마이그레이션·쿼리 계층 | DONE | `main/db/*.js` |
| T06 | 설정 저장소 (OpenRouter 키 암호화, 모델, 즐겨찾기) | DONE | `main/db/settings.js` |
| T07 | 자막 파서 (json3 / vtt / srt / xml / text) | DONE | `main/collect/subtitle-parser.js` |
| T08 | yt-dlp 관리 (탐지 / 다운로드 / 버전) | DONE | `main/collect/ytdlp-manager.js` |
| T09 | yt-dlp provider (채널 목록 / 영상 메타 / 자막) | DONE | `main/collect/ytdlp-provider.js` |
| T10 | native provider (HTML + Innertube: 채널 / 영상 / 자막 트랙) | DONE | `main/collect/native-provider.js` |
| T11 | 수집 오케스트레이션 (선택·폴백·진행률·중단) | DONE | `main/collect/index.js` |
| T12 | OpenRouter 연동 (모델 목록 / 구문분석 JSON) | DONE | `main/ai/openrouter.js` |
| T13 | 공유 내보내기·가져오기 (JSON / Markdown / HTML) | DONE | `main/share.js` |
| T14 | 렌더러 공통 (토큰 CSS, 레이아웃, 사이드바, 타이틀바) | DONE | `renderer/index.html`, `renderer/css/*` |
| T15 | 학습 워크스페이스 (플레이어 / 듣기·자막 모드 / 자막 패널 하이라이트 / 문장 패널) | DONE | `renderer/js/components/*`, `renderer/js/player.js` |
| T16 | 학습한 문장 목록 테이블 (검색·필터·정렬·즐겨찾기) | DONE | `renderer/js/components/notes-table.js` |
| T17 | 뷰 7종 (홈 / 채널 관리 / 학습하기 / 문장 노트 / 학습 자료 / 공유하기 / 설정) | DONE | `renderer/js/views/*.js` |
| T18 | 데모 데이터 시딩 + 첫 실행 안내 | DONE | `main/demo-data.js` |
| T19 | 테스트 (자막 파서 / DB / 응답 파싱 / AI 정규화) | DONE | `test/*.test.js` |
| T20 | Electron 스모크 테스트 (부팅·IPC·스크린샷) | DONE | `scripts/smoke.js`, `_tmp/smoke.png` |
| T21 | 검증 및 기록 (`07_validation.md`, `08_error_log.md` 갱신) | DONE | `_workspace/07_validation.md` |
| T22 | 임시 산출물 정리 (`_tmp` 스크래치) | DONE | - |
| T23 | 실제 유튜브 채널 End-to-End 수집 검증 | DONE | `_workspace/07_validation.md` |
| T24 | 배포 패키징 (electron-builder NSIS 설치본 · 아이콘 · yt-dlp 번들) | DONE | `package.json`, `scripts/make-icon.js`, `scripts/prepare-bin.js`, `build/icon.ico` |
| T25 | 영상 전체 자막 자동 번역 | HOLD | 사용자 요청 시 |
| T26 | 수집 시 기존 영상 메타 갱신 건너뛰기 옵션 (`refreshExisting`) | DONE | `main/db/videos.js`, `main/db/settings.js`, `main/ipc.js`, `main/collect/index.js`, `renderer/js/views/settings.js` |
| T27 | 학습하기 동영상 선택 목록 썸네일+제목 배치 개선 | DONE | `renderer/js/views/learn.js`, `renderer/css/views.css` |
| T28 | "동영상을 재생하지 못했습니다" 원인 수정 (커스텀 스킴 Referer 누락) | DONE | `main/main.js`, `renderer/index.html`, `renderer/js/player.js`, `scripts/e2e-player.js` |
| T29 | 채널 전체 수집(개수 제한 해제) — 기본값을 "전체" 로 | DONE | `main/collect/index.js`, `main/collect/ytdlp-provider.js`, `main/collect/native-provider.js`, `main/db/settings.js`, `main/ipc.js`, `renderer/js/actions.js`, `renderer/js/views/settings.js` |
| T30 | 검은 반투명 레이어(자막 오버레이가 프레임 전체를 덮던 문제) | DONE | `renderer/css/views.css` |
| T31 | 등록된 채널별 수집 버튼 + 진행 상태 / 전체 채널 수집 버튼 | DONE | `renderer/js/views/channels.js` |
| T32 | 채널 리스트에 수집 동영상/자막/저장 문장 개수 표시 | DONE | `main/db/channels.js`, `renderer/js/views/channels.js`, `renderer/css/views.css` |
| T33 | 자막 줄 "문장 전송" 버튼 추가 + 줄 클릭은 그 지점부터 재생 | DONE | `renderer/js/components/transcript.js`, `renderer/js/components/study-workspace.js`, `renderer/css/views.css` |
| T34 | OpenRouter 모델 목록에 1M 토큰당 가격 표시 | DONE | `main/ai/openrouter.js`, `renderer/js/views/settings.js`, `renderer/css/views.css` |
| T35 | 가성비(가격) 순 추천 + 모델 직접 검색 선택 | DONE | `renderer/js/views/settings.js`, `renderer/css/views.css`, `scripts/smoke.js` |
| T36 | 수집 중 즉시 정지(취소) — job-registry + AbortSignal 전파 | DONE | `main/collect/job-registry.js`, `main/collect/index.js`, `main/collect/net.js`, `main/collect/ytdlp-manager.js`, `main/collect/ytdlp-provider.js`, `main/collect/native-provider.js`, `renderer/js/views/channels.js` |
| T37 | 취소 회귀 테스트 + 정지 버튼 UI/E2E 검증 | DONE | `test/collect-cancel.test.js`, `scripts/e2e-collect.js`, scripts/smoke.js |
| T38 | 자막 수집 처리량 개선(순차 → 워커 풀 동시 수집) + 자막 언어 후보 축소 | DONE | `main/collect/index.js`, `main/collect/ytdlp-provider.js`, `main/db/settings.js`, `main/ipc.js`, `renderer/js/views/settings.js`, `test/collect-subtitles.test.js` |
| T39 | 진단용 `수집 환경` 카드 기본 숨김(yt-dlp 미설치 예외만 노출) | DONE | `renderer/js/views/channels.js` |
| T40 | 선택 문장을 문장 패널에 **덮어쓰지 않고 누적 추가**(줄 단위 중복 제거) | DONE | `renderer/js/components/sentence-panel.js`, `renderer/js/components/study-workspace.js`, `scripts/smoke.js` |
| T41 | **저장 없이 AI 구문분석** → 결과를 문장 노트에 자동 저장·즉시 표시 | DONE | `renderer/js/actions.js`, `renderer/js/components/sentence-panel.js`, `renderer/js/components/study-workspace.js`, scripts/smoke.js |
| T49 | 빌드 파이프라인 (`npm run icon` / `prepare:bin` / `dist` / `dist:dir` / `manifest`) + NSIS 설정 | DONE | `package.json`, `scripts/make-icon.js`, `scripts/prepare-bin.js`, `scripts/make-manifest.js` |
| T50 | **홈 상단 버전 표시 + 자동 업데이트**(피드 확인 → 표기 → 다운로드 → 설치 후 재시작) | DONE | `main/update.js`, `renderer/js/components/update-banner.js`, `main/ipc.js`, `main/db/settings.js`, `renderer/js/views/{home,settings}.js` |

## 이번 라운드 범위

- P0 + P1 (F1~F10) 전체 구현
- T24, T25 는 사용자 요청 시 진행

## 3차 라운드 완료 기록 (2026-09-23)

- T01~T23 전부 `DONE`. 근거는 `07_validation.md` 의 실행 결과다.
- 이번 라운드에서 실제 채널 E2E 를 처음 끝까지 통과시켰고, 그 과정에서 발견한 수집 버그 2건을 수정했다.
  - native provider 가 만든 영상 항목에 `url` 이 없어 `videos` 저장이 실패 → provider·오케스트레이션·DB 3단 방어로 해결
  - `syncChannel` 의 지역 변수 `ytdlp` 가 provider 모듈을 가려 yt-dlp 목록 수집이 조용히 폴백 → 이름 분리로 해결
- 검증 요약: 문법 44/0 · 단위 34/34 · 스모크 61/0 · E2E 7/7(TED, 영상 2 + 자막 2)
- `_tmp` 는 스모크 스크린샷 7장과 `yt-dlp.exe`(E2E 재현용 로컬 바이너리)만 남기고 정리했다. `yt-dlp.exe` 는 하네스 산출물이 아니라 도구 캐시이며 E2E 스크립트가 이 경로를 우선 사용한다.
- T24(패키징)·T25(자막 자동 번역)는 사용자 요청 시 진행한다.

## 4차 라운드 완료 기록 (2026-09-23)

사용자 피드백 3건을 처리했다. (T26~T28)

- **T28(원인 규명 포함)**: "동영상을 재생하지 못했습니다" 는 네트워크 문제가 아니었다. 렌더러를 커스텀 스킴 `app://study-ted` 로 열면 Chromium 이 커스텀 스킴 요청에 **Referer 를 보내지 않아** YouTube 임베드가 재생을 거부(`error 153`)한다. 렌더러 서빙을 loopback HTTP(`http://127.0.0.1:<임의 포트>`)로 바꿔 해결했고, 재생 오류 코드별 사용자 메시지도 분리했다.
- **T26**: 설정에 `refreshExisting`(기본 켜짐)을 추가했다. 끄면 두 번째 수집부터 기존 영상은 메타(제목·조회수·썸네일)를 건너뛰고 신규 영상만 저장한다. 진행 메시지에 `신규 N개 · 기존 K개 정보 유지` 로 표시된다.
- **T27**: 동영상 선택 목록을 썸네일(96px) + 제목 2줄 + 메타 2줄 그리드로 바꿔 가독성을 올렸다. 좁은 창(≤1360px)에서는 목록 폭과 썸네일을 줄인다.
- 검증 요약: 문법 0 실패 · 단위 35/35 · 스모크 64/0 · 채널 E2E 8/8(TED) · 재생 E2E 6/6
- `_tmp` 는 스모크 스크린샷 7장 + `e2e-player.png` + `yt-dlp.exe` 만 남기고 정리했다(프로브 스크립트·임시 userData·로그 출력 삭제).
## 5차 라운드 완료 기록 (2026-09-23)

사용자 피드백 4건 + 후속 확인 1건을 처리했다. (T29~T31)

- **T30(검은 반투명 레이어 — 사용자 추측이 정답)**: 확대/축소할 때 화면을 덮던 검은 레이어의 정체는 **자막 오버레이 `.player-caption`** 이었다. `renderer/css/views.css` 의 `.player-frame iframe, .player-frame > div { width:100%; height:100% }` 규칙이 플레이어 호스트뿐 아니라 프레임의 직계 `div` 인 `.player-caption` 까지 매칭해, 자막 상자가 프레임 전체 크기(376×211)의 `rgba(8,12,20,0.72)` 레이어가 되어 있었다. 선택자를 `.player-frame > .player-host` / `.player-frame > .player-note` 로 좁히고 자막 상자는 `width/height:auto` + `max-height:60%` + 배경 0.62 로 바꿨다. 프로브 실측: 수정 전 자막 상자 376×211(프레임과 동일 크기, 전면 덮음) → 수정 후 356×48(하단 10px 인셋).
- **T29(데이터가 24개뿐인 이유)**: 채널 전체를 못 긁은 것이 아니라 기본 개수 제한 `collect.limit = 24` 가 yt-dlp 의 `--playlist-end 24` 와 native 의 페이지 상한(6페이지)으로 그대로 전파된 결과였다. 설정에 **채널 전체 수집(`collect.collectAll`, 기본 켜짐)** 을 추가해 기본 동작을 무제한으로 바꿨고, 무제한일 때는 `--playlist-end` 를 붙이지 않으며 native 는 안전 상한 150페이지(≈4,500개)까지 넘긴다. 개수 제한을 쓰고 싶으면 설정에서 전체 수집을 끄고 숫자를 넣는다.
- **T31(채널별·전체 수집 버튼)**: 등록된 채널 행마다 **수집** 버튼을, 채널 목록 헤더에 **전체 채널 수집** 버튼을 추가했다. 채널을 순차 처리하면서 행 상태(`수집 중… (i/n)` → `완료 · 신규 N개 · 자막 M개` / `실패 · 메시지` / `취소됨`)와 진행 바 `(i/n)` 를 표시하고, 끝나면 목록을 새로 읽어 개수를 갱신한다. 수집 중에는 다른 수집 버튼과 채널 불러오기 버튼이 잠기고 취소 버튼이 나타난다.
- **재확인(단답)**: "채널을 한 번 불러오고 새로운 데이터만 저장할 수 있게 되어 있는가" → **예**. T26 의 `refreshExisting`(기본 켜짐)을 끄면 두 번째 수집부터 기존 영상은 메타를 건너뛰고 신규 영상만 저장한다(E2E `keptCount:2, addedCount:0`, 영상 2→2).
- 검증 요약: 문법 0 실패 · 단위 35/35 · 스모크 64/0 · 채널 E2E 8/8(TED) · 재생 E2E 6/6. 무제한 수집 경로는 스텁 프로브로 확인했다(`--playlist-end` 부재, native 6페이지 초과 진행). 실제 채널 전체 크롤은 시간이 오래 걸려 실행하지 않았다.

## 6차 라운드 완료 기록 (2026-09-23)

사용자 피드백 3건을 처리했다. (T32~T33)

- **T32(채널 리스트에 몇 개 불러왔는지 표시)**: 채널 관리 행에 `수집 동영상 N개 · 자막 N개 · 저장 문장 N개` 한 줄을 추가했다. 개수는 `channels` 조회 경로(목록/단건)에서 상관 서브쿼리로 계산하므로 별도 IPC 없이 모든 읽기 경로가 같은 값을 돌려준다. 수집이 끝나면 목록을 다시 읽어 개수가 갱신된다.
- **T33(자막 줄 옆 "문장 전송" 버튼 + 줄 클릭은 재생)**: 자막 줄을 `[시간][문장][문장 전송]` 3열로 바꾸고, 버튼은 `stopPropagation` 으로 줄 클릭과 분리해 오른쪽 문장 패널로 보낸다. 줄 본문을 클릭하면 그 시점으로 이동한 뒤 **재생까지** 이어진다(`seekTo` 만으로는 멈춘 상태로 남으므로 `play()` 를 함께 호출).
- 검증 요약: 문법 0 실패 · 단위 35/35 · 스모크 71/0 · 채널 E2E 8/8(TED) · 재생 E2E 6/6. 스모크에 전송 버튼 개수(15/15)·배치(문장/시간과 겹치지 않음)·클릭 시 `seekTo`+`play` 호출 추적·"전송은 클릭이 아님" 항목을 추가했다.

## 7차 라운드 완료 기록 (2026-09-23)

사용자 요청 2건을 처리했다. (T34~T35)

- **T34(모델 옆에 가격 표시)**: OpenRouter `/models` 응답의 `pricing.prompt`/`pricing.completion`(USD / 1 token)을 **1M 토큰당 USD** 로 환산해 목록에 함께 보여 준다. 표시는 두 가지 — 넓은 자리는 `입력 $0.15 · 출력 $0.6 / 1M`, 좁은 자리(기본 모델 `<select>` option, 즐겨찾기 목록)는 `$0.15/$0.6`. 무료 모델은 `무료`, 라우팅 모델처럼 단가가 `-1` 인 경우는 `가격 정보 없음`/`가격 미정` 으로 **무료와 구분**한다.
- **T35(가성비 추천 + 모델 검색)**: 설정 > AI 모델에 **가성비 추천** 목록(입력 40% · 출력 60% 가중 평균이 낮은 순 상위 5개, `가성비 N위` 뱃지)과 **모델 검색** 영역(이름·ID 부분 일치, 대소문자 무시, 최대 200개 표시 + `검색 결과 N개 / 전체 M개`)을 추가했다. 두 목록 모두 항목을 누르면 기본 모델로 설정되고, 현재 선택된 모델은 행이 강조된다.
- 가격 파생·순위·검색은 모두 메인 프로세스(`main/ai/openrouter.js`)에서 계산해 기존 `ai:models` 응답에 실어 보낸다(IPC 추가 없음). 렌더러는 목록이 바뀔 때만 다시 그린다.
- 검증 요약: 문법 0 실패 · 단위 40/40(가격·순위·검색 5건 추가) · 스모크 75/0(모델 검색/가성비 추천 항목 1건 추가) · 채널 E2E 8/8(TED) · 재생 E2E 6/6. 실제 모델 목록 렌더는 임시 프로브(가짜 모델 4개 주입)로 행 구성·가격 표기·순위 뱃지·선택 강조·검색 필터·가로 넘침 0을 확인했다.

## 8차 라운드 완료 기록 (2026-09-23)

사용자 요청 1건(자막 2000개 이상 수집 중 정지 수단이 없다)을 처리했다. (T36~T37)

- **진단**: 취소 배선은 이미 있었지만 실효가 없었다. `assertNotCancelled` 가 **자막 루프 경계**에서만 검사돼, 자막 1건(yt-dlp 자식 프로세스, 최대 150초)이 끝날 때까지 정지가 먹지 않았다. 게다가 `ytdlp-manager.run` 은 `signal`(AbortSignal)을 지원하는데 **호출부가 signal 을 넘기지 않아** abort 경로가 dead code 였다.
- **T36(즉시 취소)**: `main/collect/job-registry.js` 를 신설해 jobId 단위 취소 플래그 + `AbortController` 를 한 곳에서 관리한다. `net.fetchText`, `native-provider` 의 `resolveChannel`/`browse`/`listVideos`/`getVideo`/`getTranscript`, `ytdlp-manager.run` 까지 **AbortSignal 을 끝까지 전달**해, 정지를 누르면 진행 중인 네트워크 요청과 자식 프로세스가 그 자리에서 끊긴다(재시도하지 않음).
- **T37(정지 버튼 + 회귀 검증)**: 채널 관리 진행 바 옆에 **수집 정지** 버튼(`.btn--sm.btn--danger`)을 두고, `paintCancelButtons(busy)` 가 진행/전체 수집/정지 버튼의 hidden·disabled·문구(`정지하는 중…`)를 한 곳에서 관리한다. 단위 테스트 6건과 E2E `--cancel-after`/`--cancel-limit` 취소 시나리오를 추가했다.
- **부분 결과 보존**: 취소 시점까지 저장된 영상·자막은 지우지 않는다. `syncChannel` 은 `cancelled:true` 와 partial 값을 함께 돌려주고(`error.detail` 에도 동일) 채널 행은 `취소됨` 으로 표시한다. 실제 측정: 30초 정지 시 `videoCount:40` 저장분 유지, 자막 2건까지 보존.
- 검증 요약: 문법 0 실패 · 단위 46/46(취소 6건 추가) · 스모크 76/0(`view:channels 정지 버튼` 항목 추가) · 채널 E2E 8/8(TED) · 취소 E2E 11/11(`code:CANCELLED`, `elapsedMs:30012`) · 재생 E2E 6/6

## 9차 라운드 완료 기록 (2026-09-23)

사용자 피드백 2건(자막을 하나씩 받아 너무 느림 · 상단 `수집 환경` 카드가 불필요)을 처리했다. (T38~T39)

- **T38(자막 수집 처리량)**: 자막을 **영상 1개씩 순차로** 받던 경로를 `collectSubtitles()` 워커 풀로 바꿔 기본 4개(설정 1~8)를 동시에 받는다. 자막 1건이 yt-dlp 자식 프로세스(편당 4~11초)라 순차 실행은 대기 시간이 그대로 쌓였다. 먼저 `_tmp/probe-subs-speed.js` 로 ① 한 개씩 66.1s(11.0s/편) ② `--batch-file` 한 프로세스 48.1s(8.0s/편) = **1.37x** 를 재 봤지만, 지렛대는 프로세스 생성이 아니라 **네트워크 왕복 대기**였다. 워커 풀 적용 후 TED 6편 실측이 **55,628ms(편당 9,271ms) → 24,307ms(편당 4,051ms) = 2.29x** 다.
- **T38(자막 파일 수 축소)**: `--sub-langs en.*,en` 은 정규식이라 `en-fr`·`en-hu` 같은 자동 번역 트랙까지 함께 받았다(프로브 실측 6편 14파일 = 편당 2~3개). `en` 만 지정해 1개로 줄이고, `en` 트랙이 없는 영상은 넓은 패턴으로 **한 번만** 재시도한다. 다운로드 폴더도 편 단위(`collect-<jobId>/<videoId>`)로 분리해 동시 실행에서 서로의 파일을 지우지 않게 했다.
- **T39(수집 환경 카드)**: 진단용 정보라 기본 `hidden` 으로 두고, **yt-dlp 를 쓰기로 했는데 yt-dlp 가 없어 수집이 불가능한 경우에만** 자동으로 나타나게 했다. 같은 정보와 `yt-dlp 내려받기` 는 설정 화면에 그대로 있다.
- 검증 요약: 문법 0 실패 · 단위 51/51(자막 동시성·부분 실패 5건 추가) · 스모크 76/0 · 채널 E2E 8/8(TED 6편 · 자막 6건) · 재생 E2E 6/6

## 10차 라운드 완료 기록 (2026-09-23)

사용자 피드백 2건(문장을 보내면 기존 입력이 지워짐 · 저장하지 않고 AI 분석)을 처리했다. (T40~T41)

- **T40(문장 누적)**: 자막 줄의 **문장 전송** 이 문장 패널 입력칸을 통째로 교체하고 있었다. `SentencePanel.appendSentence()` 를 신설해 **줄 단위로 중복만 걸러 `\n` 으로 덧붙이고**, 그 문장이 시작된 재생 시각도 함께 기록한다. 이미 들어 있는 문장을 다시 보내면 `이미 문장 패널에 있는 문장입니다.` 만 알리고 그대로 둔다(중복 0줄 증가). 저장된 문장을 다시 불러오는 경로(`setSentence`)는 기존처럼 **덮어쓰기를 유지**한다.
- **T41(AI 분석 즉시 저장)**: 예전에는 **문장 저장 → 목록에서 다시 열기 → AI 구문분석** 순서를 강제했다. `analyzeAndSaveSentence()` 를 신설해 AI 버튼 한 번으로 (1) AI 호출 (2) `source:'ai'` 로 문장 노트 저장(영상 제목·주소·시작 시각 포함) (3) 목록/자료 갱신 (4) 결과를 문장 패널에 즉시 표시까지 이어진다. 저장된 문장은 입력칸에서 빠지고, 버튼에는 `분석 중… 2/3` 진행이 표시된다. 한 번에 최대 5문장까지 처리한다.
- 검증 요약: 문법 0 실패 · 단위 51/51 · 스모크 80/0(누적 전송·중복 무시·AI 즉시 저장·결과 표시 4건 추가) · 채널 E2E 8/8(TED 6편 · 자막 6건 · `transcriptCount:6`) · 재생 E2E 6/6
- **10차 마무리**: `README.md` 를 동기화(문장 누적·AI 즉시 저장·동시 수집 개수·문제 해결 4행)했고, `_workspace` 에 D-022~D-026 과 9·10차 오류 기록을 남겼다. 프로브 스크립트·로그와 검증용 userData(`e2e-userdata`, `e2e-player-userdata`)를 정리한 뒤 `npm test` 51/51 · `npm run smoke` 80/0 을 재확인했다.

## 11차 라운드 완료 기록 (2026-09-23)

사용자 피드백 1건(동영상 선택 목록이 200개까지만 보임 → 전체 + 검색 + 페이징)을 처리했다. (T42)

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T42 | 학습하기 동영상 목록 **검색 + 페이징**(2000편 대응, 200개 상한 제거) | DONE | `main/db/videos.js`, `main/ipc.js`, `main/preload.js`, `renderer/js/api.js`, `renderer/js/state.js`, `renderer/js/actions.js`, `renderer/js/views/learn.js`, `renderer/css/views.css`, `test/db.test.js`, `scripts/smoke.js` |

- **T42(원인)**: 표시 상한은 DB 가 아니라 렌더러 요청값이었다. `renderer/js/actions.js` 가 `api.videos.list({ channelPk, limit: 200 })` 로 부르고 있어 채널에 2000편이 있어도 200편만 그렸다. 목록을 조건으로 다시 읽는 경로가 없어 검색·페이지 이동도 불가능했다.
- **T42(수정)**: `main/db/videos.js` 에 `escapeLike()`/`buildFilter()` 를 두고 `list({channelPk, q, limit, offset})` 과 `count({channelPk, q})` 가 **같은 조건**을 쓰게 했다(반환은 기존처럼 배열 유지). `main/ipc.js` 에 `videoQuery()` 와 `videos:page` 를 추가해 `{ items, total, offset, limit, hasMore }` 를 돌려준다. 렌더러는 `videoPage` 상태(검색어·시작 위치·전체 개수)를 두고 **한 페이지 50편**만 받아 그린다.
- **T42(UI)**: `renderer/js/views/learn.js` 픽커 카드에 검색 입력(제목·설명, 260ms 디바운스, Enter 즉시)과 `‹ 이전 / n / 총페이지 / 다음 ›` 페이저를 넣고, 카드 헤드에 `전체 N개 중 i–j`(검색 시 `검색 결과 N개 중 i–j`)를 표시한다. 사용자가 짚은 "TED-Ed · 2.2K videos" 자리는 채널 선택 드롭다운이라 지우지 않고 **그 바로 아래**에 검색을 두었다.
- 검증 요약: 문법 0 실패 · 단위 52/52 · 스모크 89/0 · 채널 E2E 8/8(TED 6편 · 자막 6건 · `transcriptCount:6`) · 재생 E2E 6/6

## 12차 라운드 완료 기록 (2026-09-23)

사용자 피드백 1건(AI 구문분석 시 문장 자동저장 + 분석 결과가 문장 노트에 저장되지 않음)을 처리했다. (T43)

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T43 | AI 구문분석 **자동저장 실패 원인 제거**(429 재시도) + 분석 결과를 **문장 노트·학습 자료에 노출** | DONE | `main/ai/openrouter.js`, `renderer/js/components/analysis-card.js`(신규), `renderer/js/components/sentence-panel.js`, `renderer/js/components/notes-table.js`, `renderer/js/views/materials.js`, `renderer/js/actions.js`, `renderer/css/views.css`, `test/ai-parse.test.js`, `scripts/smoke.js` |
| T44 | 분석 구문이 **전부 한국어로 보이는 문제** 수정(영어 필드 검증 + 자동 교정 재요청 + 화면 경고) | DONE | `main/ai/openrouter.js`, `renderer/js/components/analysis-card.js`, `renderer/css/views.css`, `test/ai-parse.test.js`, `scripts/smoke.js` |
| T45 | 분석 카드를 **문장 해석·구문 분석**만 남김(주요 표현·예문 제거) + 하단 `AI 원문 응답` 섹션 제거 | DONE | `renderer/js/components/analysis-card.js`, `renderer/js/components/sentence-panel.js`, `renderer/js/components/notes-table.js`, `renderer/css/views.css`, `scripts/smoke.js` |

- **원인 A(근본)**: 실사용 로그(`%APPDATA%\study-ted\logs\app.log`)에 `ipc ai:analyze 처리 실패 요청이 너무 많습니다…` 가 14회 연속(08:16, 08:26). `ai.model` 이 무료 모델(`meta-llama/llama-3.1-8b-instruct`)이라 429 가 잦은데 `request()` 에 재시도가 없어 **한 번의 429 로 분석이 죽고**, 그 뒤의 `sentences.create`(자동저장)까지 도달하지 못했다. 실사용 DB 의 `sentences` 2건 모두 `analysis_json`·`translation` 이 NULL 이었다.
- **원인 B(버그 아님)**: 저장 계층은 정상이었다. `_tmp/analysis-roundtrip.js` 로 `create → getByPk → list → exportAll → update` 전 경로에서 `analysis.*` 왕복을 확인했다.
- **원인 C**: 문장 노트·학습 자료 화면에 **분석을 볼 수단이 없었다**. `notes-table.js` 의 컬럼은 문장·해석뿐이라 저장돼도 보이지 않았고, 분석 박스는 하나뿐이라 실패 시 직전 성공 결과가 남아 성공으로 오해하기 쉬웠다.
- **T43(수정 1 — 재시도)**: `request()` 에 지수 백오프 재시도(`RETRY_STATUSES=[408,429,500,502,503,504]`, 2회, 800ms→최대 8s, `Retry-After` 헤더 우선)를 넣었다. 429 는 `AI_RATE_LIMIT` + `요청이 너무 많습니다… 설정에서 다른 모델을 선택해 주세요` 로 안내한다.
- **T43(수정 2 — 노출)**: `renderer/js/components/analysis-card.js` 를 신설해 해석·구문분석·주요표현·예문 카드를 한 곳에 모으고, 문장 노트 표에 `분석` 컬럼(요약 + `분석 보기` 토글 → `tr.is-detail` 펼침)을, 학습 자료 목록에 요약 pill + `분석` 토글을 붙였다.
- **T43(수정 3 — 오해 방지)**: 분석이 실패하면 직전 성공 결과를 지우고 `분석하지 못한 문장`(빨간 카드)으로 실패 문장과 이유를 보여 준다. 저장된 분석에는 어떤 모델이 만들었는지(`analysis.model`)도 함께 저장한다.
- 검증 요약: 문법 0 실패 · 단위 57/57(429·5xx 재시도, Retry-After 우선순위 5건 추가) · 스모크 92/0(`view:notes 분석 표시`·`분석 펼치기`·`view:learn AI 분석 실패 표시` 3건 추가) · 채널 E2E 8/8 · 재생 E2E 6/6
- **알려진 한계**: 실사용 DB 에 이미 `analysis_json` NULL 로 저장된 2건은 소급 복구되지 않는다. 문장 노트에서 그 문장을 열어 `AI 구문분석` 을 다시 눌러야 한다.
- **12차 마무리**: `README.md` 문제 해결 표(100~101행)를 동기화했고, `_workspace` 에 D-029 와 12차 오류 4행을 남겼다. 검증용 userData(`smoke-userdata`, `e2e-userdata`, `e2e-player-userdata`)·프로브 스크립트·export 산출물을 정리한 뒤 `node --test` 57/57 · `npm run smoke` 92/0 을 재확인했다. `_tmp` 에는 스모크 PNG 9장과 `yt-dlp.exe` 만 남는다.

## 13차 라운드 완료 기록 (2026-09-24)

사용자 피드백 2건(① AI 구문분석 결과가 갑자기 전부 한국어로 보임 · ② 분석 보기를 눌러도 영어 구문 설명 없이 한국어만 보임 · ③ 카드 정리)을 처리했다. (T44~T45)

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T44 | 구문이 전부 한국어로 보이는 원인 제거(영어 필드 검증 + 자동 교정 + 경고) | DONE | `main/ai/openrouter.js`, `renderer/js/components/analysis-card.js`, `renderer/css/views.css`, `test/ai-parse.test.js`, `scripts/smoke.js` |
| T45 | 카드는 **문장 해석·구문 분석**만, 하단 `AI 원문 응답` 제거, 주요 표현·예문 입력 필드 제거 | DONE | `renderer/js/components/analysis-card.js`, `renderer/js/components/sentence-panel.js`, `renderer/js/components/notes-table.js`, `renderer/css/views.css`, `scripts/smoke.js` |

- **T44(원인)**: 렌더러·DB 버그가 아니라 **모델 성능 + 프롬프트 규칙 불명확**이었다. 실사용 DB(`%APPDATA%\study-ted\study-ted.db`)의 `sentences` 를 확인하니 정상 분석(id=3: `part` 영어 / `meaning` 한국어)과 오염 분석(id=4: `translation` 이 영상 제목, `structure[].part` 가 한국어 명사구, `examples[].en` 이 한국어)이 섞여 있었다. 사용 모델은 무료 8B(`meta-llama/llama-3.1-8b-instruct`). 기존 `systemPrompt` 에는 "`part` 는 영어로 두라"는 규칙이 아예 없었고, `normalizeAnalysis` 도 언어를 검사하지 않았다.
- **T44(수정)**: `systemPrompt`/`userPrompt` 에 영어 필드 규칙을 명시하고("`part` MUST be English only · 문장에서 그대로 복사 · `part` 안에 한글 금지 · 한국어는 `translation`·`meaning`·`note` 에만"), 응답을 받은 뒤 `findLanguageMismatch()` 로 `structure[].part` 의 한글을 검사해 걸리면 **교정 프롬프트로 1회만 재요청**한다(교정본의 오염 개수가 줄 때만 채택). 그래도 남으면 분석 카드 상단에 노란 경고(`.analysis__warn`)로 "영어로 나와야 할 부분이 한국어로 저장돼 있습니다 (구문 1)…" 를 띄워 오염 사실을 숨기지 않는다.
- **T45(정리)**: 사용자 요청대로 카드에서 **주요 표현·예문을 뺐다**. JSON 스키마도 `translation` + `structure` 두 키만 요구하고("Return only the keys `translation` and `structure`"), 수동 입력 모달·문장 수정 모달에서도 표현/예문 필드를 제거했다(예전에 저장된 값은 지우지 않고 보존). 하단 `AI 원문 응답` 섹션은 화면에서 제거했다(`analysis.raw` 는 DB 에 그대로 저장). 하늘색 카드 본문은 행 간격·줄 높이·글자 크기를 키우고 섹션 간격을 넓혀 답이 나오는 자리를 아래로 넓혔다.
- 검증 요약: 문법 0 실패 · 단위 61/61(언어 검증·교정 4건 추가) · 스모크 94/0 · 채널 E2E 8/8(TED 6편 · 자막 6건) · 재생 E2E 6/6
- **알려진 한계**: 이미 한국어로 저장된 문장은 소급 복구되지 않는다. 문장 노트에서 그 문장을 열고 **AI 구문분석**을 다시 눌러야 하며, 이제 카드 상단 경고로 오염 여부를 바로 알 수 있다. 교정 재시도로도 안 고쳐지면(무료 8B 한계) 설정에서 더 좋은 모델을 선택해야 한다.
- **13차 마무리**: `README.md` 문제 해결 표에 "구문이 전부 한국어" 행을 추가했고, `_workspace` 에 D-030·D-031 과 13차 오류 3행을 남겼다. 마지막 검증으로 `node --test` 61/61 · `npm run smoke` 94/0 · E2E 8/8·6/6 을 재확인하고, 스크래치(`_tmp/db-dump.js`)를 정리했다.

## 14차 라운드 완료 기록 (2026-09-24)

사용자 피드백 1건(문장 노트 저장·수정에서 **주요 표현·예문·메모·태그**가 필요 없으니 **DB 에서도 빼 달라**)을 처리했다. (T46~T47)

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T46 | 문장 노트 저장·수정에서 주요 표현·예문·메모·태그 제거 (UI·IPC·공유·데모·테스트) | DONE | `main/db/sentences.js`, `main/ipc.js`, `main/preload.js`, `main/share.js`, `main/demo-data.js`, `main/ai/openrouter.js`, `renderer/js/api.js`, `renderer/js/state.js`, `renderer/js/actions.js`, `renderer/js/components/notes-table.js`, `renderer/js/components/sentence-panel.js`, `renderer/js/components/study-workspace.js`, `renderer/js/views/share.js`, `test/db.test.js`, `test/ai-parse.test.js`, `scripts/smoke.js` |
| T47 | DB 에서 실제로 제거 — `sentences.note` DROP COLUMN + `tags`·`sentence_tags` DROP TABLE 마이그레이션 | DONE | `main/db/schema.js` |

- **T46(요청 그대로)**: 문장 노트 표의 `태그` 컬럼, 문장 수정 모달의 메모·태그 입력, 수동 입력 모달의 같은 필드, 분석 카드의 주요 표현·예문을 전부 뺐다. 저장 페이로드(`sentences:create`/`sentences:update`)와 IPC 반환에서도 `note`/`tags` 를 없애 화면에만 안 보이고 계속 저장되는 상태를 만들지 않았다.
- **T46(용어 구분)**: 없앤 것은 **문장 메모(`sentences.note`)와 태그**다. 분석 카드의 `structure[].note`(구문 설명, 예: "want to + 동사원형")는 **다른 것**이므로 그대로 유지했다. `renderer/js/components/notes-table.js` 의 수정 모달도 `part | meaning | note` 3열 텍스트 그대로다.
- **T46(공유·데모·테스트까지)**: `main/share.js` 의 JSON/Markdown/HTML 내보내기와 병합에서 태그·메모를 빼고, `main/demo-data.js` 의 태그 시드(`tagId()`·`linkTag()`)와 문장 `note` 값을 제거했다. `test/db.test.js`(테이블 목록·CRUD·내보내기 단언), `test/ai-parse.test.js`(expressions/examples 9개 블록), `scripts/smoke.js`(태그 관련 expect 2건)도 함께 정리했다.
- **T47(실제 제거)**: 스키마에 두 번째 마이그레이션 `dropSentenceNoteAndTags` 를 추가해 `DROP TABLE IF EXISTS sentence_tags;` → `DROP TABLE IF EXISTS tags;` → `ALTER TABLE sentences DROP COLUMN note;` 를 한 트랜잭션으로 실행한다. `initial` 마이그레이션의 CREATE 문은 **과거 DB 재현용으로 그대로 두고** 두 번째가 지운다(신규 DB 도 최종 상태는 동일).
- **T47(실측)**: 실사용 DB(`%APPDATA%\study-ted\study-ted.db`, 영상 2,358 · 자막 144 · 채널 1 · 문장 4) **사본**으로 마이그레이션을 실행해 `schema_version 1 → 2`, `note` 컬럼 `true → false`, `tags`·`sentence_tags` `[tags, sentence_tags] → []`, 행 수 `영상 2,358 / 자막 144 / 문장 4 / 채널 1` **전부 동일**(데이터 보존)을 확인했다. 살아 있는 실DB 는 사용자 앱이 이전 코드로 떠 있어 아직 `schema_version=1` 이며, **앱을 다시 켜면 자동으로 2로 올라간다**.
- 검증 요약: 문법 0 실패 · 단위 61/61 · 스모크 92/0(태그 expect 2건 제거로 94→92) · 채널 E2E 8/8(TED 6편 · 자막 6건) · 재생 E2E 6/6
- **14차 마무리**: `README.md` 주요 기능(4·5·6)과 문제 해결 표에 태그·메모 제거와 분석 카드 2항목(13차)을 반영했고, `_workspace` 에 D-032 와 14차 오류 기록을 남겼다. 검증용 userData(`smoke-userdata`, `e2e-userdata`, `e2e-player-userdata`)·스크래치(`migtest`, `dbstate.js`, `dbmeta.js`, `migrun.js`, `db-dump.js`)·내보내기 산출물(`smoke-export.json`, `smoke-export.md`)을 정리해 `_tmp` 에 스모크 PNG 9장과 `yt-dlp.exe` 만 남긴 뒤 `node --test` 61/61 · `npm run smoke` 92/0 · E2E 8/8·6/6 을 재확인했다.

## 15차 라운드 완료 기록 (2026-09-24)

사용자 피드백 1건(구문분석의 `structure` 가 **단어 하나씩** 쪼개져 나오고 **한국어 뜻이 비어 있다** — "Along / with / their / research")을 처리했다. (T48)

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T48 | 구문 항목에 **한국어 뜻(`meaning`) 필수** + **단어 단위 분할 금지**(3~6개 의미 덩어리) 규칙과 응답 검증·1회 교정, 화면 경고·재분석 버튼 | DONE | `main/ai/openrouter.js`, `renderer/js/components/analysis-card.js`, `renderer/css/views.css`, `renderer/js/actions.js`, `renderer/js/components/notes-table.js`, `test/ai-parse.test.js`, `scripts/smoke.js` |

- **T48(원인)**: 화면·저장 버그가 아니었다. 실사용 DB(`%APPDATA%\study-ted\study-ted.db`) 사본을 열어 보니 `sentences.id=5` 의 `analysis_json.structure` 가 `[{part:'Along',meaning:'',note:''}, {part:'with',...}, {part:'their',...}, {part:'research',...}]` 처럼 **단어 단위**였고 `meaning` 이 **전부 빈 문자열**이었다. 사용 모델은 무료 8B(`meta-llama/llama-3.1-8b-instruct`). 프롬프트에 "뜻을 비우지 말라"는 규칙도, "단어로 쪼개지 말라"는 규칙도 없었고 응답 검증은 `part` 의 한글만 봤다(13차).
- **T48(수정 1 — 프롬프트)**: `systemPrompt` 에 `Every structure item must also have a Korean "meaning" and a short Korean "note". Never leave them empty.` 를, `userPrompt` 에 `structure: 3~6 items … Never split the sentence into single words.` 와 `"meaning" … must never be empty` / `"note" … must never be empty` 를 넣었다.
- **T48(수정 2 — 검증)**: `findMissingMeaning()`(part 가 있는데 meaning 이 빈 항목을 지목)과 `findChunkingProblem()`(의미 덩어리 3개 미만은 통과, 6개 초과 또는 공백 없는 단일 단어가 절반 이상이면 `['structure']`)을 추가하고, `analysisIssues = [...findLanguageMismatch, ...findMissingMeaning, ...findChunkingProblem]` 로 묶었다.
- **T48(수정 3 — 1회 교정)**: `analyzeSentence()` 가 `analysisIssues` 로 이슈를 찾으면 `languageRepairPrompt()` 로 **1회** 재요청하고, 교정본의 이슈 수가 줄 때만 채택한다(13차 언어 오염 교정과 같은 경로). `normalizeAnalysis` 의 meaning 별칭에 `뜻`·`뜻풀이` 를 추가해 다른 키 이름으로 와도 받는다.
- **T48(수정 4 — 화면)**: `analysis-card.js` 에 `missingMeaningFields()` 를 두고 뜻이 빈 구문은 ` : 뜻 없음`(`.analysis__missing`, 노란색)으로, 있으면 ` : <뜻>`(`.analysis__meaning`)으로 그린다. 카드 상단에 "한국어 뜻이 비어 있습니다" 경고도 띄운다.
- **T48(수정 5 — 재분석)**: 이미 저장된 오염 분석은 소급 복구가 안 되므로, 문장 노트 목록에서 그런 문장에만 `AI 다시 분석`(`btn btn--sm btn--ai`) 버튼을 조건부 노출한다(`actions.reanalyzeSentence(pk, { sentence, videoTitle })`).
- **스모크 flake(같은 라운드)**: `view:learn AI 분석 결과 표시` 가 `analyze/box 없음` 으로 간헐 실패(2건)했다. 스모크 드라이버가 `ai.analyze` 를 스텁하기 **전에** 앞선 문장의 **실 AI 호출**이 아직 돌아 분석 버튼이 `분석 중…` 으로 잠겨 있었다. → `scripts/smoke.js` 에 `waitAnalyzeButton()`(120×50ms) 을 스텁 앞에 넣고 대기 루프를 100→240 으로 늘렸다. 이후 3회 연속 93/0.
- 검증 요약: 문법 0 실패 · 단위 **67/67**(뜻·분할 교정 6건 추가) · 스모크 **93/0** · 채널 E2E **8/8** · 재생 E2E **6/6** · 실키 실응답 검증(같은 문장이 4개 구문으로 묶이고 모든 `meaning` 이 한국어, `findMissingMeaning=[]`·`findLanguageMismatch=[]`)
- **알려진 한계**: 이미 저장된 단어 분할·뜻 없음 분석은 소급 복구되지 않는다. 문장 노트에서 `AI 다시 분석` 을 눌러야 한다(README 문제 해결 표에 안내).

## 16차 라운드 완료 기록 (2026-09-24)

사용자 요청 1건("버전 업그레이드 되면 자동으로 다운로드 받을 수 있도록 **홈상단에 버전표시** 해주고, 업데이트 있으면 있다고 표기하고 누르면 다운로드 되서 업데이트 되도록")을 처리했다. T24(HOLD) 를 닫고 T49·T50 을 추가했다.

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T49 | 빌드 파이프라인 + NSIS 설치본 설정 | DONE | `package.json`, `scripts/make-icon.js`, `scripts/prepare-bin.js`, `scripts/make-manifest.js`, `build/icon.png`, `build/icon.ico`, `.gitignore` |
| T50 | 홈 상단 버전 표시 + 업데이트 확인·다운로드·설치 | DONE | `main/update.js`, `renderer/js/components/update-banner.js`, `main/main.js`, `main/ipc.js`, `main/preload.js`, `main/db/settings.js`, `main/collect/ytdlp-manager.js`, `renderer/js/{api,state,actions,app}.js`, `renderer/js/views/{home,settings}.js`, `renderer/css/components.css`, `test/update.test.js`, `test/update-feed.test.js`, `scripts/smoke.js` |

- **T50(배경/제약)**: 렌더러는 loopback HTTP 로 서빙되며 CSP `connect-src 'self' youtube` 가 걸려 있어 **렌더러에서 외부로 나가는 통신이 불가능**하다. 그래서 업데이트 확인·다운로드는 전부 **메인 프로세스(Node `https`)** 에서 수행하고, 렌더러에는 `update:status` 이벤트로 상태만 밀어 준다.
- **T50(설계)**: 사용자가 설정에 **업데이트 정보 주소(JSON)** 를 넣으면 그 주소를 6시간마다(그리고 앱 시작 8초 후) 조용히 확인한다. 피드 형식은 `{ version, url, sha256, size, notes, pubDate }` 이고 `url` 은 절대/상대 모두 허용(상대면 피드 주소 기준으로 해석)한다. 새 버전이면 홈 상단 배너가 `새 버전 v1.0.1 이 있습니다` 로 바뀌고, 배너 버튼 한 번으로 내려받아 **설치 후 앱이 다시 시작**된다.
- **T50(상태 머신)**: `idle → checking → current | available → downloading → ready → installing | error`. 진행률은 256KB 단위로 emit 하고, 다운로드는 `<userData>/tmp/updates/<파일명>.part` 로 스트리밍한 뒤 **sha256 검증에 통과해야만** `ready` 로 넘어간다(실패 시 `.part` 삭제 + `UPDATE_HASH`).
- **T50(무결성/안정성)**: 302 리다이렉트 5회까지 추적, 피드 응답 1MB 상한, 정지 감지 60초(`STALL_TIMEOUT_MS`), 피드·다운로드 타임아웃 15초. 이미 받아 둔 설치 파일이 남아 있으면 재다운로드 없이 `ready` 로 재사용한다(`cleanupDownloads(keepVersion)` 로 정리).
- **T50(설치)**: 패키징된 앱에서는 조용한 설치를 위해 `apply-update.cmd` 를 만들어 `cmd /c` 로 띄운다. NSIS 특성상 `/D=<설치폴더>` 는 **그 줄의 끝까지가 경로**이므로 한 줄에 다른 명령을 붙이지 않고, `start "" /wait "<installer>" /S /D=<설치폴더>` → `start "" "<exe>"` → `del "%~f0"` 순서의 별도 줄로 쓴다. 개발 실행(`app.isPackaged === false`)은 설치할 대상이 없으므로 `UPDATE_DEV` 로 막고 설치 화면만 띄우지 않는다.
- **T50(설정)**: `설정 → 업데이트` 카드에 `현재 버전 v…` 표시, 피드 주소 입력/저장, **자동 확인**(`update.autoCheck`, 기본 켜짐)·**조용한 설치**(`update.silentInstall`, 기본 켜짐) 체크박스, `업데이트 확인`/`내려받기`/`지금 설치하고 다시 시작` 버튼을 넣었다. 피드 주소를 **지우면** 이전 `latest`/진행률이 즉시 비워지고 `idle` 로 돌아간다(다운로드·설치 중에는 유지).
- **T50(자동 확인 조건)**: 주소가 없거나 `http`/`https` 가 아니면 자동 확인은 **아무 요청도 하지 않는다**(테스트로 요청 0회 확인). `update.lastCheckAt` 로 6시간 이내 재확인을 건너뛴다.
- **T49(번들)**: yt-dlp 는 `extraResources` 로 `resources/bin/yt-dlp.exe` 에 실어 나른다. `ytdlp-manager.detect()` 탐색 순서에 `<resources>/bin` 을 추가해 설치본에서도 yt-dlp 가 잡힌다(설정 경로 → `<userData>/bin` → `<resources>/bin` → `<rootDir>/bin` → PATH).
- **T49(산출물)**: `npm run dist` → `dist/StudyTED-Setup-1.0.0.exe` + `.blockmap` + `dist/latest.json`. 배너·설치본 모두 `app.getVersion()`(=`package.json` 의 `1.0.0`) 을 쓴다.
- 검증 요약: 문법 0 실패 · 단위 **81/81**(update 3 + update-feed 11 추가) · 스모크 **96/0**(home 버전 표시·업데이트 버튼, settings 업데이트 카드 3건 추가) · `npm run dist` 성공 · `dist/win-unpacked/resources/app.asar` 안에 `clearLatest`·`UPDATE_NO_FEED`·`apply-update.cmd`·`update-banner` 포함 확인
- **알려진 한계**: 사용자가 설정에 업데이트 정보 주소를 넣지 않으면 배너는 `업데이트 주소를 설정하면 새 버전이 나올 때 알려 드립니다.` 라고만 안내한다(자동 업데이트 서버를 앱에 내장하지 않는다).

## 17차 라운드 완료 기록 (2026-09-24)

사용자 요청 1건("니가 git 올려서 자동다운로드 하도록 해야지.. 내가 올려?")을 처리했다. 즉 **배포 주체를 개발자 서버에서 GitHub Releases 로 옮기고, 앱이 그 릴리스를 보고 스스로 업데이트하게** 만들었다. T51·T52 를 추가했다.

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T51 | GitHub 저장소 생성 + 첫 푸시 + v1.0.0 릴리스(설치본·blockmap·latest.json) 업로드 | DONE | `git`(init/commit/push), `.gitignore`, `.gitattributes`(기존), `.editorconfig`(기존) |
| T52 | 기본 업데이트 주소 내장 + `npm run release` 배포 자동화 | DONE | `main/db/settings.js`, `scripts/release.js`(신규), `package.json`, `build/release-notes.md`(신규), `README.md` |

- **T51(저장소)**: 이 폴더는 git 저장소가 아니었고, `gh` CLI 는 `pang980` 계정으로 이미 로그인돼 있었다(scopes `repo`·`workflow`). `git init -b main` → 첫 커밋 87개 파일 → `gh repo create study-ted --public --source . --remote origin --push`.
  - 저장소: <https://github.com/pang980/study-ted> (**public** — 로그인 없이 릴리스 자산을 받을 수 있어야 앱의 자동 업데이트가 동작한다)
  - 커밋에서 제외된 것: `.env`(키), `node_modules/`, `dist/`(122.9MB 설치본), `_tmp/`, `build/bin/yt-dlp.exe`(17MB). `.gitignore` 에 `.env`·`.env.*` 를 **새로 추가**했다(16차까지는 없었다).
  - 저장소 로컬 설정으로 `user.name=pang980` / `user.email=pang980@gmail.com` 을 지정했다(전역 값의 메일 오타 `gamil.com` 때문에 커밋이 계정에 연결되지 않는 것을 피하려고 **이 저장소에만** 적용).
- **T51(릴리스)**: `gh release create v1.0.0 dist\StudyTED-Setup-1.0.0.exe dist\StudyTED-Setup-1.0.0.exe.blockmap dist\latest.json` 로 3개 자산 업로드. 태그 `v1.0.0`, 제목 `StudyTED v1.0.0`.
  - 피드 주소: `https://github.com/pang980/study-ted/releases/latest/download/latest.json` → 실제로 200 + JSON 응답 확인.
  - 자산 주소: 같은 경로의 `StudyTED-Setup-1.0.0.exe` → 200 확인. GitHub 이 보고한 자산 `digest`(`sha256:078f2fdff6…`)와 `latest.json` 의 `sha256` 이 일치했다.
- **T52(기본 주소)**: `main/db/settings.js` 의 `DEFAULTS` 에 `DEFAULT_UPDATE_FEED_URL` 상수를 넣어 `update.feedUrl` 기본값으로 썼다. 16차의 "주소를 넣어야만 업데이트를 확인한다"는 한계를 없애 **설치만 하면 자동 확인이 동작**한다. `getValue` 는 DB 행이 없으면 `DEFAULTS` 를 돌려주므로 기존 사용자 DB 에도 그대로 적용된다(마이그레이션 불필요).
- **T52(배포 자동화)**: `scripts/release.js` + `npm run release`. 사전 점검(`gh auth status`, `origin` 원격) → `npm run dist` → `dist/latest.json` 의 `version` 이 `package.json` 과 같은지 확인 → 자산 3개 존재 확인 → 같은 태그가 있으면 `gh release upload --clobber` + `gh release edit --notes-file`, 없으면 `gh release create`. 마지막에 피드 주소를 출력한다.
- **T52(주의)**: `gh`·`git` 은 `.exe` 라 `shell:false` 로 실행하고(Node 가 인자 인용을 처리하므로 `--title "StudyTED v1.0.0"` 같은 공백 인자가 안전), `npm` 만 `.cmd` 라서 `shell:true` 로 실행한다.
- 검증 요약: `npm test` **81/81** · `npm run smoke` **96/0** · `npm run dist` 성공(asar 안에 새 기본 주소 포함 확인) · `npm run release` **실제 실행 성공**(v1.0.0 자산 덮어쓰기 + 피드 sha256 갱신 확인).
- **한계**: 저장소를 비공개로 바꾸면 로그인 없이 자산을 받을 수 없어 자동 업데이트가 멈춘다(이때는 직접 호스팅한 `latest.json` 주소를 설정에 넣어야 한다). 코드 사이닝은 여전히 하지 않아 설치 시 SmartScreen 경고가 뜰 수 있다.

## 18차 라운드 완료 기록 (2026-09-24)

사용자 요청 4건(① AI 분석이 선택한 문장이 아니라 **동영상 제목**을 해석함 ② 문장 노트에서 **문장을 누르면 내용 바로 보기** ③ **삭제 버튼 무동작** ④ **분석 보기가 지정 높이에서 잘림**)을 처리했다. T53~T56 을 추가했다.

| 태스크 | 내용 | 상태 | 수정 파일 |
|---|---|---|---|
| T53 | AI 분석 대상이 동영상 제목으로 새는 문제 수정 | DONE | `main/ai/openrouter.js`, `test/ai-parse.test.js` |
| T54 | 문장 노트: 문장 클릭으로 해석·구문 분석 상세 열기 | DONE | `renderer/js/components/notes-table.js`, `renderer/css/views.css` |
| T55 | 삭제 버튼 무동작(확인 창이 항상 취소로 확정) 수정 | DONE | `renderer/js/ui.js`, `renderer/js/components/notes-table.js` |
| T56 | 분석 보기 펼칠 때 목록 높이 제한 해제 + 검증 추가 | DONE | `renderer/js/components/notes-table.js`, `renderer/css/views.css`, `scripts/smoke.js` |

- **T53(원인)**: 전달 경로(`main/ipc.js` → `renderer/js/actions.js` → `api.ai.analyze`)는 정상이었다. `userPrompt()` 가 `Video title:` / `Surrounding context:` 를 `Sentence:` **바로 앞**에 두고 있었고, 지시문이 "문장을 분석하라"는 한 줄뿐이라 약한 모델(llama-3.1-8b)이 가장 가까운 제목을 대상으로 삼았다. 실제 DB 에 `sentences.id=4` 의 `translation` 에 동영상 제목(`고양이가 왜 미치지 않는가? - Jaap de Roode`)이 저장돼 있었다.
- **T53(수정)**: `systemPrompt()` 에 "분석 대상은 항상 `Sentence:` 로 시작하는 한 줄이고 제목·문맥은 참고용" 두 문장을 추가하고, `userPrompt()` 는 제목·문맥을 `Reference only (never translate or analyze these):` 블록으로 묶어 **위로 올리고**, `Analysis target:` 안내와 `Sentence:` 를 **메시지 맨 끝**에 배치했다. 제목·문맥이 없으면 `Reference only` 줄 자체를 출력하지 않는다.
- **T54(수정)**: 상세 행(`tr.is-detail`)을 **분석이 저장된 행에만** 만들던 것을 **모든 행에 항상** 만들도록 바꿨다. 상세 본문은 `.detail-body` 안에 문장 전체(`.detail-sentence`) · 해석(`.detail-translation`, 있을 때) · 저장된 분석 카드(또는 "저장된 AI 분석이 없습니다. …" 안내) 순서로 쌓는다. 문장 셀(`.cell-sentence.is-clickable`)을 누르면 `toggleDetail()`, `분석 보기` 버튼을 눌러도 같은 상세가 열린다.
- **T55(원인)**: `confirmDialog()` 가 `dialog.close()` 를 **먼저** 부르고 `resolve(true)` 를 나중에 불렀는데, `close()` 가 `onClose: () => resolve(false)` 를 동기로 실행해 **확인을 눌러도 항상 `false`** 로 확정됐다(그래서 삭제가 조용히 취소됐다). 내보내기 다이얼로그도 같은 순서 문제가 있었다.
- **T55(수정)**: `settled` 플래그 + `done(value)` 로 "처음 확정한 값 하나만" 남기게 했다. 확인 → `done(true)` → `close()`, 취소 → `done(false)` → `close()`, `onClose` → `done(false)`. 내보내기 다이얼로그는 `resolve` 를 `close()` 앞으로 옮겼다.
- **T56(수정)**: `.table-wrap` 의 `max-height: 360px` 때문에 펼친 분석이 잘렸다. `NotesTable` 이 감싸는 요소를 `this.tableWrap` 으로 기억하고, 상세가 하나라도 열려 있으면 `is-expanded`(`max-height: none`)를 켠다. 행을 다시 그리면(`renderRows`) 클래스를 먼저 지워 원래 높이로 돌린다.
- **T56(검증 추가)**: 스모크에 3건 추가 — 상세 행 수(`detailRows`)=`rows` 이면서 분석 카드·버튼·요약이 서로 일치, **문장 클릭으로 상세 토글**, **분석 보기 펼칠 때 `max-height: none` + 본문 높이 > 40px**, 그리고 `runViewChecks` 뒤에 **삭제 버튼 → 확인 창 → 실제 삭제(4 → 3)** 확인.
- 검증 요약: 문법 0 실패 · 단위 **82/82**(T53 회귀 테스트 1건 추가) · 스모크 **99/0**(기존 96 + 3건, 이전 라운드의 `notes` 단언을 새 동작에 맞게 조정)
- **남은 정리(사용자 선택)**: 기존에 오염된 행(`sentences.id=4` 해석=동영상 제목, `id=5` 구문이 단어 단위 + 한국어 뜻 빈 값)은 앱에서 그 줄의 `AI 다시 분석` 버튼을 누르면 새 프롬프트로 교정된다. 삭제한 `id=1`(`scale a cheery`)처럼 앞뒤가 잘린 문장도 같은 경로로 다시 분석하면 된다.
