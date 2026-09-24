# Selected Cores

> SKILL.md Phase 3 산출물. AGENTS.md `_workspace` 목록에 없어 보충 문서로 추가한다 (D-001).

## 선택된 Core

- `core/electron-app` — Electron 메인/프리로드/렌더러 3계층 분리, 커스텀 프로토콜 로딩
- `core/local-sqlite` — `node:sqlite` 기반 스키마·마이그레이션·쿼리 계층
- `core/youtube-collect` — provider 계층(yt-dlp / native) + 자막 파서
- `core/openrouter-llm` — OpenRouter 호출, 모델 목록, 구조화 JSON 분석

## 선택 이유

- 요구사항의 3축(수집 / 학습 UI / AI 분석)이 각각 독립적으로 실패·교체 가능해야 한다.
  특히 수집은 외부 서비스 의존도가 높아 교체 가능성이 가장 크다.
- SQLite는 로컬 단일 파일이면 충분하며 서버가 필요 없다.

## 적용 범위

    core/electron-app    -> main/, renderer/, main/preload.js
    core/local-sqlite    -> main/db/
    core/youtube-collect -> main/collect/
    core/openrouter-llm  -> main/ai/

## 보류 Core

- `core/packaging` (electron-builder 배포 패키징): 사용자 요청 없음 → 보류
- `core/i18n`: UI가 한국어 단일 → 보류
- `core/cloud-sync`: 서버 없음 → 제외
- Cloudflare 관련 Core 일체: 프로젝트 성격상 해당 없음
