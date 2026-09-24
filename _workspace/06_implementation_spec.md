# Implementation Spec

## 1. 프로세스 구조

    main (Node, 전체 권한)
      ├─ ipc.js        : ipcMain.handle 등록 (채널별 단일 책임)
      ├─ db/           : node:sqlite
      ├─ collect/      : yt-dlp + native provider
      ├─ ai/           : OpenRouter
      └─ share.js      : 파일 내보내기/가져오기

    preload.js  : contextBridge 로 window.studyTed 노출 (화이트리스트만)

    renderer (Chromium, loopback HTTP(127.0.0.1:임의 포트) 로 로드, Node 접근 불가)
      ├─ css/  : tokens → base → layout → components → views
      ├─ js/   : app(라우터) / state / api / ui / player
      ├─ js/components/ : transcript, sentence-panel, notes-table, study-workspace
      └─ js/views/      : home, channels, learn, notes, materials, share, settings

## 2. 보안 정책

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- `webPreferences.preload` 만 허용. `enableRemoteModule` 미사용
- `will-navigate` / `setWindowOpenHandler` 로 외부 이동 차단 → `shell.openExternal`
- CSP: `default-src 'self'; script-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self'`
- 렌더러는 `http://127.0.0.1:<임의 포트>` 에서만 서빙한다(`listen(0, '127.0.0.1')`). Host 헤더가 다르면 403, 정적 자산 외 경로는 404
- 커스텀 스킴을 쓰지 않는 이유: Chromium 이 커스텀 스킴 요청에 Referer 를 붙이지 않아 YouTube 임베드가 error 153 으로 재생을 거부한다(D-011)
- IPC 는 `invoke/handle` 만 사용. 렌더러가 임의 채널을 호출할 수 없도록 preload 에서 화이트리스트 매핑
- API 키는 `safeStorage.encryptString` → base64 로 DB 저장. 렌더러에는 `hasKey` + 마스크만 전달

## 3. 데이터베이스

파일: `app.getPath('userData')/study-ted.db` (`PRAGMA journal_mode=WAL`, `foreign_keys=ON`)

    channels(id PK, channel_id UNIQUE, handle, title, url, avatar_url,
             subscriber_text, video_count_text, description, created_at, updated_at, last_synced_at)

    videos(id PK, video_id UNIQUE, channel_pk FK, channel_id, title, url,
           duration_sec, duration_text, view_count_text, published_text,
           thumbnail_url, description, has_transcript, created_at, updated_at)

    transcripts(id PK, video_id UNIQUE, video_pk FK, lang, kind, source,
                segments_json, plain_text, segment_count, created_at, updated_at)

    sentences(id PK, video_pk FK, video_id, video_title, video_url, channel_pk,
              sentence, translation, analysis_json, note, source, start_sec,
              is_favorite, study_count, created_at, updated_at)

    tags(id PK, name UNIQUE, created_at)
    sentence_tags(sentence_pk, tag_pk, PRIMARY KEY(sentence_pk, tag_pk))
    settings(key PK, value, is_secret, updated_at)
    meta(key PK, value)   -- schema_version 등

인덱스: `videos(channel_pk)`, `sentences(video_pk)`, `sentences(is_favorite)`, `sentences(created_at)`

마이그레이션: `schema.js` 의 배열을 순서대로 적용하고 `meta.schema_version` 에 기록.

## 4. 수집 (collect)

### 4.1 provider 선택

    설정 collect.provider = auto | ytdlp | native
    auto: yt-dlp 사용 가능하면 ytdlp, 아니면 native

### 4.2 yt-dlp

- 탐지 순서: 설정 경로 → `bin/yt-dlp.exe`(프로젝트) → userData `bin/yt-dlp.exe` → PATH(`yt-dlp`, `yt-dlp.exe`)
- 다운로드: GitHub releases `latest/download/yt-dlp.exe` → userData `bin/` 에 저장
- 목록: `--flat-playlist --dump-json --playlist-end N`
- 메타: `--dump-single-json --no-warnings`
- 자막: `--skip-download --write-subs --write-auto-subs --sub-langs "en.*,ko.*" --sub-format json3/vtt -o <tmp>/%(id)s.%(ext)s`
- 실행은 `spawn` + 인자 배열(셸 미사용), 타임아웃·취소 지원

### 4.3 native

- 채널: `https://www.youtube.com/<path>` HTML → `externalId`, `og:title`, `og:image`, 설명, 구독자/영상수 텍스트
- 목록: Innertube `browse` (`browseId`, params=동영상 탭) → `lockupViewModel`/`richItemRenderer` 순회 + continuation
- 영상: watch HTML 의 `ytInitialPlayerResponse` 추출 → 제목/길이/조회수/설명/자막 트랙 목록
- 자막 본문: captionTracks.baseUrl + `&fmt=json3` 시도 → 실패 시 명시적 오류 반환

### 4.4 파서 (`subtitle-parser.js`)

지원 형식: json3, vtt, srt, srv3/xml, 평문
공통 출력: `[{ start:Number, end:Number, text:String }]`

정규화 규칙:
- json3: `events[].segs[].utf8` 결합, `aAppend` 이벤트/빈 텍스트 제거, 연속 중복 제거
- vtt/srt: 타임코드 → 초 변환, 태그(`<c>`, `<v>`, `{\an8}`) 제거, 중복 라인 병합
- 평문: 줄 단위 → 시간 없음(`start:null`), 문장 분리

### 4.5 진행 이벤트

`collect:progress` 로 `{ jobId, phase, done, total, message }` 전송. `collect:cancel` 로 중단.

### 4.6 재수집 정책 (`refreshExisting`)

- 설정 키: `collect.refreshExisting` (기본 `'1'` = 켜짐). `settings:update` 로 저장, `settings:get` 응답에 불리언으로 노출
- 켜짐: 이미 저장된 영상도 제목·URL·조회수·썸네일 등 메타를 최신값으로 덮어쓴다
- 꺼짐: `videosDb.upsert(video, { refresh: false })` → SQLite `ON CONFLICT DO NOTHING` 으로 기존 행을 보존하고 신규 영상만 추가한다
- 자막은 옵션과 무관하게 "이미 있으면 건너뛴다"(`transcriptsDb.getByVideoId`)
- 결과: `syncChannel` 이 `{ addedCount, keptCount, refreshExisting }` 반환, 진행 메시지 `동영상 N개(신규 M개) · 기존 K개 정보 유지 · 자막 J개 저장`

## 5. AI (OpenRouter)

- Base URL: `https://openrouter.ai/api/v1`
- 모델 목록: `GET /models` → `{ id, name, context_length, pricing }`
- 분석: `POST /chat/completions`, `response_format: { type: 'json_object' }`
- 프롬프트 결과 스키마:

    {
      "translation": "한국어 해석",
      "structure": [{ "part": "구문", "meaning": "의미", "note": "설명" }],
      "expressions": [{ "phrase": "표현", "meaning": "뜻" }],
      "examples": [{ "en": "예문", "ko": "해석" }]
    }

- 응답 정규화: 코드펜스 제거 → JSON.parse → 누락 키 기본값 채움 → 실패 시 원문을 `raw` 로 보존
- 사용 기록: `settings` 에 `ai.usage.<modelId>` 카운터 증가 → "자주 쓰는 모델" 산출

## 6. 공유 (share)

| 형식 | 내용 |
|---|---|
| JSON | 전체 스키마(채널/영상/자막/문장/태그) — 재가져오기 가능 |
| Markdown | 영상별 문장 + 해석 + 태그 (사람이 읽기용) |
| HTML | 자체 완결형 문서 (스타일 내장, 인쇄 가능) |
| CSV | 문장/해석/출처/태그/저장일 |

