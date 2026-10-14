import { Skeleton } from '../../components/Skeleton';

export function BoardPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full" />
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-80 w-72 shrink-0" />
        ))}
      </div>
    </div>
  );
}
