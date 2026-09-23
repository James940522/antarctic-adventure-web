export type GameRecordPayload = Readonly<{
  runId: string;
  playerId: string;
  nickname: string;
  score: number;
  stage: number;
  distance: number;
  playTime: number;
}>;