가져오기(JSON): `video_id` + `sentence` 기준 중복 병합. 태그 합집합. 실패 항목은 결과 요약으로 반환.

## 7. 렌더러 UI (UI.png 기준)

- 창: `frame: false`, 타이틀바 높이 44px, 배경 `#243654`
- 사이드바 폭 178px, 항목: 홈 / 채널 관리 / 학습하기 / 문장 노트 / 학습 자료 / 공유하기 / 설정 + 하단 `오늘의 한마디`
- 선택 항목: pill `#d2e4fc`
- 페이지 배경 `#f0f6f6`, 카드 `#fcfcfc`, 모서리 8px
- 주요 색: primary `#1e6ff5`, AI `#5b4bd6`, 선택 배경 `#ebf2fe` / `#e3edf8`
- 홈 뷰 구성(위→아래): 채널 입력 바 → 채널 카드(아바타/정보/영상 4개) → 3열(플레이어+영상정보 / 자막 패널 / 선택 문장 저장 + AI 분석) → 학습한 문장 목록 테이블
- 재생 모드: `듣기`(cc_load_policy=0) / `자막`(cc_load_policy=1). 모드 전환 시 현재 시간 유지하며 플레이어 재생성
- 자막 패널: 세그먼트 목록, 현재 시간 구간 하이라이트, 자동 스크롤, 클릭 시 해당 시점 이동, 드래그 선택 → 문장 패널로 전달
- 학습한 문장 목록: 검색 / 전체 채널 / 전체 태그 / 최신순 필터, ★ 즐겨찾기, 내보내기 버튼
- 학습하기 동영상 선택 목록: 항목당 `96px 썸네일 + 제목(2줄) + 메타(조회수·게시일·자막 유무, 2줄)` 그리드. 창 폭 ≤1360px 에서는 목록 244px / 썸네일 84px 로 줄인다
- 설정: OpenRouter 키, 모델(자주 쓰는·즐겨찾기), provider, 수집 개수, 자막 수집, **기존 영상 정보 다시 가져오기(`refreshExisting`)**, yt-dlp 경로/다운로드

## 8. 오류 처리 원칙

- 모든 IPC 핸들러는 `{ ok: false, error: { code, message, detail } }` 로 정규화
- 수집 실패는 단계(채널/목록/메타/자막)를 명시해 사용자가 원인을 알 수 있게 한다
- 네트워크 오류 메시지에 API 키·요청 본문의 비밀값을 포함하지 않는다
- UI 는 토스트 + 인라인 재시도 버튼 제공

## 9. 로그

- 위치: `userData/logs/app.log`
- 형식: `[ISO] LEVEL scope message`
- 기록 금지: API 키, 요청 Authorization 헤더, .env 값

## 10. 전체 수집(개수 제한 해제)

- 설정 `collect.collectAll`(기본 `1`)이 켜져 있으면 수집 개수 제한이 없다. 렌더러는 `actions.resolveCollectLimit()` 로 `'all'` 을 만들고, IPC 는 `collectLimit: 'all'` 또는 `0` 을 `collect.limit = 'all'` 로 저장한다.
- 메인은 `resolveLimit(raw)` 로 값을 해석한다. `''`, `null`, `undefined`, `'all'`, `0 이하`, 숫자가 아닌 값 → `Infinity`(무제한), 그 외 → 내림 정수.
- **yt-dlp**: 무제한이면 `--playlist-end` 를 붙이지 않고 타임아웃을 30분으로 늘린다(유한하면 `--playlist-end N`, 5분). 진행률은 `--dump-json` 라인 수를 세어 표시한다.
- **native**: 무제한이면 페이지 상한을 150(≈4,500개)까지 허용하고, 유한하면 `max(6, ceil(limit/30)+1)` 페이지로 제한한다.
- 진행 `total` 은 유한할 때만 값을 채우고 무제한이면 0으로 두어 UI 가 "확인 개수"만 보여준다.

## 11. 채널별 / 전체 수집 (채널 관리 화면)

- 채널 목록 헤더에 **전체 채널 수집**, 각 행에 **수집** 버튼을 둔다.
- 두 버튼은 같은 순차 큐(`collectChannels`)를 사용한다. 큐가 돌고 있으면 다른 수집 버튼과 채널 불러오기 버튼을 잠그고 취소 버튼을 노출한다.
- 행 상태: `수집 중… (i/n)` → `완료 · 신규 N개 · 자막 M개` / `실패 · 메시지` / `취소됨`. 상단 진행 바는 채널 단위 진행(`(i/n)`)을 보여주며, 채널 내부 진행률(`done/total`)은 행 상태에 함께 표기한다.
- 전체 수집이 끝나면 채널 목록과 상태 카드를 다시 읽고, 채널 수·신규 영상 수·자막 수를 집계해 토스트 한 번으로 알린다. 한 채널이 실패해도 다음 채널을 계속 수집한다.

## 12. 자막 오버레이 레이어 규칙

- `.player-frame` 의 자식 크기 100% 규칙은 **비디오를 채우는 요소**(`iframe`, `.player-host`, `.player-note`)에만 적용한다. `.player-caption` 을 포함하면 자막 상자가 프레임 전체를 덮는 반투명 레이어가 된다.
- 자막 상자는 `left/right/bottom: 10px` + `height: auto` + `max-height: 60%` 로 내용만큼만 커지고, `pointer-events: none` 으로 클릭을 막지 않는다.

## 13. 채널별 수집 개수

- `channels` 조회 SQL 은 `COLUMNS` 상수 하나를 공유한다. 여기에 상관 서브쿼리 3개를 붙였다.
  - `savedVideoCount`: `videos.channel_pk = channels.id` 인 영상 수
  - `savedTranscriptCount`: 해당 채널 영상에 연결된 `transcripts` 수(자막을 실제로 저장한 영상 수)
  - `savedSentenceCount`: `sentences.channel_pk = channels.id` 인 저장 문장 수
- 조회 경로(`list()`, `getByPk()`, `getByChannelId()`, `touchSync()`)가 모두 같은 컬럼을 함께 돌려주므로 IPC·화면에서 추가 조회를 하지 않는다. 값이 없으면 `Number(...) || 0` 으로 0으로 표시한다.
- 채널 관리 행은 `수집 동영상 N개 · 자막 N개 · 저장 문장 N개` 한 줄(`.channel-counts`)을 제목 아래에 표시한다. 수집이 끝나면 목록을 다시 읽어 갱신한다.

## 14. 자막 줄 동작 (전송 버튼 / 클릭 재생)

- 자막 줄 구조: `[시간(.transcript-line__time)] [문장(.transcript-line__text)] [문장 전송(.transcript-line__send)]`.
- **문장 전송** 버튼: `onSend({ text, start })` 를 호출해 오른쪽 문장 패널의 영어 문장 입력값을 그 문장으로 채운다. 버튼 클릭은 `event.stopPropagation()` 으로 줄 클릭과 분리되고, 이미 전송한 문장은 `.is-active` 로 표시한다.
- **줄 본문 클릭**: `onSeek(segment.start ?? 0)` → `study-workspace.replayFrom(seconds)` → `player.seekTo(seconds)` + `player.play()`. `seekTo` 만으로는 일시정지 상태가 유지되므로 재생을 함께 시작한다.
- 문장을 **드래그로 선택**하면 `onSelect({ text, startSec })` 로 입력값만 채우고 포커스는 유지한다(타이핑 중 포커스 탈취 방지).

## 15. 모델 가격 표시와 검색/추천

