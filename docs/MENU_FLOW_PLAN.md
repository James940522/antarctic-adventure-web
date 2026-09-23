# WHITE HORIZON / ANTARCTIC RUN — 메뉴·일시정지 흐름

## 범위와 구현 순서

1. **완료:** React 메인 메뉴와 `classic | gaze` 모드 상태. 앱 진입 시 게임을 생성하지 않는다.
2. **완료:** 클래식 선택 시 기존 `GameCanvas` 마운트, 메뉴 복귀 시 제거, 다음 진입은 새 주행.
3. **완료:** ESC / 표준 패드 Menu·Start(buttons[9]) / HUD 버튼으로 일시정지. 거리·점프·장애물·랜드마크·평균 계산 정지.
4. **완료:** 계속하기·메인 메뉴를 가로 한 줄로 표시하는 React dialog. 회전 모바일에서도 스크롤 없이 배치.
5. **완료:** 시선추적 개발중 안내와 James 개발자 정보 모달. Tab 순환, ESC 닫기, 외부 링크 속성.
6. **완료:** 제공된 Opening / Main BGM 연결, 단일 audio 요소의 전환·반복·일시정지·재개·음소거.
7. **완료:** 이미지 경로를 사용자가 정리한 `public/asset/img/`로 변경. 메뉴·HUD·브라우저 제목을 최종 지정한 영문으로 통일.

## 상태와 자원 수명

`GameShell`은 screen/menu modal/mode만 reducer로 관리한다. `gaze` 선택은 개발중 안내만 표시하며 카메라나 Phaser를 실행하지 않는다. 클래식의 시뮬레이션은 기존 Phaser 계층에 남는다.

`RunSystem.manualPause`가 수동 일시정지의 원본이다. React는 스냅샷과 `GAME_EVENTS.pause` 이벤트를 사용한다. Phaser scene 전체를 pause하지 않고 입력 폴링을 유지하므로 패드로 재개할 수 있다. 창 이탈에 따른 자동 정지와 수동 정지는 구분하며, 재개할 때 첫 delta를 버려 시간이 한꺼번에 진행되지 않게 한다.

메뉴 복귀는 `GameCanvas`를 언마운트한다. 기존 cleanup에서 입력·resize·브리지 리스너를 정리하고 Phaser를 destroy한다. 모듈 범위의 제거 완료 Promise로 실제 destroy 이벤트 이후에 다음 인스턴스를 생성한다. 새 게임은 기존 localStorage 최고 기록만 불러온다.

`BackgroundMusic`은 하나의 audio 요소를 사용한다. 메뉴는 `01 - Opening.mp3`, 클래식은 `02 - Main Bgm.mp3`이며 화면 전환은 처음부터 재생한다. 일시정지/재개는 같은 위치를 유지한다. 사용자 클릭·키보드 입력 후 재생을 시도하고 autoplay 거부는 비치명적으로 처리한다. `03 - Stage Clear.mp3`, `04 - Bgm.mp3`는 현재 사용하지 않는다.

## 변경 파일

생성:

- `src/components/game/GameShell.tsx`, `MainMenu.tsx`, `GameDialog.tsx`, `PauseOverlay.tsx`, `Menu.module.css`
- `src/components/game/menu-state.ts`, `menu-state.test.ts`
- `src/game/config/audio.ts`
- `src/game/systems/BackgroundMusic.ts`, `BackgroundMusic.test.ts`
- 이 문서

수정:

- `src/app/page.tsx`, `src/app/layout.tsx`
- `src/components/game/GameCanvas.tsx`, `GameHud.tsx`
- `src/game/config/constants.ts`, `src/game/data/landmarks.ts`
- `src/game/input/KeyboardInput.ts`, `GamepadInput.ts`, `InputManager.ts`, `input.types.ts`, `input.test.ts`
- `src/game/scenes/GameScene.ts`
- `src/game/systems/RunSystem.ts`, `run.test.ts`, `landmarks.test.ts`
- `package.json`, `AGENTS.md`

사용자가 제공·정리한 에셋은 `public/asset/img/`와 `public/asset/bgm/`에 보존했다. 새 패키지는 설치하지 않았다.

## 검증

- 로직 테스트 74개 통과: 모드 전환, 개발자 링크, BGM 전환/거부, pause edge, 주행/랜드마크 정지·재개 포함.
- ESLint, TypeScript, `pnpm build --webpack` 통과. 기본 Turbopack 빌드는 실행 환경의 PostCSS 내부 프로세스 포트 권한 오류로 webpack을 사용했다.
- 브라우저에서 클래식 → 가속 1회 → 일시정지 → 메뉴를 3회 반복. 매번 게임 캔버스 1개, 메뉴에서 0개, audio 1개, 가속 14→22m/s 한 번만 적용, 새 거리로 시작함을 확인했다.
- 정지 중 거리와 BGM 재생 위치가 유지되고 ESC 재개 후 모두 이어짐을 확인했다.
- gaze 모달에서 캔버스 0개, 개발자 링크 href/target/rel, 모달 Tab/Shift+Tab 순환과 ESC 닫기를 확인했다. 이메일 발송이나 외부 계정 조작은 하지 않았다.
- 데스크톱 1280×800, 세로 모바일 390×844, 가로 모바일 844×390, 작은 화면 320×360을 검사했다. 일시정지 창의 clientHeight와 scrollHeight가 일치하고 계속하기·메인 메뉴가 같은 행에 배치된다. 작은 메뉴에서도 제목과 음소거 버튼이 겹치지 않고 세로 스크롤이 없다.
- 검증 구간의 브라우저 console error 없음.

실물 휴대폰·게임패드는 검증하지 못했다. 패드 edge는 모의 입력 테스트, 모바일은 브라우저 뷰포트 검사다. 오디오는 재생 상태·재생 위치·에셋 로드로 검증했다. 시선추적과 후속 이벤트 음악은 예정 기능이다.
