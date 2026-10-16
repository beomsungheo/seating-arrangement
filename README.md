# 자리 배치 프로그램 (VS Code 확장)

교실 자리를 무작위로 배치하고, 드래그로 바꾸고, 사용하지 않는 좌석을 지정할 수 있는 웹뷰 패널입니다.

## 사용법

명령 팔레트(`Ctrl+Shift+P`)에서:

- `자리 배치: 패널 열기`
- `자리 배치: 학생 목록 다시 읽기`
- `자리 배치: 파일에서 학생 목록 가져오기`

좌석을 **클릭**하면 사용 안 함으로 토글되고, 좌석끼리 **드래그**하면 서로 자리를 바꿉니다.

## 학생 목록 바꾸기

**패널 안에서 바로 편집** — 사이드바 아래 `학생 목록 편집` 버튼을 누르고, 이름을 쉼표나
줄바꿈으로 구분해 입력한 뒤 `저장`을 누릅니다. 사용자 설정에 기록되므로
**Settings Sync를 켜두면 다른 컴퓨터에도 자동으로 따라옵니다.**

**파일에서 가져오기** — 명령 팔레트에서 `자리 배치: 파일에서 학생 목록 가져오기`.
`.txt` / `.csv` 를 골라 한 번에 등록합니다.

목록을 찾는 순서:

1. 설정 `seatingArrangement.students` (패널 편집·파일 가져오기가 여기에 저장)
2. 워크스페이스의 `seatingArrangement.studentListFile` 파일 (기본값 `학생.txt`)
3. 확장에 포함된 샘플 목록

## 설정

| 설정 | 기본값 | 설명 |
| --- | --- | --- |
| `seatingArrangement.rows` | `6` | 좌석 행 수 |
| `seatingArrangement.cols` | `5` | 좌석 열 수 |
| `seatingArrangement.studentListFile` | `학생.txt` | 학생 목록 파일 경로 |
| `seatingArrangement.students` | `[]` | 학생 목록 직접 지정 |

배치 결과는 워크스페이스 단위로 저장되어, 패널을 닫았다 열어도 유지됩니다.

## 개발

- `F5` — 확장 개발 호스트 실행
- `npx @vscode/vsce package` — `.vsix` 생성
- `code --install-extension seating-arrangement-0.0.2.vsix` — 내 VS Code에 설치