- 가격 파생은 메인 프로세스 한 곳(`main/ai/openrouter.js`)에서만 계산해 `ai:models` 응답에 실어 보낸다(IPC 추가 없음). OpenRouter `/models` 의 `pricing.prompt`/`pricing.completion`(USD / 1 token)을 **1M 토큰당 USD** 로 환산한다.
- 표기는 자리 폭에 따라 둘로 나눈다. 넓은 자리는 `입력 $0.15 · 출력 $0.6 / 1M`, 좁은 자리(`<select>` option, 즐겨찾기 행)는 `$0.15/$0.6`.
- 단가 `0` 은 `무료`, 라우팅 모델처럼 단가가 음수(`-1`)인 경우는 `가격 정보 없음`/`가격 미정` 으로 **무료와 구분**한다. "가격 미정" 을 0원으로 취급하면 가성비 순위가 왜곡된다.
- **가성비 추천**: 입력 40% · 출력 60% 가중 평균 점수가 낮은 순 상위 5개. 각 행에 `가성비 N위` 뱃지.
- **모델 검색**: 이름·ID 부분 일치(대소문자 무시), 최대 200개 표시, `검색 결과 N개 / 전체 M개` 안내.
- 두 목록 모두 항목 클릭 = 기본 모델 설정, 현재 선택된 모델 행은 `.model-row--on` 으로 강조한다. 렌더러는 목록 서명이 바뀔 때만 다시 그린다.

## 16. 수집 취소 (즉시 중단)

- 취소 상태는 `main/collect/job-registry.js` 가 jobId 단위로 관리한다. `begin(jobId)` → `AbortController` 생성, `cancel(jobId)` → `controller.abort()` + 플래그, `assertNotCancelled(jobId, signal)` → 루프 경계 검사, `end(jobId)` → 정리.
- **핵심 규칙: signal 을 자식 프로세스와 네트워크 호출까지 전달한다.** 루프 경계 검사만 하면 자막 1건(yt-dlp 자식 프로세스, 최대 150초)이 끝날 때까지 정지가 먹지 않는다.
  - `net.fetchText(url, { signal })`: 진입 시 `signal.aborted` 면 즉시 `CANCELLED` throw, 외부 signal → 내부 controller 브리지, abort 시 재시도 금지, `finally` 에서 리스너 제거.
  - `ytdlp-manager.run(exePath, args, { signal })`: abort 시 `child.kill()`, `code='CANCELLED'`.
  - `ytdlp-provider` 와 `native-provider` 의 목록·메타·자막 호출은 모두 `options.signal` 을 받아 넘긴다.
- 취소 오류는 `code:'CANCELLED'` 하나로 통일한다. `renderer/js/api.js` 가 `error.detail` 을 복원하고, 화면은 `error.detail.cancelled === true` 로 "정지" 와 "실패" 를 구분한다.
- **부분 결과 보존**: 취소 시점까지 저장된 영상·자막·문장은 삭제하지 않는다. `syncChannel` 은 `{ cancelled:true, videos, addedCount, transcriptCount }` 를 돌려주고 같은 값이 `error.detail` 에도 실린다(채널 행 상태 `취소됨`).
- 진행 이벤트는 취소 시 `phase:'cancelled'` 로 한 번 더 emit 해 렌더러가 즉시 상태를 바꿀 수 있게 한다.
- UI: 채널 관리 진행 바 행에 **수집 정지**(`.btn--sm.btn--danger`, `flexShrink:0`) 버튼. `paintCancelButtons(busy)` 가 진행/전체 수집/정지 세 버튼의 hidden·disabled·문구를 한 곳에서 관리하며, 정지 요청 후 문구는 `정지하는 중…` 이 된다. 진행 문구는 `flex:1;minWidth:0` 으로 말줄임되고, 정지 버튼은 항상 보이도록 고정 폭을 유지한다.

## 17. 자막 수집 처리량 (동시 수집)

- 자막 단계는 `collectSubtitles(context)` 워커 풀로 돌린다. 워커 N개가 남은 영상을 하나씩 집어 `ytdlp-provider` / `native-provider` 의 자막 호출을 실행한다.
- 동시 개수는 설정 `collect.concurrency`(기본 `4`, 허용 1~8)이며, `resolveConcurrency()` 가 비정상 값(0·NaN·음수)을 기본값으로 되돌린다. 실제 동시 개수는 `min(설정값, 남은 영상 수)` 다.
- **취소 계약은 그대로다.** 워커는 같은 `AbortSignal` 을 공유하고 루프 선두에서 `assertNotCancelled` 를 다시 확인한다. 정지를 누르면 진행 중인 자식 프로세스가 동시에 죽고 대기 중인 워커는 새 작업을 시작하지 않으며, 이미 받은 자막은 남는다.
- 편 단위 임시 폴더: `tmp/collect-<jobId>/<videoId>` 에 내려받고 끝나면 `clearVideoDir()` 로 지운다. 동시 실행에서 서로의 파일을 지우거나 남의 자막을 집어오지 않는다.
- 받는 파일 수를 줄인다: `--sub-langs en` 을 먼저 시도(정확히 1개), 파일이 하나도 안 생기면 넓은 패턴(`en.*,en`)으로 **1회만** 재시도한다. 저장되는 `kind` 는 `asr` 대신 `null` 이다.
- 실측(TED 영상 6편): 순차 55,628ms(편당 9,271ms) → 동시 4 24,307ms(편당 4,051ms) = **2.29x**. `--batch-file` 단일 프로세스는 1.37x 였지만 편당 타임아웃·진행률·정지 즉시성이 사라지므로 채택하지 않았다.
- 진행 이벤트는 `subtitle i/n · 남은 K개` 형식이며 동시 실행에서도 완료 순서대로 하나씩 emit 된다.

## 18. 내부 진단 카드 노출 규칙

- 채널 관리 상단의 `수집 환경` 카드는 진단용이므로 기본 상태가 `hidden` 이다.
- 예외는 하나뿐이다. `settings.preference === 'ytdlp' && !ytdlp.available` — yt-dlp 를 쓰기로 했는데 yt-dlp 가 없어 수집이 **불가능한** 경우에만 자동으로 나타나 내려받기를 유도한다.
- 같은 정보와 `yt-dlp 내려받기` 는 설정 화면에 있으므로 기능이 사라지지 않는다. 노출 여부는 `refreshStatus()` 끝에서 한 곳에서만 정한다.

## 19. 문장 누적과 AI 분석 즉시 저장

- **누적**: `SentencePanel.appendSentence(text, { focus, startSec })` 가 입력칸을 **덮어쓰지 않고** 줄 단위로 덧붙인다. 이미 있는 줄(앞뒤 공백 정리 후 동일)은 추가하지 않고 `false` 를 돌려준다. 호출부(`study-workspace.selectSentence` / `sendSentence`)는 그 값으로 `문장을 오른쪽 문장 패널에 추가했습니다.` 와 `이미 문장 패널에 있는 문장입니다.` 를 구분해 알린다.
  - `setSentence()` 는 저장된 문장을 다시 여는 경로 전용으로 남겨 **덮어쓰기**를 유지한다. 두 의미를 섞지 않는다.
  - `startSecs: Map<문장, 시작초>` 에 전송 시점의 재생 위치를 기록하고 저장할 때 `startSecFor()` 로 문장별 값을 쓴다. 전역 선택 시각으로 폴백하지 않는다.
- **AI 즉시 저장**: `actions.analyzeAndSaveSentence()` 가 `api.ai.analyze` → `api.sentences.create({ source:'ai', translation, analysis, startSec, videoPk/videoId/videoTitle/videoUrl/channelPk })` → `loadSentences()`·`loadInfo()`·`videoSentences` 갱신 → `{ ...result, saved }` 반환까지 한 번에 수행한다. 저장된 문장은 입력칸에서 사라지고 분석 결과는 패널에 그대로 남는다.
- 한 번에 최대 `MAX_ANALYZE_LINES = 5` 문장을 처리한다. 초과분은 입력칸에 남기고 안내 토스트를 띄운다. 진행 중 버튼 문구는 `분석 중… i/n`, 완료 시 `AI 분석 결과 N건을 노트에 저장했습니다.` 토스트가 뜬다.
- 수동 입력(`manualInput`)과 `analyzeSentence`(저장된 문장 단위 분석)는 기존 경로 그대로다. IPC·스키마 변경이 없다.

