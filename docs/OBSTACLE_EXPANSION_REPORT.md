# 13종 장애물 확장 보고

> 2026-09-24 후속 조정: 바리케이드는 전체 폭을 유지하면서 세로만 기존의 30%로 압축했다(접촉 높이 약 333px → 100px). 아래 최초 구현의 비율 유지 설명에서 바리케이드는 예외이며, 충돌 높이 72와 점프 높이 150은 유지한다.

## 1. 기존 obstacle 구조 분석 결과

실제 코스는 7개 레인(`-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9`)이며 이동은 연속적인 `courseX`다. 충돌은 CSS/화면 좌표가 아닌 정규화된 X·월드 거리·점프 높이로 계산한다. `ObstacleSystem.items`가 장애물 목록의 단일 원본이고 `nextGroupDistance`로 거리 기반 생성한다. 일반 묶음은 2/3/4개 단계와 6~12m 엇갈림을 사용했다. `PerspectiveSystem`, `CourseView`, `CollisionSystem`, `Player`, `BootScene`을 확장·재사용했으며 별도 장애물 엔진은 만들지 않았다.

## 2. 수정한 파일

- `src/game/data/obstacles.ts`: 13종 정의, 점유 레인·공통 형상 계산, 스폰 설정.
- `src/game/systems/ObstacleSystem.ts`: 인스턴스 생성, 폭별 shuffle bag, 전체 폭 단독 생성, 속도별 여유 거리.
- `src/game/systems/CollisionSystem.ts`, `ItemSystem.ts`: 인스턴스에서 충돌 폭·높이를 공유.
- `src/game/systems/CourseView.ts`, `PerspectiveSystem.ts`, `LandmarkView.ts`: 전체 폭 이미지·디버그, 고속 시야, 랜드마크의 기존 접근 비율 유지.
- `src/game/systems/RunSystem.ts`, `src/game/scenes/GameScene.ts`: 실제 속도를 생성·시야에 전달, 개발용 고정 장면 연결.
- `src/components/game/GameCanvas.tsx`: 13종 및 바리케이드 조작 안내.
- `CourseView.test.ts`, `obstacles.test.ts`, `items.test.ts`, `run.test.ts`, `landmarks.test.ts`, `ScoreSystem.test.ts`, `ManualRecordSave.test.ts`: 새 공통 생성 함수로 테스트 장애물을 구성하고 변경된 생성 규칙을 검증.
- `AGENTS.md`, `README.md`, `docs/OBSTACLE_ASSETS_PLAN.md`: 현재 최종 사양과 이전 6종 기록의 우선순위를 명시.

이전 작업의 기본 속도 증가·랭킹·마운트 수명 관리 변경은 유지했다.

## 3. 새로 만든 파일

- `src/game/systems/ObstacleDebugScenario.ts`: 개발 환경에서만 사용하는 고정 장애물 장면. 실제 Phaser 프레임 루프에서 수동 또는 단일 자동 점프를 검증한다.
- `src/game/systems/obstacle-occupancy.test.ts`: 레인 수별 점유·충돌, 바리케이드 6개 경우, 고속 여유 거리.
- 이 보고서.

신규 그림 7개는 사용자가 제공한 PNG를 사용했다. 지시에 따라 `uel-drums.png` → `fuel-drums.png`, ` ice-patch.png` → `ice-patch.png`로 이름을 바꿨다. 이미지 내용은 편집하지 않았다.

## 4. ObstacleDefinition 구조

`id`, `name`, `assetKey`, `assetPath`, `assetFrame`, `laneSpan: 1 | 2 | "full"`, `collisionType: "solid" | "groundHazard"`, `jumpable`, `visualScale`, `hitbox`, 선택적인 `requiredJumpHeight`를 가진다. 픽셀 크기와 충돌 크기는 정의에 고정하지 않고 실제 점유 레인에서 생성 시 계산한다.

