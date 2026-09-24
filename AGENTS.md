# AGENTS.md

## Start
1. `skills/harness/SKILL.md` 확인
2. `_workspace/00_input.md`부터 순서대로 읽기
3. `_workspace/03_task_board.md` 기준으로 작업

---

## Flow
입력 → 분석 → core 선택 → 계획 → 수정 → 검증 → 기록

---

## Rules
- 수정시 UTF-8 인코딩 유지
- 전체 파일 덮어쓰기 금지
- 기존 파일 먼저 읽기
- 작은 단위 수정
- `.env` 값 출력 금지
- rules/ 디렉토리 규칙 반드시 준수

---

## Workspace
작업 상태는 `_workspace`에만 기록한다.

- 작업: `_workspace/03_task_board.md`
- 계획: `_workspace/05_edit_plan.md`
- 구현: `_workspace/06_implementation_spec.md`
- 검증: `_workspace/07_validation.md`
- 에러: `_workspace/08_error_log.md`
- 결정: `_workspace/99_decisions.md`

---

## Safety
- `_workspace/04_file_map.md` 기준으로만 수정
- 수정 금지 파일은 건드리지 않는다

---

## 재실행
수정/보완 요청 시 기존 `_workspace` 이어서 작업 (초기화 금지)

---

## Harness
하네스 기준:
`skills/harness/SKILL.md`