## 20. 동영상 선택 목록 검색과 페이징

- **목록 조회(메인)**: `videosDb.list({ channelPk = null, q = '', limit = 100, offset = 0 })` 은 `buildFilter()` 가 만든 같은 조건으로
  `SELECT … FROM videos v LEFT JOIN channels c … WHERE v.channel_pk = ? AND (v.title LIKE ? ESCAPE '\' OR v.description LIKE ? ESCAPE '\') ORDER BY v.created_at DESC, v.id DESC LIMIT ? OFFSET ?` 를 실행하고 **배열**을 돌려준다(기존 계약 유지).
- **개수(메인)**: `videosDb.count({ channelPk = null, q = '' })`. 인자 없이 부르면 전체 개수(기존 계약 유지), 조건을 주면 그 조건의 개수다. `list` 와 같은 `buildFilter` 를 쓰므로 `N개 중 i–j` 가 어긋나지 않는다.
- **LIKE 이스케이프**: `escapeLike()` 가 `\`, `%`, `_` 를 `\` 로 이스케이프하고 SQL 은 `ESCAPE '\'` 를 쓴다. 사용자가 `%` 를 검색해도 전체가 매칭되지 않는다.
- **IPC**: `main/ipc.js` 의 `videoQuery(payload)` 가 `channelPk`(1 이상 정수 또는 null), `q`(최대 200자, 기본 `''`), `limit`(1~2000, 기본 100), `offset`(0 이상, 기본 0)을 검증한다.
  - `videos:list` → `videosDb.list(videoQuery(payload))` (배열)
  - `videos:page` → `{ items, total, offset, limit, hasMore }`. `hasMore = offset + items.length < total`.
- **브리지**: `main/preload.js` `videos.page`, `renderer/js/api.js` `api.videos.page(payload)`. `videos.list` 는 호환용으로 남긴다.
- **렌더러 상태**: `state.videoPage = { q, offset, limit, total, hasMore, loading }`. `state.videos` 는 **현재 페이지 항목**을 뜻한다(홈 화면은 `GRID_LIMIT = 4` 로 앞 4편만 사용 — 회귀 없음).
- **렌더러 액션**: `VIDEO_PAGE_SIZE = 50`, `defaultVideoPage(patch)`, `loadVideoPage({ channelPk, q, offset, limit })`.
  - `loadVideoPage` 는 `videoPageToken` 을 증가시켜 **최신 요청의 응답만** 반영한다(빠른 타이핑에서 이전 결과가 덮어쓰지 않게).
  - 채널이 없으면 조회 없이 빈 페이지로 초기화한다.
  - `loadVideos(channelPk)` 는 첫 페이지 로더로 위임하고 `page.items` 를 돌려준다(기존 호출부 유지). `selectChannel`/`loadChannels`/`removeChannel` 은 `videoPage` 를 초기화한다.
- **화면(`renderer/js/views/learn.js`)**: 픽커 카드 본문 최상단에 검색 입력(`.input.input--search.picker-search`, placeholder `동영상 제목으로 검색`)을, 그 아래에 채널 드롭다운, 목록, 그리고 `.picker-pager`(`‹ 이전` / `n / 총페이지` / `다음 ›`)를 둔다.
  - 입력은 260ms 디바운스, `Enter` 는 즉시 실행. 채널을 바꾸면 진행 중 타이머를 취소하고 검색어를 비운다.
  - 카드 헤드의 `.picker-count` 는 로딩 중 `불러오는 중…`, 검색 중 `검색 결과 N개 중 i–j`, 아니면 `전체 N개 중 i–j`.
  - 페이지 이동 시 목록 스크롤을 맨 위로 올린다. 조회 실패는 토스트로 알린다.
  - 빈 목록 문구: 검색어가 있으면 `"q" 검색 결과가 없습니다.`(🔍), 채널이 있으면 `이 채널에서 가져온 동영상이 없습니다.`(🎬), 채널이 없으면 `먼저 채널을 불러와 주세요.`
  - 항목의 `.picker-item__meta` 는 `자막 있음`/`자막 없음` 표기를 유지한다(스모크가 이 문구로 자막 있는 영상을 찾는다).
- **스타일(`renderer/css/views.css`)**: `.picker-search`(높이 30px), `.picker-count`(줄바꿈 금지), `.picker-pager`(좌우 정렬), `.picker-pager__info`(가운데 정렬) + 1360px 미디어 쿼리(28px / 11px / gap 4px).
- **성능**: SQLite 는 페이지당 50행만 읽고 `LIMIT/OFFSET` 으로 자른다. 검색은 제목·설명 `LIKE '%q%'` 전수 스캔이지만 2000~3000행 규모에서 수 ms 수준이다.

## 12차 라운드 (AI 구문분석 자동저장 + 분석 노출)

### 1. `main/ai/openrouter.js` — 일시 오류 재시도

- 상수: `RETRY_STATUSES = [408, 429, 500, 502, 503, 504]`, `RETRY_ATTEMPTS = 2`, `RETRY_BASE_MS = 800`, `RETRY_MAX_MS = 8000`.
- `sleep(ms)`, `retryDelayMs(response, attempt, { baseMs, maxMs })` — `Retry-After` 헤더(초)가 있으면 그 값을, 없으면 `min(base * 2^attempt, max)` 를 준다. 같은 값을 테스트에서 0ms 로 낮출 수 있게 옵션으로 받는다.
- `httpError(response, text)` — 상태별 코드·메시지. 429 는 `AI_RATE_LIMIT` + `요청이 너무 많습니다. 잠시 후 다시 시도하거나 설정에서 다른 모델을 선택해 주세요. (무료 모델은 사용량 제한이 잦습니다)` + `detail`(본문 400자), 그 외는 `AI_HTTP`.
- `sendOnce(path, { apiKey, method, body, timeout })` — 실제 한 번의 호출. 실패 시 `httpError` 를 던진다.
- `request(path, options)` 루프:
  1. `sendOnce` 시도. 네트워크 오류(`AI_NETWORK`)면 마지막 오류를 보관하고 백오프 후 재시도.
  2. 응답이 `RETRY_STATUSES` 에 있으면 백오프 후 재시도.
  3. 재시도 소진 또는 재시도 대상 아님(`401` 등)이면 마지막 오류를 던진다.
  4. `options.retry.attempts` 로 횟수를 낮출 수 있다(테스트에서 0~1).
- `module.exports` 에 `request`, `retryDelayMs` 를 추가해 테스트가 직접 검증한다.

### 2. `renderer/js/components/analysis-card.js` (신규)

- `analysisCounts(analysis)` → `{ structure, expressions, examples }` 개수.
- `hasAnalysis(analysis)` → 해석 문자열 또는 세 목록 중 하나라도 비어 있지 않으면 `true`.
- `analysisSummaryText(analysis)` → `"구문 4 · 표현 3 · 예문 2"`.
- `renderAnalysisCard(analysis, { model, title })` → 1.문장 해석 / 2.구문 분석 / 3.주요 표현 / 4.예문 섹션. 각 항목이 없으면 `… 정보가 없습니다.` 를 넣어 빈 카드가 되지 않게 한다. `analysis.raw` 가 있으면 `AI 원문 응답` 접힘 없는 `pre` 로 덧붙인다.
- `renderAnalysisFailure(failures)` → `.analysis--error` 카드. `분석하지 못한 문장` + `N건`, 각 줄에 문장과 이유.