| ID | laneSpan | 판정 |
| --- | --- | --- |
| snow-drift | 1 | solid |
| supply-crate | 1 | solid |
| ice-rock | 1 | solid |
| ice-hole | 1 | groundHazard |
| ice-spikes | 1 | solid |
| fuel-drums | 1 | solid |
| ice-patch | 1 | groundHazard |
| crevasse | 2 | groundHazard |
| seal | 2 | solid |
| broken-sled | 2 | solid |
| fallen-antenna | 2 | solid |
| snow-fence | 2 | solid |
| barricade | full | solid |

미끄러짐 물리·물개 이동·새 효과는 추가하지 않았다.

## 5. 1칸 장애물 구현 방식

시작 레인 0~6 중 덜 사용한 위치를 우선한다. 한 레인 중심에 이미지와 판정을 배치하며 종류별로 하단 몸체·중앙 위험 영역을 좁게 판정한다. 일반 묶음의 다른 장애물 점유 레인과 겹치지 않는다.

## 6. 2칸 장애물 구현 방식

시작 레인 0~5와 그 다음 레인을 실제로 함께 점유한다. 두 레인 중심의 평균에 이미지 하나를 배치한다. 종방향 판정은 1칸과 같은 ±1.6m다. 다섯 종류 모두 점유한 각 레인에서 지면 충돌하며, 빈 레인 또는 정상 점프로 회피할 수 있다.

## 7. full 바리케이드 구현 방식

`"full"`을 현재 레인 수로 해석하고 시작 레인 0, 트랙 중앙, 단독 묶음으로 생성한다. 전체 점유 폭을 가진 이미지 한 장이며 원본 비율을 유지한다. 현재 7레인의 점유 폭은 2.1, 충돌 반폭은 1.05이므로 플레이어가 갈 수 있는 X ±1 전체를 막는다. 좌우 이동만으로 우회할 수 없으며 실제 점프 높이 72를 넘어야 통과한다. 기존 Ghost Penguin 무적 효과는 예외로 유지한다.

## 8. occupiedLanes 계산 방식

`occupiedLanesFor(span, startLane, laneCount)`가 인접 인덱스를 만든다. 1칸은 `[start]`, 2칸은 `[start, start + 1]`, full은 `[0, …, laneCount - 1]`이다. 범위를 벗어나거나 소수인 시작 레인, full의 0이 아닌 시작 위치는 거부한다. 3·5·7레인에서 같은 함수를 검증했다.

## 9. render width 계산 방식

`occupiedWidth = 마지막 레인 중심 - 첫 레인 중심 + 레인 중심 간격`이다. 이를 접촉 평면의 반폭 416px에 곱한 뒤 `visualScale`을 적용한다. 높이는 PNG 프레임 비율에서 파생하고 X/Y에 같은 원근 scale을 적용한다. 바리케이드의 visualScale은 1.04로 양끝 눈 장식이 충돌 영역을 감싸도록 했다. 기존 `pixelArt: true`와 BootScene의 사전 로드·투명 여백 프레임을 재사용한다.

## 10. collision width 계산 방식

일반 장애물은 `occupiedWidth × visualScale × hitbox.widthRatio / 2`를 반폭으로 사용한다. 바리케이드는 장식 축소와 무관하게 `occupiedWidth / 2`로 전체 폭을 막는다. 이 값은 그림과 같은 점유 레인에서 한 번 생성되며 충돌·아이템 배치·debug가 공유한다. 2칸의 두 레인 중심은 모두 실제 판정 안에 있고 비점유 레인 중심은 판정 밖이다.

## 11. jump collision 처리 방식

기존 포물선 기반 연속 판정을 유지했다. 이번 프레임의 X/거리 겹침 구간에서 실제 높이를 검사하고, 착지 및 착지 직후 이어지는 점프도 같은 궤적을 사용한다. `isJumping`으로 전체 프레임을 무시하지 않는다. groundHazard는 높이 0, solid는 하단 몸체 높이를 사용하며 레인 폭 변경 시에도 최대 80으로 제한한다. 점프는 기존 0.8초·최대 높이 150·착지 전 0.12초 입력 저장을 유지한다.

## 12. spawn 빈도와 거리

