# 파일 수정 규칙

## 필수 절차

1. 수정 전에 대상 파일을 **먼저 읽는다**.
2. 파일의 **인코딩과 EOL 을 확인**한다. (기준: UTF-8 without BOM / LF)
3. `_workspace/04_file_map.md` 에 있는 파일만 수정한다. 없으면 파일 맵을 먼저 갱신한다.
4. **최소 범위**만 수정한다. 관련 없는 리팩터링·정렬·공백 변경을 하지 않는다.
5. 기존 구조·설정·네이밍을 유지한다.
6. 저장 후 아래를 확인한다.
   - `U+FFFD` (replacement character) 0 개
   - BOM 없음 (첫 3바이트가 `EF BB BF` 가 아님)
   - 한글 문자열이 수정 전후 동일
   - 의도하지 않은 `\uXXXX` 변환 없음

## 금지 사항

- **전체 파일 덮어쓰기** (기존 파일을 새 내용으로 통째 교체)
- `>` 또는 `Out-File` 로 한글이 포함된 기존 파일을 무검증 덮어쓰기
- 인코딩 변경: ANSI / CP949 / EUC-KR / UTF-16 / UTF-32
- CRLF ↔ LF 무의미한 일괄 변경
- 한글을 `\uXXXX` 로 일괄 변환
- 수정 금지 파일(`.env`, `node_modules/**`, `UI.png`) 접촉

## 허용 예외

- 이번 라운드에서 **새로 생성한 문서 파일**의 초기 작성/오타 수정은 전체 재작성으로 처리할 수 있다.
  단, 작성 완료 후에는 위 절차를 따른다.

## 검증 스니펫 (PowerShell)

    Get-ChildItem <대상> -Recurse -Filter *.md | ForEach-Object {
      $t = [System.IO.File]::ReadAllText($_.FullName, (New-Object System.Text.UTF8Encoding($false)))
      $bad = ($t.ToCharArray() | Where-Object { [int]$_ -eq 0xFFFD }).Count
      $bom = (([System.IO.File]::ReadAllBytes($_.FullName))[0..2] -join ',') -eq '239,187,191'
      "{0} FFFD={1} BOM={2}" -f $_.Name, $bad, $bom
    }
