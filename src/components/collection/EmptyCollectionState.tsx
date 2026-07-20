import { Watch } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyCollectionStateProps {
  onAddClick: () => void;
}

export function EmptyCollectionState({ onAddClick }: EmptyCollectionStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
        <Watch className="size-8 text-blue-100/60" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">No watches yet</h2>
        <p className="mt-1 text-sm text-blue-100/60">Add your first watch to start building your collection.</p>
      </div>
      <Button onClick={onAddClick}>Add watch</Button>
    </div>
  );
}
