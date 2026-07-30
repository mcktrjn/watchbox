import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyStatsState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
        <BarChart3 className="size-8 text-blue-100/60" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">No wear data yet</h2>
        <p className="mt-1 text-sm text-blue-100/60">Log your first wear session to see statistics here.</p>
      </div>
      <a href="/collection">
        <Button>Go to collection</Button>
      </a>
    </div>
  );
}
