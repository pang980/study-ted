# Domain Analysis

> SKILL.md Phase 2 산출물. AGENTS.md의 `_workspace` 파일 목록에 없는 항목이라 보충 문서로 추가한다 (D-001 참조).

## 목적

유튜브 채널의 실제 영어 발화(자막)를 학습 재료로 삼아
"듣기 → 자막 확인 → 문장 추출 → 해석/구문 분석 → 누적/공유" 흐름을 하나의 로컬 앱에서 끝낸다.

## 사용자

- 단일 사용자(로컬 데스크톱). 로그인·다중 사용자 개념 없음.
- 영어 학습자: 채널을 정해두고 반복 학습하며 문장 단위 노트를 축적한다.
- 학습 자료를 파일로 다른 사람에게 공유한다(공유 대상은 앱을 설치하지 않아도 됨).

## 주요 기능

1. 채널 등록/동기화 (채널 → 동영상 목록 → 자막)
2. 학습 재생 (듣기 모드 / 자막 모드)
3. 자막 패널 동기화 + 현재 문장 하이라이트 + 문장 복사
4. 문장 노트 저장 (AI 구문분석 / 수동 입력)
5. 문장 노트 목록 (검색·태그·정렬·즐겨찾기)
6. 내보내기·가져오기 (공유)
7. 설정 (OpenRouter 키, 모델 선택, 즐겨찾기·자주 쓰는 모델, yt-dlp 관리)

## 데이터

로컬 SQLite 엔터티:

| 엔터티 | 핵심 필드 | 설명 |
|---|---|---|
| channels | channel_id, title, handle, url, avatar_url, subscriber_text, video_count, description | 등록 채널 |
| videos | video_id, channel_id, title, url, duration_sec, duration_text, view_count, published_text, thumbnail_url, description | 채널 동영상 |
| transcripts | video_id, lang, kind(manual/asr), source(ytdlp/native/manual), segments_json, plain_text | 자막(문장 + 타임스탬프) |
| sentences | video_id, sentence, translation, analysis_json, note, source(ai/manual), start_sec, is_favorite, study_count | 학습 문장 |
| tags / sentence_tags | name | 태그 |
| settings | key, value | API 키(암호화), 모델, 즐겨찾기 등 |

사용자 요구 "저장해야 하는 자료: 유튜브 제목, 유튜브 주소, 문장들, 해석, 자막" 대응:

- 유튜브 제목 → `videos.title`
- 유튜브 주소 → `videos.url`
- 문장들 / 해석 → `sentences.sentence` / `sentences.translation`
- 자막 → `transcripts.segments_json`, `transcripts.plain_text`

## 외부 서비스

| 서비스 | 용도 | 실패 시 대응 |
|---|---|---|
| YouTube (HTML + Innertube) | 채널/영상 메타데이터, 자막 트랙 목록 | yt-dlp 로 대체 |
| yt-dlp 실행 파일 | 동영상 목록, 자막 본문 수집 | 경로 직접 지정 / 자막 직접 붙여넣기 |
| OpenRouter API | 문장 구문분석, 모델 목록 | 수동 입력 모드로 계속 사용 가능 |

## 보안 요구사항

- OpenRouter API 키는 메인 프로세스에서만 사용한다. IPC 응답에 원문을 담지 않는다(마스킹 값만 반환).
- `safeStorage` 사용 가능 시 암호화 저장, 불가 시 평문 저장 + UI 경고.
- `contextIsolation: true`, `nodeIntegration: false`, preload `contextBridge` 화이트리스트 IPC만 허용.
- 외부 URL은 시스템 브라우저로만 연다(`shell.openExternal`). 렌더러의 임의 네비게이션·새 창 차단.

## 위험 요소

| 위험 | 영향 | 대응 |
|---|---|---|
| YouTube 봇 차단(429 / UNPLAYABLE / 빈 자막 응답) | 자막 수집 실패 | provider 2중화(yt-dlp 우선), 실패 사유를 UI에 그대로 표시, 자막 직접 붙여넣기 지원 |
| yt-dlp 미설치 | 자막 수집 불가 | 설정에서 자동 다운로드 + 경로 지정 + 상태 표시 |
| YouTube 응답 구조 변경 | 메타데이터 파싱 실패 | JSON 블록 추출 방식 사용, 파싱 실패 시 명시적 오류 반환 |
| Electron 버전별 `node:sqlite` 가용성 | DB 초기화 실패 | 시작 시 가용성 확인, 실패 시 명확한 오류 메시지 |
| AI 응답 비정형 | 파싱 실패 | JSON 응답 강제 + 실패 시 원문 보관 및 재시도 안내 |
| 대량 동기화 시 과도한 요청 | 차단·지연 | 순차 처리 + 요청 간 지연 + 진행률 표시 + 중단 |

## 제외 범위

- 로그인/계정/서버 동기화 (로컬 전용)
- 영상 다운로드(오프라인 재생) — 재생은 YouTube 임베드 사용
- 영상 전체 자막 자동 번역
- 모바일/웹 배포
- Cloudflare Workers 배포 (해당 없음)