### 3. `renderer/js/components/notes-table.js` — 문장 노트에 분석 컬럼

- `COLUMNS = ['번호','★','문장','해석','분석','출처','태그','저장일','']` (9개). thead 는 `index === 4` 에 176px, 마지막 열에 104px·우측 정렬.
- `renderRows()` 에서 문장마다 `hasAnalysis(item.analysis)` 를 보고 **숨겨진 상세 행** `tr.is-detail`(`colspan = COLUMNS.length`, `renderAnalysisCard(analysis, { model, title: '저장된 AI 분석' })`)을 만든다.
- `분석` 셀: 저장된 분석이 있으면 `.analysis-summary` 요약 + `분석 보기` 버튼(상세 행 `hidden` 토글). 없으면 `—`.
- 행을 append 한 뒤 상세 행을 이어 붙인다(`tbody` 는 `tr` 만 허용하므로 `<div>` 를 넣을 수 없다).

### 4. `renderer/js/views/materials.js` — 학습 자료 목록

- `sentenceRow(item)` 이 `list-block` 안에 요약 pill(`analysisSummaryText`)과 `분석` 토글 버튼을 넣고, `list-row__detail`(기본 `hidden`)에 같은 카드를 담는다. 토글 버튼은 행 클릭으로 번지지 않게 `event.stopPropagation()` 을 건다.
- `render()` 서명에 `hasAnalysis(item.analysis) ? '*' : ''` 를 넣어 분석 유무가 바뀌면 다시 그린다.

### 5. `renderer/js/components/sentence-panel.js` — 실패 분리

- `analyze()` 가 문장별 `try/catch` 로 실패를 `failures` 에 모으고, 성공 건수 `saved` 를 센다.
- 실패가 있으면 `appendFailures(failures, saved === 0)`. 성공이 하나도 없으면 분석 박스를 비우고 실패 카드만 남겨 직전 성공 결과가 남지 않게 한다.

### 6. `renderer/js/actions.js` — 저장 분석에 모델 기록

- `analyzeAndSaveSentence()` 에서 `const analysis = { ...(result.analysis ?? { raw: result.raw ?? '' }) }; if (result.model) analysis.model = result.model;` 로 모델명을 분석 객체에 넣어 저장한다.

### 7. `renderer/css/views.css`

- `.analysis--error`(테두리 `#f0cbcb`, 배경 `#fdf1f1`) + `.analysis--error .analysis__head`.
- `.data-table tbody tr.is-detail > td`(padding `0 10px 12px`, 배경 `#f8fbff`) + hover 동일.
- `.list-block`(아래 테두리) / `.list-block .list-row`(테두리 제거) / `.list-row__detail`.

## 13차 라운드 (영어 필드 한국어 오염 수정 + 분석 카드 정리)

### 1. `main/ai/openrouter.js` — 영어 필드 규칙과 1회 교정

- `HANGUL_RE = /[\u3131-\u318E\uAC00-\uD7A3]/` 와 `hasHangul(text)` 를 추가한다.
- `findLanguageMismatch(analysis)` → `{ count, items }`. 검사 대상은 **`structure[].part` 뿐**이다(`translation`·`meaning`·`note` 는 한국어가 정상). 각 항목은 `{ index, text }`.
- `languageRepairPrompt(analysis, mismatch)` — 오염된 `part` 원문과 "영어로 다시 써라" 지시, 그리고 "설명(`meaning`·`note`)은 한국어로 두라"를 함께 넣는다.
- `systemPrompt` — `structure[].part` 는 **문장에서 그대로 복사한 영어**여야 하며 한글을 넣지 말라는 규칙을 강한 위치에 둔다(`must stay in English`, `never put a Korean word inside it`).
- `userPrompt` — 요청 JSON 스키마를 `translation` + `structure` 두 키로 좁히고 `Language rules` 블록(`part` MUST be English only · 문장에서 그대로 복사 · 한국어는 `translation`·`meaning`·`note` 에만)을 넣는다.
- `normalizeAnalysis(raw)` — `{ translation, structure, raw }` 만 반환한다(`expressions`·`examples` 제거). `structure[]` 의 각 항목은 문자열이면 `{ part, meaning: '', note: '' }` 로 감싼다.
- `analyzeSentence()` — 첫 응답에 오염이 있으면 **교정 프롬프트로 1회만** 재요청하고, 교정본의 오염 개수가 **줄어들 때만** 채택한다. 반환은 `{ analysis, parseFailed, model, usage }`.

### 2. `renderer/js/components/analysis-card.js` — 카드 2항목 + 오염 경고

- `analysisCounts(analysis)` → `{ structure }`, `hasAnalysis(analysis)` = `structure.length || translation`, `analysisSummaryText(analysis)` = `"구문 4"`.
- `koreanEnglishFields(analysis)` — 렌더 시 `structure[].part` 의 한글을 한 번 더 검사해 `.analysis__warn` 노란 박스(`영어로 나와야 할 부분이 한국어로 저장돼 있습니다 (구문 1) …`)로 알린다. 한글 구문이 `4` 를 넘으면 `외 N개` 로 줄인다.
- 카드 섹션은 `1. 문장 해석` + `2. 구문 분석` **두 개만** 둔다. 주요 표현·예문 섹션과 `AI 원문 응답` 섹션은 화면에서 제거한다(`analysis.raw` 는 DB 에 그대로 남는다).
- `renderAnalysisFailure(failures)` 는 그대로 유지한다.

### 3. 수동 입력·수정 경로 정리

- `renderer/js/components/sentence-panel.js` — `parseExpressionText`·`parseExampleText` 삭제. 수동 입력 모달 필드는 `문장 / 해석 / 구문 / 즐겨찾기` 4개. 저장 payload 는 `analysis: structure.length || translation ? { translation, structure } : null`.
- `renderer/js/components/notes-table.js` — 수정 모달도 같은 3필드(`structure` 는 `part | meaning | note` 줄 텍스트). **예전에 저장된 `analysis.expressions`·`analysis.examples` 는 지우지 않는다**(공유 내보내기 호환).

### 4. `renderer/css/views.css`

- `.analysis__section + .analysis__section` 12→16px, `.analysis__section-title` 6→8px, `.analysis__row` `line-height 1.75`·12.5px·`9px 0 9px 22px`, `.analysis__translation` `6px 0 10px 22px`.
- `.analysis__raw`(원문 응답 블록) 제거 → `.analysis__warn`(노랑 배경·테두리·글자) 추가.

## 14차 라운드 (문장 노트에서 주요 표현·예문·메모·태그 제거)

### 1. `main/db/schema.js` — 실제 제거 마이그레이션

- 두 번째 마이그레이션 `dropSentenceNoteAndTags` 를 추가한다: `DROP TABLE IF EXISTS sentence_tags;` → `DROP TABLE IF EXISTS tags;` → `ALTER TABLE sentences DROP COLUMN note;` (한 번에 실행, `schema_version` 1 → 2).
- `initial` 마이그레이션의 `sentences.note` 컬럼과 `tags`·`sentence_tags` CREATE 문은 **그대로 둔다**(과거 버전 DB 재현용). 신규 DB 도 두 번째 마이그레이션을 지나면 최종 상태는 tags 없음으로 같다.

### 2. `main/db/sentences.js` — 태그·메모 쿼리 제거 (197 → 153행)

- 제거: `TAG_NAMES`·`TAG_PKS` 상수, `COLUMNS` 의 `s.note` 와 태그 조인, `mapRow` 의 `tags`·`tagIds`, `create`/`update` 의 `note`·`tags` 인자, `list` 의 `tag` 필터, `setTags`, `listTags`, `exportAll` 의 `note`·`tags`, `module.exports` 의 해당 항목.
- 반환 계약: `list()` → `{ items, total }`.

