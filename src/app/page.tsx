import { GameCanvas } from "@/components/game/GameCanvas";

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-slate-950">
      <h1 className="sr-only">Antarctic Adventure</h1>
      <GameCanvas />
    </main>
  );
}
