"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ value, onValueChange, options, placeholder = "Select...", className, disabled }, _ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const selectRef = React.useRef<HTMLDivElement>(null)

    const selectedOption = options.find((opt) => opt.value === value)

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
      <div ref={selectRef} className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isOpen && "ring-1 ring-ring"
          )}
        >
          <span className={cn(!selectedOption && "text-muted-foreground")}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 opacity-50 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div
            className={cn(
              "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
              "animate-in fade-in-0 zoom-in-95"
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onValueChange?.(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:bg-accent focus:text-accent-foreground",
                  option.value === value && "bg-accent"
                )}
              >
                <span className="flex-1 text-left">{option.label}</span>
                {option.value === value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select, type SelectOption }