### 3. IPC · preload · 렌더러 API

- `main/ipc.js` — `sentences:list` 의 `tag` 인자와 `tags` 반환 제거, `sentences:create`/`update` 의 `note`·`tags` 제거, `tags:list` 핸들러 삭제.
- `main/preload.js` — `tags: { list: () => invoke('tags:list') }` 블록 삭제.
- `renderer/js/api.js` — `tags` 네임스페이스 삭제.

### 4. 렌더러 화면·상태

- `renderer/js/state.js` — `sentences: { items: [], total: 0 }`, `filters` 에서 `tag: ''` 제거(최종 필터: `q`·`channelPk`·`favoriteOnly`·`sort`).
- `renderer/js/actions.js` — `loadSentences` 요청 payload 에서 `tag` 제거.
- `renderer/js/components/notes-table.js` — `COLUMNS = ['번호','★','문장','해석','분석','출처','저장일','']`(9→8개), `lastTagSignature`·`tagSelect`·`applyFilters` 의 tag 분기·`syncControls` 의 태그 블록·문장 수정 모달의 메모/태그/표현/예문 필드·행의 태그 `<td>` 제거. `hasAnalysis = structure.length || translation`, 저장 payload 는 `analysis: { translation, structure }`.
- `renderer/js/components/sentence-panel.js` — 수동 입력 모달의 메모·태그 필드와 payload 제거.
- `renderer/js/components/study-workspace.js` — `saveSentence` payload 에서 `note`·`tags` 제거.
- `renderer/css/views.css` — `.chip-row` 는 설정·공유 화면에서도 쓰므로 **삭제하지 않는다**.

### 5. 공유 · 데모 · AI · 테스트

- `main/share.js` — 내보내기(JSON/Markdown/HTML/CSV)와 병합에서 태그·메모 제거. `formatAnalysis` 에서 표현·예문 줄 제거(`part — meaning — note` 만). MD/HTML 의 태그·메모 행과 CSS, CSV 태그 컬럼, `tagsAdded`·`mergedTags`, 가져오기 시 `update`/`create` 의 `note`·`tags` 제거.
- `renderer/js/views/share.js` — 결과 문구를 `추가된 태그 N개 · ` 없이 `문장이 내 목록에 합쳐집니다` 로 정리.
- `main/demo-data.js` — `ANALYSIS_ROUTINE` 의 `expressions`·`examples`, 문장 시드의 `tags`, `tagId()`·`linkTag()`, `clear()` 의 tags 정리, INSERT 의 `note` 컬럼·값, 시드 루프의 `linkTag()` 호출 제거.
- `main/ai/openrouter.js` — `normalizeAnalysis` 가 `{ translation, structure, raw }` 만 반환, `systemPrompt` 의 반환 키 설명을 `(translation, meaning, note)` 로 정리.
- `test/db.test.js` — 테이블 목록에서 `tags`·`sentence_tags` 제거, CRUD/내보내기 단언에서 note·tags 제거(`update` 는 `{ translation: '다시 쓴 해석' }`), 데모 태그 단언 2건 제거.
- `test/ai-parse.test.js` — `expressions`·`examples` 키 블록 9곳 제거.
- `scripts/smoke.js` — `sentences:list` 의 `tags`, create/update 의 `tags`, `태그 목록`·`문장 수정 태그` expect 제거(94 → 92).

## 15차 라운드 (구문 한국어 뜻 필수 + 단어 분할 금지)

### 1. `main/ai/openrouter.js` — 프롬프트 규칙 + 응답 검증 + 1회 교정

- `systemPrompt`(243행) — `Every structure item must also have a Korean "meaning" and a short Korean "note". Never leave them empty.` 추가.
- `userPrompt`(255행) — `- structure: 3~6 items, split the sentence into meaningful chunks in order. Never split the sentence into single words.` / `"meaning" … must never be empty.` / `"note" … must never be empty.` 로 정리.
- `findMissingMeaning(analysis)`(327행) — `part` 가 있고 `meaning` 이 비면 `structure[i].meaning` 문자열을 모아 돌려준다.
- `findChunkingProblem(analysis)`(336행) — `part` 있는 항목이 3개 미만이면 통과. 6개 초과면 `['structure']`. 공백 없는 단일 단어가 절반 이상이면 `['structure']`.
- `analysisIssues(analysis)`(345행) — `[...findLanguageMismatch, ...findMissingMeaning, ...findChunkingProblem]`.
- `languageRepairPrompt(issues)`(382행) — 이슈 목록을 문장으로 만들고 `Every structure item needs a non-empty Korean "meaning" and a short Korean "note".` / `Never split the sentence into single words.` 를 포함한 교정 프롬프트를 만든다.
- `analyzeSentence()`(403행) — 첫 응답의 `analysisIssues` 가 비어 있지 않으면 **1회** 교정 재요청, 교정본 이슈 수가 줄 때만 채택.
- `normalizeAnalysis(analysis)`(349행) — `meaning` 별칭에 `?? item?.뜻 ?? item?.뜻풀이` 추가.
- exports(456~464행) — `findMissingMeaning`, `findChunkingProblem`, `analysisIssues`, `languageRepairPrompt` 추가.

### 2. `renderer/js/components/analysis-card.js` — 뜻 없음 표시

- `missingMeaningFields(analysis)` export — `meaning` 이 빈 구문 항목의 `part` 목록.
- 카드 상단 `.analysis__warn` 2종: 한국어 오염(13차), **한국어 뜻 없음**(15차).
- 구문 행 — `item.meaning` 이 있으면 `.analysis__meaning`(` : ${meaning}`), 없으면 `.analysis__missing`(` : 뜻 없음`).

### 3. `renderer/js/actions.js` — 재분석

- `reanalyzeSentence(pk, { sentence, videoTitle = null })` — 저장된 문장을 `ai.analyze` 로 다시 분석해 `sentences.update` 로 반영한다.

### 4. `renderer/js/components/notes-table.js` — 조건부 버튼

- `needsReanalyze` = 분석이 있는데 `missingMeaningFields` 가 비어 있지 않거나 한국어 오염이 있는 문장.
- 해당 행에만 `AI 다시 분석`(`btn btn--sm btn--ai`) 버튼을 노출.

### 5. `renderer/css/views.css`

- `.analysis__meaning`(정상 뜻), `.analysis__missing`(노란 `뜻 없음`) 추가. `.analysis__warn` 은 13차 것을 그대로 쓴다.

### 6. 테스트 · 검증

- `test/ai-parse.test.js` — 프롬프트 단언 2, `findMissingMeaning` + `뜻` 별칭, 뜻 교정 2, `findChunkingProblem` + 단어 분할 교정 1 → 총 67.
- `scripts/smoke.js` — notes 프로브에 `meanings`/`missingMeanings`/`meaningOk`, 검증 `view:notes 구문 뜻 표시` 추가. `aiFlow`/`aiFail` 대기 100→240, `waitAnalyzeButton()` 헬퍼(앞선 실 AI 호출이 끝날 때까지 `AI 구문분석` 버튼을 120×50ms 대기).

## 16차 라운드 명세 (빌드 패키징 + 자동 업데이트)

### 1. 빌드 설정 (`package.json`)

