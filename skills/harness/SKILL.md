---
name: harness
description: "Codex 작업 환경에서 문서 기반 프로젝트 하네스를 구축·점검·확장·재실행한다. AGENTS.md, _workspace, core, skills, rules, templates, 작업 계획, 구현 기록, 검증 보고서를 관리한다. '하네스 구성', '하네스 구축', 'Codex 구조 만들어줘', '하네스 점검', '재실행', '업데이트', '보완', '기존 결과 기반 수정', '구조 개선', '규칙 수정' 요청 시 반드시 이 스킬을 사용한다."
---

# Harness — Codex Workspace Architect

Codex가 프로젝트를 안정적으로 분석·수정·검증하도록 문서 기반 하네스를 구성한다.

이 스킬의 목적은 에이전트 팀을 만드는 것이 아니라 다음을 일관되게 관리하는 것이다.

- 프로젝트 구조
- 작업 규칙
- 작업 계획
- 수정 범위
- 구현 기록
- 검증 결과
- 변경 이력

---

# 1. 핵심 역할

1. 기존 프로젝트와 하네스 상태 확인
2. AGENTS.md 확인 또는 생성
3. _workspace 산출물 구조 구성
4. 필요한 core 선택 및 기록
5. skills, rules, templates 생성 또는 보완
6. 작업 계획과 수정 범위 작성
7. 구현 로그와 검증 결과 기록
8. 기존 하네스의 부분 수정 및 재실행
9. Cloudflare 프로젝트 규칙 적용
10. UTF-8 한글 인코딩 보존 확인

---

# 2. 규칙 우선순위

규칙이 충돌하면 다음 순서로 적용한다.

1. 사용자의 현재 요청
2. 프로젝트 루트의 AGENTS.md
3. 현재 실행 중인 SKILL.md
4. rules/ 디렉토리의 관련 규칙
5. 기존 프로젝트 관례

상위 규칙이 명확하지 않으면 임의로 추정하지 않고 보류 항목에 기록한다.

---

# 3. 절대 금지 사항

다음 구조와 기능은 사용하지 않는다.

- .claude/
- CLAUDE.md
- Agent 팀 구성
- TeamCreate
- SendMessage
- 특정 모델 강제 지정
- 에이전트 간 역할 분담 문서
- _workspace 초기화
- 검증 결과를 기록하지 않고 종료
- 비밀정보를 문서나 로그에 기록
- 기존 파일 전체를 불필요하게 재작성

Codex 작업은 파일, 문서, 코드, 명령 실행 결과로만 관리한다.

---

# 4. 기본 구조

```text
project-root/
├── AGENTS.md
├── _workspace/
│   ├── 00_input.md
│   ├── 01_domain_analysis.md
│   ├── 02_selected_cores.md
│   ├── 03_work_plan.md
│   ├── 04_file_map.md
│   ├── 05_implementation_log.md
│   ├── 06_validation_report.md
│   ├── 07_change_history.md
│   └── 99_pending_items.md
├── skills/
│   └── harness/
│       └── SKILL.md
├── rules/
├── templates/
└── core/
```

기존 프로젝트에 다른 _workspace 파일 이름이 이미 사용되고 있다면 강제로 변경하지 않는다.

AGENTS.md와 기존 _workspace에서 지정한 파일 구조를 우선 유지한다.

---

# 5. 실행 모드

## 신규 구축

다음 항목이 대부분 없을 때 실행한다.

- AGENTS.md
- _workspace/
- skills/
- rules/
- templates/
- core/

필요한 기본 구조를 새로 생성한다.

## 보완

구조가 일부만 존재할 때 실행한다.

기존 파일은 유지하고 누락된 항목만 추가한다.

## 점검

하네스 구조가 이미 존재할 때 실행한다.

중복, 충돌, 누락, 잘못된 경로, 오래된 규칙을 확인한다.

## 부분 재실행

사용자가 수정·보완·재실행을 요청할 때 실행한다.

기존 _workspace를 초기화하지 않고 관련 단계만 갱신한다.

---

# 6. Phase 0 — 현황 확인

다음 항목을 먼저 확인한다.

- AGENTS.md
- _workspace/
- skills/
- rules/
- templates/
- core/
- package.json
- tsconfig.json
- wrangler.jsonc 또는 wrangler.toml
- .editorconfig
- .gitattributes
- .gitignore
- Git 상태
- 현재 브랜치

확인 결과를 바탕으로 신규 구축, 보완, 점검, 부분 재실행 중 하나를 선택한다.

---

# 7. Phase 1 — 입력 정리

