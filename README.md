# Mobile CSS Inspector (SillyTavern Extension)

모바일에서도 쓸 수 있는 읽기 전용 간이 개발자도구입니다. 화면을 탭하면 그 요소의
computed CSS, box model, 속성을 하단 패널에서 확인할 수 있습니다.

## 설치 방법

1. 이 폴더(`mobile-css-inspector`) 전체를 SillyTavern의 확장 폴더에 넣습니다.
   - 모든 사용자 적용: `public/scripts/extensions/third-party/mobile-css-inspector/`
   - 또는 SillyTavern 내부 메뉴 `Extensions → Install Extension`에서
     이 폴더를 깃 저장소로 올린 뒤 URL로 설치
2. SillyTavern을 새로고침하면 화면 정중앙에 🐛 버튼이 떠 있습니다.

## 버튼 위치 옮기기

- **짧게 탭** → 선택 모드 on/off
- **누른 채로 드래그** → 버튼을 원하는 위치로 이동 (화면 밖으로는 나가지 않게 자동으로 막아줍니다)
- 화면 회전/크기 변경 시에도 화면 안쪽으로 자동 보정됩니다.

## 사용 방법

1. 🐛 버튼을 짧게 탭해서 선택 모드를 켭니다 (버튼이 초록색으로 바뀜).
2. 화면에서 보고 싶은 요소를 탭합니다.
   - 해당 요소에 초록 테두리 하이라이트가 표시됩니다.
   - 화면 하단에서 정보 패널이 열립니다.
3. 패널 안의 탭으로 전환:
   - **Styles**: 그룹별 computed CSS (Layout / Size / Flex·Grid / Typography / Background·Border / Transform)
   - **Box Model**: margin → border → padding → content 시각화 + 렌더링 크기
   - **Attributes**: 해당 요소의 HTML 속성들
4. 패널 상단의 경로(breadcrumb)를 탭하면 부모 요소로 이동해서 볼 수 있습니다.
5. Styles/Attributes 탭에서 각 행을 탭하면 `prop: value;` 형태로 클립보드에 복사됩니다.
6. 패널 상단 핸들을 위/아래로 드래그하면 패널 높이를 조절할 수 있습니다.
7. 다시 🐛 버튼을 탭하면 선택 모드가 꺼지고, 패널의 ✕ 를 누르면 패널이 닫힙니다.

## 참고

- 읽기 전용입니다. CSS 값을 수정하는 기능은 없습니다(요청하신 스펙).
- SillyTavern 자체 UI 요소(채팅 메시지, 버튼 등)도 동일하게 탭해서 검사할 수 있습니다.
  선택 모드 중에는 탭이 가로채여지므로 메시지 전송 등 원래 동작은 일어나지 않습니다.
- 코드는 순수 JS + DOM API만 사용하므로 추가 의존성이 없습니다.
