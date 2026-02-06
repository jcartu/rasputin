import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md shadow-destructive/20 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/30",
        outline:
          "border-2 border-input bg-background/80 backdrop-blur-sm shadow-sm hover:bg-accent/80 hover:text-accent-foreground hover:border-accent/50 hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:shadow-md hover:-translate-y-0.5",
        ghost: "hover:bg-accent/80 hover:text-accent-foreground hover:shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-r from-primary via-primary/90 to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 hover:brightness-110",
        premium:
          "bg-gradient-to-br from-card via-card to-card/80 backdrop-blur-xl border border-primary/20 text-foreground shadow-lg hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/10 before:via-transparent before:to-accent/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        glow:
          "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.4),0_0_30px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_20px_hsl(var(--primary)/0.5),0_0_40px_hsl(var(--primary)/0.3)] hover:-translate-y-0.5",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
