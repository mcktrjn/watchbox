import { useState } from "react";
import type { Watch } from "@/lib/watches";
import { Button } from "@/components/ui/button";
import { WatchCard } from "@/components/collection/WatchCard";
import { EmptyCollectionState } from "@/components/collection/EmptyCollectionState";
import { AddWatchDialog } from "@/components/collection/AddWatchDialog";

interface CollectionViewProps {
  initialWatches: Watch[];
}

export function CollectionView({ initialWatches }: CollectionViewProps) {
  const [watches, setWatches] = useState<Watch[]>(initialWatches);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddClick = () => {
    setDialogOpen(true);
  };

  const handleCreated = (watch: Watch) => {
    setWatches((prev) => [watch, ...prev]);
  };

  return (
    <div>
      {watches.length === 0 ? (
        <EmptyCollectionState onAddClick={handleAddClick} />
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Button onClick={handleAddClick}>Add watch</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watches.map((watch) => (
              <WatchCard key={watch.id} id={watch.id} name={watch.name} photoUrl={watch.photo_url} />
            ))}
          </div>
        </>
      )}
      <AddWatchDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />
    </div>
  );
}
