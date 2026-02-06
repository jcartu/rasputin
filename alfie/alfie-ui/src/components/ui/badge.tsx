import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/90",
        outline: "text-foreground border-border/60 hover:border-primary/30 hover:bg-primary/5",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25",
        warning:
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25",
        info:
          "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25",
        glow:
          "border-primary/30 bg-primary/10 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] hover:bg-primary/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
