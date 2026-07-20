import { useState } from "react";
import type { Watch } from "@/lib/watches";
import { Button } from "@/components/ui/button";
import { WatchCard } from "@/components/collection/WatchCard";
import { EmptyCollectionState } from "@/components/collection/EmptyCollectionState";

interface CollectionViewProps {
  initialWatches: Watch[];
}

export function CollectionView({ initialWatches }: CollectionViewProps) {
  const [watches] = useState<Watch[]>(initialWatches);

  // TODO(Phase 5): open AddWatchDialog and prepend the created watch on success.
  const handleAddClick = () => {
    /* wired up in Phase 5 */
  };

  if (watches.length === 0) {
    return <EmptyCollectionState onAddClick={handleAddClick} />;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={handleAddClick}>Add watch</Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {watches.map((watch) => (
          <WatchCard key={watch.id} id={watch.id} name={watch.name} photoUrl={watch.photo_url} />
        ))}
      </div>
    </div>
  );
}
