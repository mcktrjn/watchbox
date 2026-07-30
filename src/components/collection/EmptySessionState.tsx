import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptySessionStateProps {
  onAddClick: () => void;
}

export function EmptySessionState({ onAddClick }: EmptySessionStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
        <Clock className="size-8 text-blue-100/60" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">No wear sessions yet</h3>
        <p className="mt-1 text-sm text-blue-100/60">Track how often you wear this watch.</p>
      </div>
      <Button onClick={onAddClick}>Log Session</Button>
    </div>
  );
}
