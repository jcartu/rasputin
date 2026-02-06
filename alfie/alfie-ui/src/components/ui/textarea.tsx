import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-base shadow-sm transition-all duration-200 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 focus-visible:bg-background/80 focus-visible:shadow-[0_0_15px_hsl(var(--primary)/0.1)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-border/80 hover:bg-background/60 resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