- `version: 1.0.0` (홈 배너·설치본·`latest.json` 모두 이 값을 쓴다. 표시는 `app.getVersion()`)
- `build.appId: com.studyted.desktop`, `build.productName: StudyTED`, `directories.output: dist`, `directories.buildResources: build`
- `build.files: ["main/**/*", "renderer/**/*", "package.json", "!**/*.map"]` — `test/`, `scripts/`, `_tmp/`, `_workspace/` 는 설치본에 넣지 않는다.
- `build.extraResources: [{ from: "build/bin", to: "bin" }]` → 설치 후 `resources/bin/yt-dlp.exe`
- `build.win.target: [{ target: "nsis", arch: ["x64"] }]`, `icon: build/icon.ico`, `artifactName: StudyTED-Setup-${version}.${ext}`
- `build.nsis`: `oneClick:false`, `perMachine:false`, `allowElevation:true`, `allowToChangeInstallationDirectory:true`, 바탕화면·시작메뉴 바로가기(`shortcutName: StudyTED`), `runAfterFinish:true`, `deleteAppDataOnUninstall:false`(업데이트해도 학습 데이터 보존), 아이콘 3종
- 스크립트
  - `npm run icon` → `scripts/make-icon.js` (`build/icon.png`·`build/icon.ico`)
  - `npm run prepare:bin` → `scripts/prepare-bin.js` (`_tmp/yt-dlp.exe` → `build/bin/yt-dlp.exe`)
  - `npm run dist` → `prepare-bin` → `electron-builder --win` → `make-manifest`
  - `npm run dist:dir` → 설치 없이 `dist/win-unpacked`
  - `npm run manifest` → 설치본은 그대로 두고 `dist/latest.json` 만 재생성

### 2. `dist/latest.json` 스키마

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

- `url` 은 절대 URL 도 상대 경로도 허용한다(상대면 피드 주소 기준 해석).
- `notes` 는 `build/release-notes.md` 가 있으면 그 내용, 없으면 "`<version>` 버전입니다.".
- 배포는 **설치본 exe + `latest.json` 을 같은 위치에 올리는 것**으로 끝난다(예: GitHub Releases 자산, 정적 호스팅).

### 3. `main/update.js`

| 항목 | 내용 |
|---|---|
| 상수 | `FEED_TIMEOUT_MS 15000`, `STALL_TIMEOUT_MS 60000`, `AUTO_CHECK_INTERVAL_MS 6h`, `MAX_REDIRECTS 5`, `MAX_FEED_BYTES 1MB` |
| 상태 | `phase(idle\|checking\|current\|available\|downloading\|ready\|installing\|error)`, `version`, `packaged`, `feedUrl`, `autoCheck`, `silentInstall`, `latest`, `checkedAt`, `received`, `total`, `percent`, `filePath`, `error`, `message` |
| 버전 비교 | `parseVersion`(v 접두사 허용, 자리수 보정, 실패 시 null), `isNewer(a,b)` |
| 피드 | `check({ silent, force })` → 피드 GET(`readFeedText`, 302 추적, 크기 상한) → `{ version, url: resolveAssetUrl(...), sha256, size, notes, pubDate }` → `update.lastCheckAt` 저장 |
| 다운로드 | `download()` → `<userData>/tmp/updates/<safeFileName>` 로 `.part` 스트리밍 → sha256 검증 → 완료 시 rename → 256KB 단위 progress emit. 실패 시 `.part` 삭제 |
| 설치 | `install()` → `app.isPackaged` 아니면 `UPDATE_DEV`. 조용한 설치면 `writeInstallScript()` 로 `apply-update.cmd` 생성 후 `cmd /c` detached → 800ms 뒤 `app.exit(0)` |
| 자동 확인 | `autoCheck()` — `update.autoCheck` 켜짐 + 주소 있음 + 6시간 경과일 때만 silent 확인 |
| 정리 | `cleanupDownloads(keepVersion)` — 최신 버전 파일만 남기고 정리 |
| 기타 | `clearLatest()`(주소 없음/비 http(s) 시 이전 `latest`·`filePath`·`checkedAt`·percent 초기화, `downloading`/`installing` 중에는 유지), `onStatus(fn)`, `state()` |
| exports | `state, check, download, install, autoCheck, onStatus, cleanupDownloads, isNewer, parseVersion, writeInstallScript` |

설치 스크립트(조용한 설치) — `/D=` 는 줄 끝까지가 경로이므로 명령을 줄마다 분리한다.

```
@echo off
start "" /wait "<installer>" /S /D=<설치폴더>
start "" "<exe>"
del "%~f0"
```

### 4. IPC 채널 (전부 `invoke`, `handle()` 이 `{ok,data}` 로 감쌈)

| 채널 | 인자 | 반환 |
|---|---|---|
| `update:state` | - | 현재 상태 스냅샷 |
| `update:check` | `{ force }` | 확인 결과 상태 |
| `update:download` | - | 다운로드 결과 상태 |
| `update:install` | - | 설치 시작(개발 실행이면 `UPDATE_DEV`) |
| `settings:update` | `updateFeedUrl?`(http/https 검증) · `updateAutoCheck?` · `updateSilentInstall?` | 갱신된 설정 + `keyMask` |
| (이벤트) `update:status` | - | 메인 → 렌더러 상태 push |

### 5. 화면

- `renderer/js/components/update-banner.js` — 홈 최상단 `section.card.update-banner`
  - 좌측: `StudyTED` + `v<버전>`, 상태 문구(`업데이트 주소를 설정하면 새 버전이 나올 때 알려 드립니다.` / `최신 버전입니다.` / `새 버전 v… 이 있습니다.` / `내려받는 중… n%` / `내려받았습니다. 지금 설치할 수 있습니다.` / 오류 문구), 진행 바, 필요 시 `notes`
  - 우측 버튼: `업데이트 내려받기`(phase 에 따라 `지금 설치하고 다시 시작`) · `업데이트 확인` · `업데이트 설정`(홈 → 설정 이동)
- `renderer/js/views/settings.js` — `업데이트` 카드: `현재 버전 v…`, 피드 주소 입력 + `저장`, `자동 확인`·`조용한 설치` 체크박스, `업데이트 확인`·`내려받기`·`지금 설치하고 다시 시작`
- `renderer/css/components.css` — `.update-banner`, `.update-banner__row/__info/__title/__app/__version/__status/__text/__percent/__bar/__actions/__note`

### 6. 테스트 · 검증

- `test/update.test.js` — `parseVersion`/`isNewer` 3건
- `test/update-feed.test.js` — `electron` 모듈을 `require.cache` 스텁(`app.getVersion → '1.0.0'`, `isPackaged:false`, `getPath('userData') → tmp`)으로 대체하고 로컬 `http.createServer` 로 피드·302·상대 자산·설치본을 서빙해 11건: 주소 없음/`ftp://` 거부, `available`/`current`, 302 추적 + 상대 자산 URL 해석, 다운로드 + sha256 + `.part` 잔여 0 + 재확인 시 `ready` 재사용 + `cleanupDownloads` keep/drop, sha256 불일치 → `UPDATE_HASH`, 주소 삭제 시 `latest` 초기화, 서버 503 → `UPDATE_HTTP`, 개발 실행 `install()` → `UPDATE_DEV`, 자동확인 요청 0회 · 6시간 내 재요청 없음, 조용한 설치 스크립트 `/D=` 한 줄 규칙
- `scripts/smoke.js` — home 프로브 `view:home 버전 표시`(StudyTED + 버전 + 업데이트 버튼), `view:home 업데이트 버튼`; settings 프로브 `view:settings 업데이트 카드`(`textInput===1 && checks===2 && buttons.includes('업데이트 확인') && /현재 버전/`)

## 17차 구현 명세 (GitHub 릴리스 배포 + 기본 업데이트 주소)

### 1. 저장소 · 배포 구성

| 항목 | 값 |
|---|---|
| 저장소 | `https://github.com/pang980/study-ted` (public, 기본 브랜치 `main`) |
| 릴리스 태그 | `v<package.json version>` (예: `v1.0.0`) |
| 릴리스 자산 | `StudyTED-Setup-<버전>.exe`, `StudyTED-Setup-<버전>.exe.blockmap`, `latest.json` |
| 피드 주소(앱 기본값) | `https://github.com/pang980/study-ted/releases/latest/download/latest.json` |
| 커밋 제외 | `.env`, `.env.*`, `node_modules/`, `_tmp/`, `dist/`, `build/bin/`, `*.log`, `data/` |

