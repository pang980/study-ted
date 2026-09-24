# 검증 규칙

## 원칙

- 가능한 검증은 **실제로 실행**한다.
- 실행한 명령과 결과를 `_workspace/07_validation.md` 에 그대로 기록한다.
- 실행하지 못한 검증은 "미실행"으로 표시하고 이유를 적는다.
- **검증하지 않은 내용을 정상이라고 보고하지 않는다.**
- 실패를 숨기지 않는다. 실패 항목은 `_workspace/08_error_log.md` 에도 기록한다.

## 표준 검증 순서

1. 문법 검사

       Get-ChildItem main,renderer,scripts,test -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }

2. 단위 테스트

       npm test

3. Electron 부팅 스모크 (+ 스크린샷)

       npm run smoke

4. UI 대조

   `_tmp/smoke.png` 를 `UI.png` 와 비교한다(레이아웃·색상·문구).

5. 실제 데이터 수집 실측

   실제 유튜브 채널 1개를 동기화하고 `videos` / `transcripts` 저장 건수를 확인한다.

6. 인코딩·Secret 점검

       - 텍스트 파일 BOM 없음, U+FFFD 0
       - 문서/로그에 API 키 원문·`.env` 값 없음

## 판정 기준

| 항목 | 통과 조건 |
|---|---|
| 문법 | 오류 0 |
| 단위 테스트 | 실패 0 |
| 스모크 | 렌더러 콘솔 에러 0, 스크린샷 생성 |
| UI | 목업과 주요 블록·색상 일치 |
| 수집 | 채널 1개 → 영상 N개 + 자막 1개 이상 저장 |
| Secret | 키 원문 미노출 |
| 인코딩 | BOM 없음, U+FFFD 0, 한글 정상 |

## Secret 노출 확인

- `_workspace/*.md`, `README.md`, 로그에 키 문자열이 없는지 검색한다.
- 검색 시 실제 키 값을 명령에 쓰지 않는다(패턴으로만 확인).

    Select-String -Path '_workspace/*.md','README.md' -Pattern 'sk-or-' -SimpleMatch

## 금지

- 테스트를 통과시키기 위해 검증 기준을 낮추는 행위
- 실행하지 않은 테스트를 통과로 기록하는 행위
- 실패한 검증을 삭제하거나 은폐하는 행위