파일:

`_workspace/00_input.md`

```md
# Input Summary

## 사용자 요청

## 프로젝트 목표

## 핵심 기능

## 기술 스택

## 제약 조건

## 기존 구조

## 보류 항목
```

사용자가 명시하지 않은 내용을 확정 사실처럼 기록하지 않는다.

---

# 8. Phase 2 — 도메인 분석

파일:

`_workspace/01_domain_analysis.md`

```md
# Domain Analysis

## 목적

## 사용자

## 주요 기능

## 데이터

## 외부 서비스

## 보안 요구사항

## 위험 요소

## 제외 범위
```

Cloudflare 프로젝트라면 다음 항목도 확인한다.

- Worker 요청 흐름
- D1 데이터 구조
- R2 파일 흐름
- Durable Objects 필요 여부
- 인증 방식
- 배포 브랜치
- Cloudflare 바인딩
- Secret 관리 방식

---

# 9. Phase 3 — Core 선택

파일:

`_workspace/02_selected_cores.md`

```md
# Selected Cores

## 선택된 Core

- core-name

## 선택 이유

## 적용 범위

## 보류 Core
```

필요하지 않은 core를 억지로 선택하지 않는다.

---

# 10. Phase 4 — 작업 계획

파일:

`_workspace/03_work_plan.md`

```md
# Work Plan

## 목표

## 작업 범위

## 제외 범위

## 생성 파일

## 수정 파일

## 실행 순서

## 검증 방법

## 리스크

## 롤백 방법
```

계획을 작성하기 전에 기존 파일을 실제로 읽는다.

---

# 11. Phase 5 — 파일 맵

파일:

`_workspace/04_file_map.md`

```md
# File Map

## 생성 파일

## 수정 파일

## 읽기 전용 파일

## 수정 금지 파일

## 영향 범위
```

파일 맵에 없는 파일은 원칙적으로 수정하지 않는다.

추가 수정이 필요하면 먼저 파일 맵을 갱신한다.

---

# 12. Phase 6 — AGENTS.md

AGENTS.md가 있으면 기존 내용을 우선 사용하고 필요한 부분만 보완한다.

없으면 다음 내용을 포함해 생성한다.

```md
# AGENTS.md

## 프로젝트 목표

## 기술 스택

## 시작 순서

## 작업 원칙

## 수정 금지 사항

## 검증 명령

## _workspace 위치

## UTF-8 규칙

## Git 및 배포 규칙
```

AGENTS.md에는 핵심 규칙만 유지한다.

세부 규칙은 rules/와 관련 SKILL.md에 둔다.

---

# 13. Phase 7 — Rules 생성

필요에 따라 다음 파일을 생성하거나 보완한다.

## rules/file-edit-rules.md

필수 내용:

- 기존 파일 먼저 읽기
- 전체 덮어쓰기 금지
- 최소 범위 수정
- 기존 구조와 설정 유지
- UTF-8 without BOM 유지
- EOL 임의 변경 금지
- 수정 전후 한글 확인

## rules/coding-rules.md

필수 내용:

- 기존 스타일 유지
- 중복 코드 방지
- 명확한 타입 사용
- 오류 처리
- 입력 검증
- 불필요한 의존성 금지

## rules/validation-rules.md

필수 내용:

- 가능한 검증 명령 실행
- 실패 결과 기록
- 실행하지 못한 검증 기록
- 빌드·타입·테스트 결과 저장
- Secret 노출 여부 확인

프로젝트에 이미 동일 목적의 규칙 파일이 있으면 중복 생성하지 않는다.

---

# 14. Phase 8 — Skills 생성

구조:

```text
skills/{skill-name}/SKILL.md
```

작성 규칙:

- YAML front matter를 사용한다.
- name과 description을 명확히 작성한다.
- 실행 조건을 description에 포함한다.
- 역할과 제외 범위를 구분한다.
- 가능한 한 500줄 이하로 유지한다.
- 반복되는 기계적 작업은 scripts/로 분리한다.
- 기존 skill과 기능이 중복되지 않게 한다.

---

# 15. Phase 9 — 구현 로그

파일:

`_workspace/05_implementation_log.md`

```md
# Implementation Log

## 날짜

### 작업 목표

### 수정 파일

### 생성 파일

### 작업 내용

### 실행 명령

### 검증 결과

### 발생한 문제

### 남은 작업
```

실제 수행한 내용만 기록한다.

---

# 16. Phase 10 — 검증

파일:

`_workspace/06_validation_report.md`

