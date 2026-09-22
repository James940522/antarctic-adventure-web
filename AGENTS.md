<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# antarctic-adventure-web — 프로젝트 작업 지침

이 문서는 저장소 전체의 구현 방향, 코드 구조, 작업 순서, 완료 기준을 정의한다. 사용자가 명시적으로 범위나 우선순위를 변경하면 그 요청을 따른다. 아래 디렉터리, 타입, 수식은 설계 기준이며, 모든 파일과 기능을 한 번에 만들라는 의미는 아니다.

## 1. 프로젝트 목표와 MVP

`antarctic-adventure-web`은 Antarctic Adventure 계열의 남극 탐험·레이싱 감각을 웹에서 재해석하는 프로젝트다. 저장소·패키지 이름은 유지하되, 사용자에게 표시하는 게임명은 나중에 독립적으로 변경할 수 있다.

게임은 **의사 3D 전방 스크롤 액션 게임**이다. 탑다운 시점이 아니다. 펭귄은 화면 하단 중앙 부근에 위치하고, 코스·장애물·아이템·풍경이 지평선에서 플레이어 쪽으로 다가온다. Phaser 2D와 원근 계산을 기본으로 사용하며, 명확한 기술적 이유 없이 실제 3D 엔진을 도입하지 않는다.

현재 기본 모드는 **박스 회피 거리 기록 모드**다. 아래 원래 기획과 충돌하면 이 모드의 규칙을 우선한다. 상세 구현 순서는 `docs/ENDLESS_RUN_PLAN.md`를 따른다.

- 페이지가 활성 상태이면 입력 없이 1단으로 자동 전진한다. ↑/↓ 또는 스틱·D-pad를 새로 입력할 때 한 단씩 변경하며 총 1~3단이다. 누른 채로는 반복 변속하지 않는다.
- 펭귄 크기의 네모 박스가 실제 전진량에 맞춰 다가온다. 횡방향 위치는 무작위이며 거리별 동시 생성 수는 1~6개다. 최고 속도와 횡이동 속도를 기준으로 연속해서 도달 가능한 통로를 보장한다.
- 박스와 실제 접촉하면 즉시 게임오버다. 충분한 점프 높이에서는 회피할 수 있다. 이 모드에는 피격 감속·제한 시간·목적지 클리어를 섞지 않는다.
- 이번 거리와 브라우저에 저장한 최고 기록을 표시하고 다시 시작할 수 있게 한다. 저장 실패는 비치명적으로 처리한다.
- 색은 선명한 고정 네온색을 사용한다. 빠른 섬광, 색상 급변, 화면 전체의 점멸은 넣지 않는다. 선택적 느린 테두리 효과는 움직임 줄이기 설정에서 끈다.
- 게임 영역 포커스는 입력을 제어하며 자동 전진의 전제 조건이 아니다. 창/탭 이탈 때는 시뮬레이션 전체를 일시정지한다.

현재 핵심 플레이 흐름:

```text
자동 전진 → 1~3단 속도 조절 → 좌우 이동·점프
→ 무작위 박스 회피 → 거리별 난이도 상승
→ 접촉 시 게임오버 → 거리·최고 기록 확인 → 다시 도전
```

MVP에 포함할 기능:

- 자동 전진, 좌우 이동, 가속·감속, 점프
- 키보드 방향키 및 게임패드·조이스틱 통합 입력
- 원근에 따른 위치·크기·접근 속도 변화
- 박스 생성, 공정한 회피 통로, 원근 접근, 충돌·점프 판정
- 이동 거리 점수, 최고 기록, 속도 단수, 난이도 HUD
- 충돌 게임오버, 기록 저장, 재시작

반응성, 가독성, 속도감이 시각적 복잡성보다 우선이다. 플레이 가능한 기본 루프를 먼저 완성한다. 곡선 코스, 비행 아이템, 모바일 조작, 고급 이펙트와 오디오는 후속 확장이다.

## 2. 기술 스택과 명령어

