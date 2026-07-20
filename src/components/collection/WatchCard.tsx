import { Watch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface WatchCardProps {
  id: string;
  name: string;
  photoUrl: string | null;
}

export function WatchCard({ id, name, photoUrl }: WatchCardProps) {
  return (
    <a href={`/collection/${id}`} className="block">
      <Card className="gap-0 overflow-hidden border-white/10 bg-white/5 py-0 text-white transition-colors hover:bg-white/10">
        <div className="flex aspect-square items-center justify-center bg-white/5">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Watch className="size-12 text-blue-100/40" />
          )}
        </div>
        <CardContent className="px-4 py-3">
          <p className="truncate text-sm font-medium text-white">{name}</p>
        </CardContent>
      </Card>
    </a>
  );
}
