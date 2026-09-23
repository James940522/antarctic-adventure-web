export type RankingEntry = {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  stage: number;
  distance: number;
};
export type RankingsResponse = {
  rankings: RankingEntry[];
  totalPlayers: number;
  myRanking: RankingEntry | null;
};