- Next.js App Router, React, TypeScript, Phaser, Tailwind CSS, ESLint, pnpm을 사용한다.
- 실제 버전과 설치 여부는 `package.json` 및 `pnpm-lock.yaml`을 기준으로 확인한다. 설치된 버전을 우선하며, 필요 없이 업그레이드·다운그레이드하지 않는다.
- 소스는 `src/`에 두고 `@/*` 별칭으로 `src/*`를 참조한다.
- Zustand, Redux, React Query, MobX 등 별도 상태 라이브러리는 실제 필요가 생기기 전까지 추가하지 않는다. 초기 게임 상태는 Phaser 게임 계층에서 관리한다.
- Phaser는 게임 연결 작업 시 없으면 설치한다. Prettier는 포맷 설정이 필요할 때 개발 의존성으로 추가할 수 있다. 문서 편집만 하는 작업에서 패키지를 설치하지 않는다.
- 패키지 관리는 pnpm으로 통일하고 다른 패키지 매니저의 잠금 파일을 추가하지 않는다.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm start
```

`pnpm start`는 빌드 후 프로덕션 실행 확인에 사용한다. 명령어 실행 전 현재 `package.json`의 scripts를 확인한다. 없는 `test`·`typecheck`·`format` 스크립트를 있다고 가정하지 않는다.

필요한 초기 의존성 추가 명령:

```bash
pnpm add phaser
pnpm add -D prettier
```

프로젝트 최초 생성 옵션은 다음과 같다. **기존 저장소에서 재실행하거나 프로젝트를 다시 생성하지 않는다.**

```bash
pnpm create next-app@latest antarctic-adventure-web \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

## 3. Next.js 문서와 브라우저 실행 경계

Next.js 관련 코드를 수정하기 전에 설치된 패키지의 `node_modules/next/dist/docs/`에서 해당 기능의 가이드를 읽는다. 기억에 의존해 이전 버전의 API나 관례를 적용하지 않는다. 특히 다음 문서를 확인한다.

- `01-app/01-getting-started/02-project-structure.md`
- `01-app/01-getting-started/05-server-and-client-components.md`
- `01-app/02-guides/lazy-loading.md`

이 파일 상단의 `BEGIN:nextjs-agent-rules` / `END:nextjs-agent-rules` 관리 블록을 보존한다. `next dev`가 관리하는 블록이므로 임의로 제거하거나 수정하지 않는다.

일반 페이지·레이아웃은 Server Component를 기본으로 유지한다. Phaser 호스트인 `GameCanvas.tsx`와 필요한 상호작용 경계에만 `"use client"`를 둔다.

**`"use client"`만으로 Phaser의 서버 평가가 차단되지는 않는다.** Phaser 및 이를 런타임에 import하는 scene 모듈은 브라우저에서만 로드한다. 클라이언트 effect 안에서 동적 import하거나, Client Component 안의 `next/dynamic`에 `ssr: false`를 설정하는 등 설치 버전에 맞는 방법을 사용한다. Server Component에 `ssr: false`를 직접 선언하지 않는다.

- 서버 렌더링 또는 모듈 초기 평가 중 `window`, `document`, `navigator`, `Phaser.Game`에 접근하지 않는다.
- 전용 컨테이너에 활성 `Phaser.Game` 인스턴스를 하나만 유지한다. 일반 React 재렌더링으로 게임을 재생성하지 않는다.
- 언마운트 때 게임 인스턴스, 이벤트 리스너, 구독, 타이머 등 소유한 자원을 정리한다.
- 비동기 import 완료 전에 언마운트되어도 뒤늦게 게임이 생성되지 않게 한다.
- 개발 환경의 Strict Mode, Fast Refresh, 페이지 재진입에서도 캔버스·게임 루프·입력 리스너가 중복되지 않아야 한다.

## 4. React와 Phaser의 책임

| 계층 | 책임 |
| --- | --- |
| Next.js / React | 페이지 외곽, 메뉴, 설정, 반응형 레이아웃, 로딩·오류 UI, Phaser 마운트 수명 주기, 필요한 HUD 오버레이 |
| Phaser | 게임 루프, scene, 플레이어 이동, 입력, 점프, 충돌, 코스 오브젝트, 스테이지, 타이머, 점수, 시뮬레이션 |

React가 프레임별 게임 상태를 구동하지 않게 한다. 매 프레임 `setState`를 호출하지 않는다. 게임 상태는 게임 계층에 두며, React에 필요한 정보만 명시적인 이벤트나 제한된 빈도의 스냅샷으로 전달한다. HUD가 게임 상태의 두 번째 원본이 되어서는 안 된다.

Tailwind와 CSS는 페이지, 게임 프레임, 메뉴, 버튼, 설정, 오버레이에 사용한다. 장애물과 플레이어 등 게임 오브젝트의 배치·렌더링은 Phaser가 담당한다. React 메뉴와 Phaser 메뉴 scene 중 책임을 정해 동일한 화면·상태를 중복 구현하지 않는다.

