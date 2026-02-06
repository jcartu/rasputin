import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/50 shimmer overflow-hidden relative",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
