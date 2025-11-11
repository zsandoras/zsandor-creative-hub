import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const RecordingSkeleton = () => (
  <Card className="p-6">
    <div className="flex gap-4">
      <Skeleton className="h-24 w-24 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  </Card>
);

export const GuitarSkeleton = () => (
  <Card className="p-6">
    <Skeleton className="h-6 w-3/4 mb-4" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-5/6" />
  </Card>
);

export const FoodSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="aspect-square w-full rounded-lg" />
    <Skeleton className="h-4 w-3/4" />
  </div>
);