## 5. 권장 디렉터리 구조

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── game/
│       ├── GameCanvas.tsx
│       └── GameHud.tsx
├── game/
│   ├── config/
│   │   ├── constants.ts
│   │   └── game-config.ts
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   └── ResultScene.ts
│   ├── entities/
│   │   ├── Player.ts
│   │   └── CourseObject.ts
│   ├── input/
│   │   ├── InputManager.ts
│   │   ├── KeyboardInput.ts
│   │   ├── GamepadInput.ts
│   │   └── input.types.ts
│   ├── systems/
│   │   ├── PerspectiveSystem.ts
│   │   ├── ObstacleSystem.ts
│   │   ├── CollisionSystem.ts
│   │   ├── StageSystem.ts
│   │   └── ScoreSystem.ts
│   ├── data/
│   │   ├── stages.ts
│   │   └── obstacles.ts
│   ├── utils/
│   └── types/
└── types/

public/assets/game/
├── backgrounds/
├── player/
├── obstacles/
├── items/
├── bases/
├── flags/
├── ui/
├── audio/
└── effects/
```

필요할 때만 디렉터리와 파일을 만든다. 빈 추상화, 구현 없는 scene, 형식적인 인터페이스를 미리 늘리지 않는다. `src/game/types/`에는 게임 전용 타입을, `src/types/`에는 앱과 게임이 실제로 공유하는 타입을 둔다. 기존 코드의 일관된 명명 규칙이 있으면 우선한다.

## 6. 통합 입력 계약

입력 장치별 읽기 방식은 어댑터로 분리하되, 플레이어가 사용하는 게임 입력은 처음부터 하나로 통합한다.

```text
KeyboardInput ─┐
              ├── InputManager → GameInputState → Player
