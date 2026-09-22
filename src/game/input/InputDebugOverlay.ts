import type { GameObjects, Scene } from "phaser";

import { INPUT_CONFIG } from "@/game/config/constants";
import type { PlayerState } from "@/game/entities/Player";
import type { GamepadInput } from "@/game/input/GamepadInput";
import type { GameInputState } from "@/game/input/input.types";

export class InputDebugOverlay {
  private readonly text: GameObjects.Text;
  private readonly playerText: GameObjects.Text;
  private nextRefresh = 0;
  private presses = 0;
  private releases = 0;

  constructor(scene: Scene) {
    this.text = scene.add.text(16, 16, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#f5fbff",
      backgroundColor: "#183548",
      padding: { x: 12, y: 10 },
      lineSpacing: 5,
    }).setDepth(1000);
    this.playerText = scene.add.text(scene.scale.width - 16, 16, "", {
      fontFamily: "monospace", fontSize: "14px", color: "#f5fbff",
      backgroundColor: "#183548", padding: { x: 12, y: 10 }, lineSpacing: 5,
    }).setOrigin(1, 0).setDepth(1000);
  }

  update(time: number, input: Readonly<GameInputState>, active: boolean, pad: GamepadInput["status"], player: Readonly<PlayerState>): void {
    if (input.jumpPressed) this.presses++;
    if (input.jumpReleased) this.releases++;
    if (time < this.nextRefresh) return;
    this.nextRefresh = time + INPUT_CONFIG.debugRefreshMs;

    const padLabel = !pad.available ? "API 사용 불가"
      : pad.connectedCount === 0 ? "없음 · 연결 후 버튼을 눌러 주세요"
      : `${pad.connectedCount}대 · ${pad.mapping === "standard" ? "표준 매핑" : "비표준: 축 0/1·버튼 0"}`;
    this.text.setText([
      "INPUT CHECK · 개발용",
      active ? "입력 활성 · 방향키 / WASD / Space" : "화면 클릭 또는 Tab으로 입력 활성화",
      `X ${input.horizontalAxis.toFixed(2)}  Y ${input.verticalAxis.toFixed(2)}`,
      `← ${+input.left}  → ${+input.right}  가속 ${+input.accelerate}  감속 ${+input.brake}`,
      `점프 ${input.jump ? "누르는 중" : "대기"} · 눌림 ${this.presses} / 해제 ${this.releases}`,
      `패드: ${padLabel}`,
    ]);
    const jumpLabel = player.jumpPhase === "grounded" ? "접지"
      : player.jumpPhase === "rising" ? "상승" : "낙하";
    this.playerText.setText([
      "PLAYER CHECK · 개발용",
      `속도 ${player.currentSpeed.toFixed(0)} · 거리 ${player.distanceTravelled.toFixed(0)}`,
      `courseX ${player.courseX.toFixed(2)}`,
      `점프 ${jumpLabel} · 높이 ${player.jumpHeight.toFixed(0)}`,
    ]);
  }
}
