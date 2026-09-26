import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-[20px] group-[.toaster]:bg-focus-sheet group-[.toaster]:text-focus-text group-[.toaster]:border-focus-raised group-[.toaster]:shadow-sh-lg",
          description: "group-[.toast]:text-focus-muted",
          actionButton:
            "group-[.toast]:bg-focus-lime group-[.toast]:text-focus-bg group-[.toast]:rounded-[14px] group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-focus-surface group-[.toast]:text-focus-muted group-[.toast]:rounded-[14px]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