GamepadInput ─┘
추후 가상 조이스틱·터치 버튼도 같은 계약으로 연결
```

기본 계약 예시:

```ts
export type GameInputState = {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  brake: boolean;
  jump: boolean; // 현재 누르고 있는 상태
  horizontalAxis: number; // -1: 왼쪽, +1: 오른쪽
  verticalAxis: number; // -1: 가속(위), +1: 감속(아래)
  jumpPressed: boolean; // 이번 업데이트에서 눌림
  jumpReleased: boolean; // 이번 업데이트에서 해제됨
};
```

- `Player`는 정규화된 입력만 소비하며 키보드 이벤트, Xbox/PS 이름, 브라우저 API를 직접 검사하지 않는다.
- 축은 `[-1, 1]` 범위로 제한하고, 디지털 방향 플래그와 아날로그 축의 의미를 일치시킨다. 같은 입력을 플래그와 축 양쪽에서 중복 적용하지 않는다.
- `jump`는 held 상태다. 이전·현재 상태를 비교해 `jumpPressed`와 `jumpReleased`를 한 업데이트 동안만 전달한다. 누르고 있는 동안 매 프레임 새 점프를 시작하지 않는다.

### 키보드

| 입력 | 동작 |
| --- | --- |
| ← / → | 좌우 이동 |
| ↑ | 가속 |
| ↓ | 브레이크·감속 |
| Space | 점프 |
| A / D / W / S | 선택적인 방향키 대체 입력 |

방향키와 Space는 필수다. 게임 영역이 포커스된 경우에만 필요한 키의 브라우저 스크롤을 막는다. 페이지 전체나 입력 폼의 기본 키보드 동작을 방해하지 않는다. 게임 영역은 키보드로 포커스할 수 있어야 한다. 포커스를 잃으면 held 상태를 초기화해 키가 눌린 채 남지 않게 한다.

### 게임패드·조이스틱

게임패드 지원은 MVP 필수다. 브라우저 Gamepad API의 `navigator.getGamepads()`를 게임 업데이트에서 폴링한다. 연결 이벤트는 장치 발견·상태 안내에 사용하고, 입력 값을 연결 이벤트에만 의존하지 않는다.

표준 매핑의 기본값:

| API 입력 | 동작 |
| --- | --- |
| `axes[0]` | 좌우 이동 |
| `axes[1]` | 위: 가속, 아래: 감속 |
| `buttons[0]` | 남쪽 액션 버튼으로 점프: Xbox A / PlayStation Cross |
| `buttons[12]`, `buttons[13]` | D-pad 위·아래로 가속·감속 |
| `buttons[14]`, `buttons[15]` | D-pad 왼쪽·오른쪽으로 이동 |

- 아날로그 스틱과 D-pad를 모두 지원한다. Xbox 이름에 종속된 구현을 피한다.
- 이 인덱스는 standard mapping의 기본값이다. `mapping`, 축·버튼 존재 여부, 연결 상태를 확인하고 비표준 장치에 동일한 매핑을 보장한다고 가정하지 않는다.
- 장치가 없거나 API를 사용할 수 없는 경우 키보드 게임을 계속 제공한다. 연결 해제 시 해당 장치 입력을 중립화하고 크래시나 잔류 입력을 방지한다.
- 페이지 새로고침 없이 연결·해제를 반영한다. 장치 선택을 강제하는 모달을 띄우지 않는다.
- 브라우저가 장치를 노출하려면 버튼 입력 등 사용자 상호작용이 필요할 수 있다. 필요하면 간단한 연결 안내를 제공한다.

아날로그 deadzone 초기값은 `0.18`로 두고 상수로 관리한다. deadzone 내부는 0, 외부는 연속적인 값으로 재정규화한다.

```ts
function applyDeadzone(value: number, deadzone = 0.18): number {
  const magnitude = Math.min(1, Math.abs(value));
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}
```

### 장치 동시 사용

키보드와 게임패드는 연결된 상태에서 설정 변경 없이 즉시 전환할 수 있어야 한다. 중립 아날로그 입력이 키보드를 덮어쓰지 않게 하고, deadzone을 넘는 입력만 의미 있는 입력으로 취급한다.

초기 병합 규칙은 다음처럼 단순하고 결정적으로 유지한다. 기존 구현에서 다른 명확한 규칙을 사용한다면 유지하고 문서화한다.

- 한 축에서 서로 반대인 디지털 방향은 상쇄한다.
- 방향키 또는 D-pad가 눌린 축에는 디지털 입력을 우선하고, 그 외에는 정규화된 스틱 값을 사용한다.
- 모든 장치의 점프 held 상태를 합친 뒤 이전·현재 값을 비교해 한 번의 점프 edge를 만든다. 장치 전환 때문에 중복 점프가 발생하지 않게 한다.
- 최신 유효 입력 장치 표시는 허용하지만, 입력 전환 자체를 별도 설정에 종속시키지 않는다.

## 7. 플레이어, 속도, 점프

플레이어는 코스 폭 안에서 수평 이동한다. 초기 구현은 화면 좌표로 시작할 수 있지만, 원근·충돌·반응형 화면에 공통으로 사용할 논리 좌표 `player.courseX`를 우선한다. CSS 픽셀을 월드 좌표로 사용하지 않는다.

펭귄은 지평선의 진행 방향을 바라보는 **뒷모습**으로 표시한다. 입력 표시만 갱신하지 말고 실제 캐릭터 이동과 연결한다. 좌우 경계에서는 날개·몸체와 애니메이션 여유 폭까지 고려하여 캐릭터 전체가 화면 안에 남게 한다.

현재 속도 모델은 `speedLevel`과 `currentSpeed`로 표현한다. 총 3단 속도를 상수 배열로 관리하고 ↑/↓를 새로 입력했을 때 한 단 올리거나 내린다. 1단에서도 전진하며 입력을 놓으면 단수를 유지한다. 속도는 이동 거리, 장애물 접근, 배경 이동에 일관되게 반영한다. 이전의 연속 가감속·피격 감속 모델은 현재 모드에 적용하지 않는다.

점프는 화면상 Y 이동만으로 구현하지 않는다. 접지·상승·낙하와 점프 높이 또는 경과 시간을 게임 상태로 관리하고, 해당 상태가 장애물 회피 판정에 반영되어야 한다. 읽기 쉬운 아케이드식 궤적을 사용한다. 의도하지 않은 공중 재점프나 누른 채 자동 연속 점프를 허용하지 않는다.

상태는 필요에 따라 판별 가능한 유니온으로 명확하게 표현한다.

```ts
type PlayerState =
  | { type: "RUNNING" }
  | { type: "JUMPING"; elapsedSeconds: number }
  | { type: "HIT"; remainingSeconds: number }
  | { type: "TRAPPED" };