폭별 30슬롯 bag은 1칸 18, 2칸 10, full 2로 약 60% / 33.3% / 6.7%다. 1칸·2칸 안에서는 별도의 종류 shuffle bag으로 모두 한 번씩 소비한다. 기본 묶음 간격은 35~55m, 2칸 포함 후 45~65m, full 후 55~75m다. 기존 일반 묶음의 밀도 단계와 6~12m 엇갈림은 유지한다.

고속에서는 최소 반응 0.35초와 한 레인 이동 시간을 충족하도록 일반 간격을 늘린다. 바리케이드 전후는 점프 0.8초 + 반응 0.35초 + 판정 깊이 통과 거리를 확보한다. 시야는 기본 120m이며 고속에서 최소 1.65초 앞까지 늘어난다. 랜드마크의 접근 비율은 이 시야 변경과 무관하게 유지한다.

## 13. 바리케이드 spawn 제한

연속 바리케이드는 금지하며 사이에 일반 장애물을 최소 3개 둔다. 일반 장애물과 같은 묶음에 넣지 않는다. 직전 거리도 최소 55m로 확보한다. 랜드마크 안전 구간은 비우고 미뤄진 종류를 버리지 않는다. 첫 50m는 시야 안전 구간이며 첫 장애물은 현재 시야의 지평선에서 등장한다.

## 14. 테스트한 케이스와 결과

- 자동 테스트 158개 통과: 기존 입력·주행·점프·아이템·Ghost·랜드마크·기록·랭킹 회귀 포함.
- 13종 PNG 프레임 범위·비율·높이 검증. 3/5/7레인의 합법적인 168개 배치에서 이미지 한 장의 중심·원근 확대·비율·재사용·제거 검증.
- 3/5/7레인에서 모든 합법적인 1/2/full 배치, 각 점유 레인의 지면 충돌·비점유 레인 회피·점프 통과.
- 바리케이드 좌/중/우 × 접지/점프 6개 경우를 14/30/94/254/1022m/s, 20/30/60/144 FPS의 실제 RunSystem으로 검증.
- X -1~1의 41개 위치 및 프레임 내 좌→우 횡단도 바리케이드 지면 충돌. 높이 1의 늦은 점프는 여전히 충돌.
- 13종의 정상 점프 통과, 너무 늦은 입력·착지 충돌·고속 관통·점프 버퍼 회귀 검증.
- 80개 seed의 1,000개 생성에서 폭별 빈도·종류 순환·동일 종류 연속 방지·바리케이드 간격 검증. 위치 균형·거리 업데이트 주기 독립성·랜드마크 제외 구간도 검증.
- 14~1022m/s에서 바리케이드 전후 점프/착지/반응 거리와 시야 검증.
- 실제 개발 서버의 Phaser 게임 화면에서 바리케이드 왼쪽 끝/중앙/오른쪽 끝 × 점프 없음/정상 점프 6개 경우를 확인했다. 접지는 모두 약 58.4m에서 충돌해 게임오버, 점프는 모두 70m 이후 `CLEARED`로 통과했다. 점프 입력은 개발용 고정 장면에서 1회 주입했으며 기존 플레이어·프레임 루프·충돌 코드를 그대로 실행했다. 온라인 기록 저장은 누르지 않았다.
- lint, TypeScript 검사, 158개 테스트, webpack 프로덕션 빌드 통과. 프로덕션 클라이언트 청크에 개발용 고정 장면 쿼리와 QA 문구가 포함되지 않는 것도 확인했다.

## 15. 남아 있는 문제

게임패드 입력은 기존 모의 테스트를 통과했으며 실제 하드웨어·실물 모바일 기기 검증은 수행하지 않았다. 고속 간격은 생성 시 선택 속도를 기준으로 보장한다. 이미 등장한 장애물은 위치가 고정되어 있으므로, 그 이후 무리하게 연속 가속하여 반응 시간을 스스로 없애는 상황까지 자동 보정하지는 않는다. 속도 상한이나 게임 규칙 변경은 추가하지 않았다.
