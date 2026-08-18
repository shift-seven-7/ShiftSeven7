"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        className: "!text-sm !py-4 !px-5 !shadow-lg !border !rounded-xl",
        classNames: {
          success: "!bg-emerald-950 !border-emerald-800 !text-emerald-100",
          error: "!bg-red-950 !border-red-800 !text-red-100",
          warning: "!bg-amber-950 !border-amber-800 !text-amber-100",
          info: "!bg-blue-950 !border-blue-800 !text-blue-100",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "420px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