```

플레이어 상태와 스테이지 진행 상태의 책임을 구분한다. 단순한 아케이드 조작에 과도한 물리 시뮬레이션을 도입하지 않는다.

## 8. 의사 3D 원근과 코스

원근 계산은 `PerspectiveSystem` 같은 한 곳에 모은다. 각 장애물 클래스에 투영 수식을 복제하지 않는다.

- 정규화된 깊이 예시: `depth = 0`은 지평선, `depth = 1`은 플레이어 접촉 지점이다.
- 먼 오브젝트는 작고 지평선 가까이에 있으며 화면상 이동이 느리다.
- 가까운 오브젝트는 크고 화면 하단으로 접근하며 화면상 이동이 빨라진다.
- `screenX`, `screenY`, `scale`, 코스 폭은 같은 논리 깊이에서 계산한다.
- 깊이는 실제 전진 거리나 상대 거리와 연결한다. 시각적 스크롤과 스테이지 진행을 별도 속도로 구동하지 않는다.

시작점으로 사용할 수 있는 단순한 투영 개념:

```ts
screenY = horizonY + depth * depth * courseHeight;
scale = minScale + depth * (maxScale - minScale);
courseHalfWidth = farWidth + depth * (nearWidth - farWidth);
screenX = centerX + courseX * courseHalfWidth;
```

값은 플레이 감각에 맞게 조정한다. 수학적으로 완전한 카메라 모델보다 안정된 투영과 가독성이 우선이다. 코스는 플레이어 쪽으로 넓어져야 한다. 가까운 오브젝트가 자연스럽게 앞에 표시되도록 렌더링 순서를 관리한다.

MVP는 직선 코스로 시작한다. 추후 `courseCenterOffset(progress)` 같은 방식으로 코스 중심 이동과 곡선의 바깥쪽 쏠림을 추가할 수 있게 하되, 직선 조작이 완성되기 전에 곡선을 구현하지 않는다.

## 9. 장애물과 충돌

현재 초기 장애물은 네온 정사각형 박스다. 크기는 플레이어 접촉 지점에서 펭귄과 비슷하게 표시한다. 생성·접근·회피·충돌·회수와 도달 가능한 통로를 먼저 완성한다. `ICE_HOLE`, `CREVASSE`, `SEAL`, `ICE_BLOCK`, `ROCK` 등은 후속 별도 콘텐츠이며 아래 데이터 예시는 그 확장 참고다.

```ts
type ObstacleDefinition = {
  type: ObstacleType;
  width: number;
  collisionWidth: number;
  jumpable: boolean;
  speedPenalty: number;
  scoreValue?: number;
};
```

- 장애물 속성은 가능한 범위에서 데이터로 정의한다. `GameScene`에 거대한 종류별 조건문을 만들지 않는다.
- 생성은 지평선 부근에서 시작하고, 지나간 오브젝트는 제거하거나 재사용한다.
- 판정은 논리적인 종방향 거리·깊이, 횡방향 위치·충돌 폭, 점프 상태를 함께 고려한다. 커진 스프라이트의 화면 사각형만으로 먼 장애물에 충돌하지 않게 한다.
- 한 장애물과 접촉하는 동안 매 프레임 페널티나 점수를 중복 적용하지 않는다.
- 현재 박스 접촉은 즉시 게임오버이며 충돌 시점의 거리로 기록을 확정한다. 원래 시간제 스테이지 모드를 다시 만들 때만 별도의 피격·속도 감소 규칙을 설계한다.
- 점프 가능한 장애물은 적절한 높이와 타이밍에 뛰었을 때 통과할 수 있어야 한다.

크레바스의 간단한 특수 처리: 점프하지 않은 접촉 → `TRAPPED` → 전진 정지 또는 큰 감속 → 새 점프·액션 입력으로 탈출 → 주행 복귀. 탈출 중에도 스테이지 시간은 흐른다. 세부 연출보다 명확한 상태 전환을 먼저 구현한다.

## 10. 거리 점수와 후속 시간제 스테이지

현재 `RunSystem`은 RUNNING → GAMEOVER와 실제 전진 거리 점수를 관리한다. `RecordStore`가 완료한 주행의 최고 정수 미터 기록을 해당 origin의 localStorage에 저장한다. 최고 기록 저장이 막히면 메모리에서 유지한다. 재시작은 거리·시간·속도 단수·점프·입력·장애물을 초기화하고 최고 기록만 보존한다. 아래 스테이지·타이머 규칙은 후속 별도 모드에만 적용한다.

스테이지는 데이터로 정의한다.

```ts
type StageDefinition = {
  id: number;
  name: string;
  destination: string;
  distance: number;
  timeLimitSeconds: number;
  difficulty: number;
  obstacleDensity: number;
};
```

첨부 기획의 초기 참고 경로는 `Australia → France → Australia → New Zealand → South Pole → United States → Argentina → United States → United Kingdom → Japan`이다. 원작의 정확한 경로를 검증한 사실로 단정하지 않으며, 웹 버전의 밸런스와 콘텐츠에 맞게 조정할 수 있다. MVP는 한 개 스테이지부터 완성한다.

- `distanceTravelled`를 시뮬레이션에서 계산하고 `distanceRemaining`을 목표 거리에서 파생한다. HUD 진행 막대만 별도로 움직이지 않는다.
- 스테이지마다 제한 시간을 두고, `remainingTime <= 0`이면 `TIME_UP` 및 게임 오버로 전환한다.
- 실행 상태 예시: `READY`, `RUNNING`, `STAGE_CLEAR`, `TIME_UP`. `HIT`, `TRAPPED`는 플레이어 상태로 관리할 수 있다.
- 도착 시 `RUNNING → STAGE_CLEAR → 결과 화면 → 다음 스테이지`로 진행한다. 마지막 스테이지의 완료 처리도 명시한다.
- `HIT`·`TRAPPED` 중에는 시간을 계속 계산하되, 클리어·시간 초과 이후에는 일반 주행·충돌·점수 갱신을 중지한다.
- 도착과 시간 초과가 같은 업데이트에서 발생하는 경우 판정 순서를 명시하고 일관되게 처리한다. 종료 전환과 보너스는 한 번만 실행한다.
- 재시작은 시간, 거리, 속도, 점프·피격 상태, 입력 edge, 오브젝트, 스폰 상태, 점수를 해당 재시작 범위에 맞게 초기화한다.

기본 점수는 MVP에 포함한다. 수집, 장애물 통과, 스테이지 완료, 남은 시간 보너스 중 먼저 구현한 행동에 점수를 연결한다. 점수와 밸런스 값은 `ScoreSystem` 및 데이터·상수에서 관리하고 UI 문구와 분리한다.

아이템 후보는 `FLAG`, `FISH`, `SPECIAL_FLAG`, `PROPELLER`다. 프로펠러의 일시 비행은 선택적 후속 기능으로, 시간제 파워업 또는 플레이어 상태로 구현한다. 이를 위해 별도 이동 엔진을 만들지 않는다.

## 11. HUD, 화면, 아트, 오디오

HUD는 `SCORE`, `TIME`, `DISTANCE`, `SPEED`, `STAGE`를 읽기 쉽게 표시한다. 절제된 레트로 스타일을 사용하고 장애물과 플레이어를 가리지 않는다.

- 기본 논리 해상도는 `960 × 540` 또는 필요에 맞는 다른 16:9 해상도다.
- Phaser `FIT` 또는 동등한 전략으로 화면에 맞추고 가로·세로를 독립적으로 늘리지 않는다.
- 데스크톱·태블릿 화면에서 캔버스와 HUD가 잘 보이게 한다. 시뮬레이션 좌표는 CSS 크기와 분리한다.
- 모바일은 첫 입력 대상이 아니지만, 추후 가상 조이스틱과 점프 버튼을 기존 `InputManager`에 연결할 수 있게 한다.
- 밝은 파랑·청록 하늘, 흰 남극 지면, 먼 얼음 산, 뚜렷한 지평선, 화면 하단 펭귄의 구도를 유지한다.
- 초기에는 도형과 자체 제작 임시 에셋을 사용한다. 원작 스프라이트, ROM 그래픽, 추출 음원 등 독점 에셋을 복사하지 않는다.
- 런타임 에셋은 `public/assets/game/`에 두고 `/assets/game/...` 경로로 참조한다.
- 에셋 파일명은 소문자 kebab-case로 작성한다. 예: `penguin-run-01.png`, `ice-hole.png`, `seal-idle.png`. `final2.png` 같은 모호한 이름을 피한다.

오디오는 첫 기술 프로토타입에서 선택 사항이다. 도입하면 음악 볼륨, 효과음 볼륨, 음소거 상태를 한곳에서 관리한다. 브라우저 정책에 맞게 사용자 상호작용 후 재생하고, 자동 재생 거부가 게임 초기화를 실패시키지 않게 한다.

## 12. 게임 루프, 성능, 코드 품질

업데이트의 개념적인 순서는 다음과 같다. 상태에 따라 실행 가능한 단계만 수행한다.

```text
입력 읽기 → 플레이어 상태·속도 갱신 → 전진 거리 갱신
→ 코스 오브젝트 생성·갱신 → 원근 투영 → 충돌 처리
→ 점수·시간 갱신 → 스테이지 종료 판정
```

- 연속 이동과 타이머에 Phaser delta를 사용한다. 밀리초·초 단위를 명확히 하고, 60 FPS 고정 프레임 수에 의존하지 않는다.
- 탭 복귀나 긴 프레임 지연으로 순간 이동·충돌 누락·예상하지 못한 시간 손실이 생기지 않게 한다. 필요하면 일시정지와 delta 제한·분할 정책을 정하고 거리와 시간에 일관되게 적용한다.
- 일반적인 현대 데스크톱에서 약 60 FPS를 목표로 한다. 고주사율 화면에서도 실제 게임 속도가 변하지 않아야 한다.
- hot loop에서 불필요한 객체·배열 할당, DOM 연산, 반복적인 텍스처 생성·파괴를 피한다. 큰 텍스처는 최적화한다.
- 자주 생성하는 장애물·아이템에서 필요가 확인되면 풀링한다. hot path가 아닌 코드를 성급하게 최적화하지 않는다.
- `GameScene.update()`가 비대해지면 입력·원근·충돌·스테이지 등 의미 있는 책임으로 분리한다.
- 속도, 가속도, 점프 시간, 충돌 페널티, deadzone, 지평선 비율, 점수 등 튜닝 값은 `config/constants.ts`와 관련 데이터에 모은다.
- strict TypeScript를 유지하고 `any`를 피한다. 불명확한 외부 입력은 검증하고 좁혀 사용한다. 단순한 값에 과도한 타입 계층을 만들지 않는다.
- 개발용 FPS, 속도, `courseX`, 게임패드 축, 진행도, 활성 장애물 수 표시는 쉽게 끌 수 있게 한다. 프로덕션 경로에 시끄러운 로그를 남기지 않는다.
- 게임패드 부재와 자동 재생 거부는 정상적인 비치명적 상황이다. 선택적 에셋 누락은 가능한 범위에서 대체 표현으로 처리하되, 핵심 scene 초기화 실패는 명확하게 드러낸다. 오류를 조용히 삼키지 않는다.

## 13. 기본 구현 순서

사용자가 우선순위를 바꾸지 않았다면 아래 순서를 따른다. 한 단계가 실제로 작동하는지 확인한 뒤 다음 단계로 진행한다.

1. **실행 기반:** Next.js에 Phaser 연결, 고정 논리 해상도, BootScene·GameScene, 임시 플레이어, 생성·해제 수명 주기.
2. **입력:** InputManager, 방향키·Space, 게임패드 폴링, deadzone, 장치 연결·해제 및 즉시 전환.
3. **움직임:** 좌우 이동, 자동 전진, 가속·브레이크, 점프 상태와 궤적.
4. **원근:** 지평선, 깊이, Y 투영, 크기, 코스 폭과 횡방향 투영.
5. **장애물:** 네온 박스 생성·접근·회수, 연속 회피 통로, 거리별 동시 생성 수, 즉사 충돌과 점프 회피.
6. **플레이 루프:** 무한 거리 기록, 최고 기록 저장, 속도·난이도 HUD, 게임오버·재시작. 기존 시간제 스테이지는 후속 별도 모드로 분리.
7. **콘텐츠:** 자체 아트, 아이템과 점수 확장, 목적지 기지, 추가 스테이지, 선택적 오디오.
8. **후속 개선:** 곡선, 피격 애니메이션, 눈·파티클, 화면 피드백, 컨트롤러 안내, 성능 개선.

핵심 움직임이 완성되기 전에 복잡한 콘텐츠나 엔진 구조를 먼저 만들지 않는다.

## 14. 검증과 완료 기준

변경 범위에 맞는 검증을 수행한다. 코드 변경 시 린트, 타입 검사, 빌드를 실행하고 브라우저에서 실제 동작을 확인한다. 문서만 수정했다면 diff, 문서 구조, 경로·명령의 정확성 확인으로 충분하다. 테스트가 이미 있으면 관련 테스트를 실행하고, 입력 정규화·충돌·상태 전환 등 회귀 위험이 있는 로직에는 필요한 경우 의미 있는 테스트를 추가한다. 단순 변경을 위해 불필요한 테스트 프레임워크를 도입하지 않는다.

수동 검증 항목:

- ←·→ 이동, ↑ 가속, ↓ 감속, Space 한 번의 점프 및 방향·점프 동시 입력.
- 길게 누른 버튼의 중복 점프 방지, 포커스 이탈 후 잔류 입력 방지, 게임 밖 키보드 동작 유지.
- 페이지 재로드 없는 게임패드 연결·해제, 스틱·D-pad 이동 및 속도 조절, 남쪽 버튼 점프.
- deadzone의 드리프트 방지, 게임패드를 연결한 상태의 키보드 입력, 장치 간 즉시 전환.
- 지평선에서 시작해 커지고 빨라지는 장애물, 안정적인 X/Y 투영과 화면 크기 변경.
- 예상한 깊이에서의 충돌, 점프로 회피 가능한 장애물 통과, 한 번의 충돌 페널티, 크레바스 탈출.
- 실제 전진에 따른 거리, 타이머 만료, 도착 시 클리어, 점수·보너스의 중복 적용 방지.
- 클리어·시간 초과 후 시뮬레이션 종료, 재시작 시 전체 관련 상태 초기화.
- SSR 및 프로덕션 빌드, 마운트·언마운트·Fast Refresh 후 중복 캔버스·리스너 부재.

데스크톱 Chrome, Edge, Safari, Firefox를 우선 지원한다. OS·브라우저마다 게임패드 매핑과 연결 동작이 다를 수 있다. 실제 하드웨어를 사용할 수 없다면 그 한계를 보고하고, 모의 입력 테스트를 실제 게임패드 검증으로 표현하지 않는다.

MVP 완료 조건:

- 페이지가 런타임 오류 없이 열리고 Phaser와 펭귄이 정상 표시된다.
- 키보드와 연결된 표준 게임패드가 모두 이동·가감속·점프를 수행한다.
- 스틱 드리프트가 걸러지고 입력 장치를 즉시 전환할 수 있으며 1~3단 속도가 명확하게 표시된다.
- 장애물이 지평선에서 접근하며 원근에 따라 커진다.
- 거리별 박스 수 증가에도 최고 속도에서 도달 가능한 회피 경로가 남는다.
- 박스 접촉과 충분한 높이의 점프 회피가 실제 게임 결과에 반영된다.
- 이동 거리 점수, 최고 기록, 속도·난이도 HUD가 실제 게임 상태와 일치한다.
- 접촉 게임오버, 최고 기록 보존, 깨끗한 재시작이 가능하다.

시각적 완성도는 MVP 완료의 전제 조건이 아니다. 먼저 플레이 가능해야 한다.

## 15. 저장소 작업 원칙과 참고 자료

작업 전 기존 구조와 diff를 확인하고, 사용자의 변경 및 의도된 기존 동작을 보존한다. 작은 단위로 수정하고 불필요한 전면 재작성·의존성·추상화를 피한다. Phaser와 React의 경계를 유지하고 키보드·게임패드 기능을 함께 검증한다. 여러 접근이 가능하면 이후 입력 장치·스테이지 확장을 막지 않는 가장 단순한 방식을 선택한다.

완료 보고에는 의미 있는 변경, 검증 결과, 검증하지 못한 사항을 간단히 설명한다. 문서에 적힌 계획을 이미 구현된 기능으로 표현하지 않는다.

- 기획 기준: 사용자가 제공한 프로젝트 설명과 Next.js + Phaser 초기 구성 제안.
- 게임 참고: [결국 남극대모험 — 나무위키](https://namu.wiki/w/%EA%B2%B0%EA%B5%AD%20%EB%82%A8%EA%B7%B9%EB%8C%80%EB%AA%A8%ED%97%98). 작성 시 본문 접근이 되지 않아 이 문서의 게임 요구사항은 첨부 기획을 기준으로 정리했다.
- 지침 파일 참고: [OpenAI 공식 AGENTS.md 가이드](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- Next.js 구현 기준: 저장소에 설치된 `node_modules/next/dist/docs/`의 관련 가이드.