### 2. `main/db/settings.js`

- `DEFAULT_UPDATE_FEED_URL` 상수(위 피드 주소) 신설.
- `DEFAULTS['update.feedUrl']` 을 `''` → `DEFAULT_UPDATE_FEED_URL` 로 변경.
- `getValue(key, fallback)` 는 `getRaw` 가 돌려준 값이 `null` 이 아니면 그 값을 쓰므로, **DB 행이 없으면 기본 주소가 적용되고 사용자가 저장한 주소가 있으면 그 값이 우선**한다. 스키마·마이그레이션 변경 없음.

### 3. `scripts/release.js` (`npm run release`)

```
capture('gh', ['auth', 'status'])            # 실패 → "gh auth login 먼저"
capture('git', ['remote', 'get-url', 'origin'])
runShell('npm run dist')                     # 빌드 + dist/latest.json
manifest = dist/latest.json                  # version 이 package.json 과 같은지 확인
assets = [exe, exe.blockmap, latest.json]    # 3개 모두 존재해야 진행
existing = capture('gh', ['release', 'view', tag])
  있으면  → gh release upload <tag> <assets> --clobber  +  gh release edit <tag> --notes-file build/release-notes.md
  없으면  → gh release create <tag> <assets> --title "StudyTED <tag>" --notes-file …
print  업데이트 주소(피드 URL)
```

- `run(command, args)` = `shell:false`(gh·git), `runShell(line)` = `shell:true`(npm). `capture()` 는 stdout 을 문자열로 돌려준다.
- 실패는 모두 `[중단] …` 메시지 + `process.exit(1)`.

### 4. `build/release-notes.md`

- 릴리스 설명 원문(마크다운). `scripts/make-manifest.js` 가 읽어 `latest.json` 의 `notes`(2000자 상한)로 넣고, `scripts/release.js` 가 `gh release create/edit --notes-file` 로 그대로 올린다.
- 새 버전을 낼 때 이 파일을 갱신하지 않으면 이전 설명이 그대로 올라간다(스크립트가 경고하지 않으므로 사람이 확인).

### 5. 버전 배포 절차 (사용자용)

    npm version 1.0.1 --no-git-tag-version   # package.json 버전 올리기
    # build\release-notes.md 갱신 (선택)
    npm run release                          # 빌드 + v1.0.1 릴리스 생성/갱신

- 설치된 앱은 시작 8초 후·6시간마다 피드를 확인한다. 새 버전이면 홈 배너가 `새 버전 v1.0.1 이 있습니다` 로 바뀌고 `업데이트 내려받기` → `지금 설치하고 다시 시작` 으로 갱신된다.
- 1.0.0 → 1.0.1 처럼 `package.json` 의 `version` 만 올리면 태그·자산 이름·피드 버전이 모두 따라온다.

## 18차 구현 명세 (2026-09-24)

### 1. `main/ai/openrouter.js` — 분석 대상 고정

- `systemPrompt(targetLang)` 마지막에 2줄 추가:
  - `The analysis target is always the single line that starts with "Sentence:".`
  - `A video title or surrounding context is reference only: never translate it and never analyze it instead of that sentence.`
- `userPrompt({ sentence, context, videoTitle })` 줄 순서:
  1. 출력 스키마 JSON
  2. `What to analyze:` + "대상은 맨 끝 `Sentence:` 한 줄, 제목·문맥은 참고용" 2줄
  3. `Language rules (most important):` 이하 기존 규칙
  4. `Reference only (never translate or analyze these):` (제목 또는 문맥이 있을 때만) → `- Video title: …` → `- Surrounding context: …`
  5. `Analysis target: the one English sentence below. …` → `Sentence: …` (**항상 마지막**)
- `.filter(Boolean)` 유지 → 제목·문맥이 없으면 `Reference only` 헤더도 사라지고 `Sentence:` 가 곧바로 뒤따른다.

### 2. `renderer/js/ui.js` — 확인 창 확정 순서

    let settled = false;
    const done = (value) => { if (settled) return; settled = true; resolve(value); };
    확인 버튼: done(true)  → dialog.close()
    취소 버튼: done(false) → dialog.close()
    onClose: () => done(false)

- `dialog.close()` 안에서 `onClose` 가 동기 실행되므로, `resolve` 를 **먼저** 확정해야 확인 클릭이 살아남는다.

### 3. `renderer/js/components/notes-table.js` — 상세 보기

- 생성자에서 `this.tableWrap = h('div', { class: 'table-wrap' }, this.table)` 을 만들어 `element` 에서 재사용한다.
- `renderRows()` 첫 줄에서 `this.tableWrap.classList.remove('is-expanded')`.
- 문장 셀: `class: 'cell-sentence cell-clamp is-clickable'`, `title: '눌러서 해석·구문 분석 보기'`, `onClick: () => toggleDetail()`.
- 상세 행(`tr.is-detail`, 초기 `hidden`)을 **모든 행에** 만든다:

      td[colspan=COLUMNS.length] > div.detail-body
        > div.detail-sentence   (문장 전체)
        > div.detail-translation (해석이 있을 때만)
        > renderAnalysisCard(...) 또는 "저장된 AI 분석이 없습니다. …" 안내

- 지역 함수: `syncExpanded()` = 열린 `tr.is-detail` 이 하나라도 있으면 `is-expanded` 토글, `toggleDetail()` = `detailRow.hidden = !detailRow.hidden` + `syncExpanded()`.
- `분석 보기` 버튼 `onClick` 을 `toggleDetail()` 로 교체(기존엔 `hidden` 만 뒤집고 `is-expanded` 를 몰랐다).

### 4. `renderer/css/views.css`

    .table-wrap.is-expanded { max-height: none; }   /* 기본은 .table-wrap { max-height: 360px; overflow: auto; } */
    .detail-body      { display:flex; flex-direction:column; gap:10px; padding:12px 2px 4px; }
    .detail-sentence  { font-family: var(--font-en); font-weight:600; line-height:1.65; color:#1d2b41; }
    .detail-translation { line-height:1.65; color: var(--muted); }
    .cell-sentence.is-clickable { cursor:pointer; }
    .cell-sentence.is-clickable:hover { color: var(--primary); text-decoration: underline; }

### 5. `scripts/smoke.js` — 검증 갱신

- `VIEW_PROBES.notes`: `detailRows`(모든 상세 행) 추가, `details` 는 **분석 카드가 있는** 상세 행 수로 재정의.
- 단언: `details > 0 && detailRows === rows && cards === details && toggleButtons === details && summaries === details`.
- 추가 검증 3건:
  1. `view:notes 문장 클릭 상세` — 먼저 열려 있는 상세를 모두 닫고, `tr:nth-child(1) .cell-sentence` 클릭 → `hidden=false` + `is-expanded=true`, 다시 클릭 → `hidden=true` + `is-expanded=false`
  2. `view:notes 분석 보기 높이 해제` — `분석 보기` 클릭 전 `max-height=360px` → 클릭 후 `none`, 열린 상세 본문 높이 > 40px, 다시 클릭 → `360px`
  3. `view:notes 삭제 동작`(`runViewChecks` 뒤) — `title="삭제"` 버튼 → `.modal__foot .btn--danger` 클릭 → 행 수 4 → 3, 모달 닫힘
- 검증 헬퍼는 `hidden` **속성**(:not([hidden]))이 아니라 **프로퍼티**로 열림 여부를 판단한다(둘은 같이 움직이지만, 값을 재는 시점이 닫힌 뒤면 0 이 되므로 열려 있을 때 측정한다).