```md
# Validation Report

## 실행 환경

## 실행 명령

## 결과

## 체크리스트

- 구조 정상
- 필수 파일 존재
- 파일 맵과 실제 변경 일치
- 타입 검사 통과
- 빌드 통과
- 테스트 통과
- Secret 노출 없음
- UTF-8 유지
- 한글 깨짐 없음

## 실패 또는 미실행 항목

## 문제

## 결론
```

검증을 실행하지 못했다면 성공으로 표시하지 않는다.

실행하지 못한 이유를 명확히 기록한다.

---

# 17. Phase 11 — 변경 이력

파일:

`_workspace/07_change_history.md`

```md
# Change History

| 날짜 | 변경 파일 | 변경 내용 | 이유 |
|---|---|---|---|
```

기존 기록을 삭제하지 않고 이어서 추가한다.

---

# 18. Phase 12 — 보류 항목

파일:

`_workspace/99_pending_items.md`

```md
# Pending Items

- 미결정 항목
- 사용자 확인 필요 항목
- 기술 검증 필요 항목
- 후속 작업
```

애매한 내용을 임의로 구현하지 않고 여기에 기록한다.

---

# 19. Cloudflare 프로젝트 감지

다음 중 하나 이상이 있으면 Cloudflare 프로젝트로 판단한다.

- wrangler.jsonc
- wrangler.toml
- @cloudflare/workers-types
- workers-types
- D1 binding
- R2 binding
- Durable Object binding
- Cloudflare Workers 배포 설정
- package.json의 wrangler 명령

Cloudflare 프로젝트에서는 아래 규칙을 추가 적용한다.

---

# 20. Cloudflare 표준 스택

프로젝트 요구사항에 별도 지정이 없으면 다음을 기본값으로 사용한다.

- Runtime: Cloudflare Workers
- Language: TypeScript strict
- HTTP Framework: Hono
- Database: Cloudflare D1
- File Storage: Cloudflare R2
- Stateful Realtime: Durable Objects
- Validation: Zod
- Authentication: JWT 또는 프로젝트 기존 인증 방식
- API Documentation: OpenAPI
- Build and Deploy: Wrangler
- Source Repository: GitHub
- Automatic Deployment: Cloudflare Workers Builds
- Package Manager: 기존 프로젝트 설정, 없으면 npm

D1, R2, Durable Objects는 실제 기능에 필요한 경우에만 추가한다.

사용하지 않는 서비스를 미리 생성하거나 바인딩하지 않는다.

---

# 21. Cloudflare 구현 원칙

1. Cloudflare 공식 Web Platform API를 우선 사용한다.
2. Workers binding은 `env`를 통해 접근한다.
3. D1은 binding과 prepared statement를 사용한다.
4. SQL 값은 문자열 결합 대신 bind를 사용한다.
5. 파일 영구 저장은 R2를 사용한다.
6. 로컬 파일 시스템을 영구 저장소로 사용하지 않는다.
7. 여러 클라이언트의 상태 조정이 필요할 때 Durable Objects를 사용한다.
8. WebSocket 기반 Durable Objects는 필요 시 Hibernation API를 검토한다.
9. Secret은 Wrangler Secret 또는 Cloudflare Secret 관리 기능을 사용한다.
10. API와 바인딩 타입은 명시적으로 정의한다.

---

# 22. Node.js 호환성 규칙

이 프로젝트는 기본적으로 Cloudflare Native 방식으로 구현한다.

다음 Node.js API는 기본적으로 사용하지 않는다.

- node:fs
- node:path
- node:child_process
- node:net
- node:tls
- node:cluster
- node:worker_threads
- http.createServer()
- https.createServer()
- Express 서버 실행 방식

예외는 다음 조건을 모두 만족할 때만 허용한다.

1. Cloudflare 공식 문서에서 현재 지원이 확인된다.
2. nodejs_compat 설정이 프로젝트에 명시돼 있다.
3. Web Platform API만으로 구현하기 어렵다.
4. 사용 이유와 영향이 작업 계획에 기록돼 있다.
5. 영구 파일 저장 목적으로 사용하지 않는다.

지원 여부를 추측해서 호환성 플래그를 추가하지 않는다.

---

# 23. TypeScript 규칙

- tsconfig의 strict를 유지한다.
- any 사용을 최소화한다.
- Worker bindings 타입을 정의한다.
- 요청 입력과 외부 응답을 검증한다.
- 반환 타입을 명확하게 유지한다.
- 타입 오류를 무시하는 주석을 남발하지 않는다.
- tsconfig 설정을 임의로 완화하지 않는다.

