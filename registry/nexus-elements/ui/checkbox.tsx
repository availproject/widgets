"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer outline-none ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 shrink-0 transition-colors",
        "w-[20px] h-[20px] rounded-[4px]",
        "data-[state=unchecked]:bg-[#FFFFFE] data-[state=unchecked]:border-[2px] data-[state=unchecked]:border-[#E8E8E7]",
        "data-[state=checked]:bg-[#006BF4] data-[state=checked]:border-transparent",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current w-full h-full"
      >
        <div className="w-[8px] h-[8px] rounded-[2px] bg-[#FFFFFE]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

// Since absolute inline styles override tailwind data states, let's refine the component styling 
// inside a style tag or purely via Tailwind arbitrarily extending the exact colors.

export { Checkbox }
