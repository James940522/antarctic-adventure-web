import { GameCanvas } from "@/components/game/GameCanvas";

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-950 p-4">
      <h1 className="sr-only">Antarctic Adventure</h1>
      <GameCanvas />
    </main>
  );
}
