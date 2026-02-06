"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
  showValue?: boolean
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ value = 0, onValueChange, min = 0, max = 100, step = 1, className, disabled, showValue }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false)
    const trackRef = React.useRef<HTMLDivElement>(null)

    const percentage = ((value - min) / (max - min)) * 100

    const updateValue = React.useCallback(
      (clientX: number) => {
        if (!trackRef.current || disabled) return

        const rect = trackRef.current.getBoundingClientRect()
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        const rawValue = min + percent * (max - min)
        const steppedValue = Math.round(rawValue / step) * step
        const clampedValue = Math.max(min, Math.min(max, steppedValue))

        onValueChange?.(clampedValue)
      },
      [min, max, step, disabled, onValueChange]
    )

    React.useEffect(() => {
      if (!isDragging) return

      const handleMouseMove = (e: MouseEvent) => {
        updateValue(e.clientX)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }, [isDragging, updateValue])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return
      let newValue = value
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          newValue = Math.min(max, value + step)
          break
        case "ArrowLeft":
        case "ArrowDown":
          newValue = Math.max(min, value - step)
          break
        case "Home":
          newValue = min
          break
        case "End":
          newValue = max
          break
        default:
          return
      }
      e.preventDefault()
      onValueChange?.(newValue)
    }

    return (
      <div ref={ref} className={cn("relative flex w-full touch-none select-none items-center", className)}>
        <div
          ref={trackRef}
          className={cn(
            "relative h-2 w-full grow overflow-hidden rounded-full bg-muted cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div
            className="absolute h-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
          <button
            type="button"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onClick={(e) => {
              const rect = trackRef.current?.getBoundingClientRect()
              if (rect) updateValue(e.clientX)
            }}
            disabled={disabled}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        <div
          className={cn(
            "absolute h-5 w-5 rounded-full border-2 border-primary bg-background shadow-lg ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "hover:scale-110 active:scale-95",
            disabled && "pointer-events-none",
            isDragging && "scale-110"
          )}
          style={{ left: `calc(${percentage}% - 10px)` }}
          onMouseDown={(e) => {
            e.preventDefault()
            if (!disabled) setIsDragging(true)
          }}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
        {showValue && (
          <span className="ml-3 min-w-[3rem] text-sm font-mono text-muted-foreground">
            {value}
          </span>
        )}
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