가능하면 다음 명령으로 Worker 타입을 최신 설정에 맞춰 생성한다.

```bash
npx wrangler types
```

프로젝트에 기존 타입 생성 명령이 있으면 그 명령을 우선 사용한다.

---

# 24. Hono 규칙

Hono를 사용하는 프로젝트에서는 다음을 따른다.

- route, middleware, service 책임을 분리한다.
- binding 타입을 Hono 환경 타입에 연결한다.
- 공통 오류 응답 형식을 유지한다.
- 입력값은 Zod 또는 기존 검증 체계로 검사한다.
- 불필요한 Express 호환 계층을 추가하지 않는다.
- OpenAPI를 사용 중이면 API 변경과 문서를 함께 갱신한다.

기존 프로젝트가 Hono를 사용하지 않는다면 사용자 승인 없이 강제 변환하지 않는다.

---

# 25. D1 규칙

D1을 사용할 때 다음을 따른다.

- D1 binding 이름을 타입에 반영한다.
- `prepare()`와 `bind()`를 사용한다.
- 사용자 입력을 SQL 문자열에 직접 삽입하지 않는다.
- 스키마 변경은 migration 파일로 관리한다.
- 로컬과 원격 DB 실행 대상을 명확히 구분한다.
- 인덱스 필요성을 검토한다.
- 대량 변경은 batch 또는 적절한 트랜잭션 전략을 검토한다.

D1을 사용하지 않는 프로젝트에 D1을 강제로 도입하지 않는다.

---

# 26. R2 규칙

R2를 사용할 때 다음을 따른다.

- R2 binding을 통해 접근한다.
- 파일 메타데이터와 객체 키 규칙을 정의한다.
- 사용자 입력 파일명을 그대로 객체 키로 사용하지 않는다.
- MIME type과 파일 크기를 검증한다.
- 공개 파일과 비공개 파일의 접근 방식을 구분한다.
- 대용량 파일은 직접 업로드 또는 서명 URL 구조를 검토한다.

R2를 사용하지 않는 프로젝트에 버킷을 미리 생성하지 않는다.

---

# 27. Durable Objects 규칙

Durable Objects는 다음 상황에 사용한다.

- 게임방
- 채팅방
- 사용자 간 상태 동기화
- 실시간 협업
- 단일 키 기준의 순차 처리
- 여러 클라이언트 간 조정

단순 CRUD나 일반 DB 조회에는 사용하지 않는다.

사용 시 확인한다.

- Object ID 전략
- 객체별 책임 범위
- 저장 데이터
- 재시작 복원 방식
- WebSocket 연결 관리
- Hibernation 사용 가능 여부
- 과도하게 하나의 객체에 집중되는 구조 여부

---

# 28. GitHub 및 배포 규칙

GitHub를 기준 저장소로 사용한다.

기본 흐름:

```text
Read
→ Plan
→ Modify
→ Type Check
→ Test
→ Dry Run
→ Commit
→ Push
→ Cloudflare Workers Builds
→ Deployment Validation
```

main 브랜치가 운영 배포 브랜치라면 검증 없이 직접 Push하지 않는다.

사용자가 명시적으로 요청하지 않았다면 Codex가 임의로 Commit, Push, Merge 또는 배포하지 않는다.

자동 배포가 연결되어 있으면 Push가 운영 배포로 이어질 수 있음을 작업 전에 확인한다.

GitHub Actions와 Cloudflare Workers Builds를 중복 구성하지 않는다.

기존 배포 방식을 먼저 확인하고 하나를 기준으로 유지한다.

---

# 29. Cloudflare 검증

프로젝트에 정의된 스크립트를 우선 사용한다.

예:

```bash
npm run typecheck
npm run lint
npm test
npx wrangler deploy --dry-run
```

모든 명령이 존재한다고 가정하지 않는다.

package.json을 확인한 후 실제 존재하는 명령만 실행한다.

검증 항목:

- TypeScript strict 오류
- Hono route 오류
- Wrangler 설정 구문
- compatibility_date
- compatibility_flags
- Worker binding 타입
- 사용 중인 D1 binding
- 사용 중인 R2 binding
- 사용 중인 Durable Object binding
- migration 존재 여부
- Secret 하드코딩 여부
- Node.js API 사용 여부
- 배포 dry-run 결과
- GitHub 자동 배포 설정과 브랜치

사용하지 않는 D1, R2, Durable Objects의 binding 검증을 실패로 처리하지 않는다.

---

# 30. UTF-8 및 한글 보존 규칙

모든 텍스트 파일은 UTF-8 without BOM을 기본으로 유지한다.

다음 인코딩으로 변경하지 않는다.

- ANSI
- CP949
- EUC-KR
- UTF-16
- UTF-32

다음 작업을 금지한다.

- 한글을 `\uXXXX` 형태로 일괄 변환
- 인코딩 확인 없이 전체 파일 재작성
- PowerShell 기본 인코딩에 의존한 덮어쓰기
- `>` 또는 `Out-File`로 기존 한글 파일을 무검증 덮어쓰기
- 파일 전체를 새 문자열로 만들어 교체
- CRLF와 LF의 무의미한 일괄 변경

수정 절차:

1. 기존 파일의 인코딩과 EOL을 확인한다.
2. 기존 파일을 먼저 읽는다.
3. 필요한 부분만 최소 수정한다.
4. UTF-8 without BOM으로 저장한다.
5. 수정 전후 한글 문자열을 비교한다.
6. replacement character `�` 발생 여부를 확인한다.
7. 의도하지 않은 `\uXXXX` 변환을 확인한다.
8. Git diff에서 파일 전체가 변경되지 않았는지 확인한다.
9. 문제가 있으면 즉시 원복하고 다른 방식으로 다시 수정한다.

.editorconfig와 .gitattributes가 존재하면 해당 설정을 따른다.

없고 생성이 허용되면 다음 기준을 사용한다.

## .editorconfig 권장값

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
```

## .gitattributes 권장값

```gitattributes
* text=auto
*.ts text eol=lf
*.tsx text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yaml text eol=lf
*.yml text eol=lf
*.html text eol=lf
*.css text eol=lf
```

`working-tree-encoding`은 Git 환경과 도구 호환성을 확인한 경우에만 사용한다.

UTF-8 파일에는 기본적으로 강제 지정하지 않는다.

---

# 31. Secret 보호 규칙

다음 값은 출력·기록·Commit하지 않는다.

- .env 실제 값
- JWT Secret
- Cloudflare API Token
- R2 Access Key
- R2 Secret Key
- 서비스 계정 JSON
- 데이터베이스 비밀번호
- 사용자 개인정보
- 운영용 인증 토큰

예시 값이 필요하면 실제 값과 구분되는 가짜 placeholder를 사용한다.

---

# 32. 작업 종료 조건

다음 조건을 모두 충족해야 작업을 종료한다.

- 계획 작성 완료
- 파일 맵 작성 또는 갱신 완료
- 구현 내용 기록 완료
- 가능한 검증 실행 완료
- 실패 또는 미실행 항목 기록 완료
- UTF-8와 한글 확인 완료
- 변경 이력 갱신 완료
- 보류 항목 정리 완료

로그 없이 종료하지 않는다.

검증하지 않은 내용을 정상이라고 보고하지 않는다.

---

# 33. 후속 요청 처리

다음 요청은 기존 하네스를 이어서 처리한다.

- 하네스로 만들어줘
- 하네스로 기획해줘
- 하네스 구성
- 하네스 구축
- 하네스 점검
- Codex 프로젝트 구조 만들어줘
- 다시 만들어
- 일부 수정
- 구조 개선
- 스킬 추가
- 규칙 수정
- 기존 결과 기반 수정
- 테스트 시나리오
- 로그 구조 추가
- 재실행
- 업데이트
- 보완
- 후속 작업

기존 _workspace를 삭제하거나 초기화하지 않는다.

필요한 Phase만 부분적으로 다시 실행한다.

---

# 34. 실패 기준

다음 중 하나라도 발생하면 작업이 완료되지 않은 것으로 처리한다.

- _workspace 없이 구현 시작
- 기존 파일을 읽지 않고 수정
- 파일 맵에 없는 파일 수정
- 전체 파일 불필요한 덮어쓰기
- 한글 깨짐 발생
- 인코딩 또는 EOL 대량 변경
- Secret 노출
- 검증 실패를 숨김
- 실행하지 않은 테스트를 성공으로 기록
- 로그 없이 종료
- 사용자 승인 없이 Commit, Push 또는 배포
- Cloudflare에서 지원되는지 확인하지 않고 런타임 API 사용

---

# 35. 최종 원칙

- 기존 구조를 먼저 존중한다.
- 계획 후 수정한다.
- 최소 범위만 변경한다.
- Cloudflare 공식 방식을 우선한다.
- 필요한 Cloudflare 서비스만 사용한다.
- 보안과 Secret을 보호한다.
- UTF-8 한글을 보존한다.
- 검증 결과를 사실대로 기록한다.
- 기존 _workspace를 이어서 사용한다.