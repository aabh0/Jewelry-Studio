"use client";
import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-[13px] font-medium transition-[background-color,color,box-shadow,transform] duration-[var(--dur-micro)] ease-[var(--ease)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.985] select-none cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
        secondary: "bg-bg-3 text-fg-0 hover:bg-bg-4 hairline",
        ghost: "text-fg-1 hover:text-fg-0 hover:bg-bg-2",
        outline: "hairline text-fg-0 hover:bg-bg-2",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
        link: "text-accent underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-7 px-2.5 text-[12px]",
        md: "h-8 px-3",
        lg: "h-10 px-4 text-[14px]",
        icon: "size-8",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, type, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp ref={ref} type={asChild ? undefined : (type ?? "button")} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
export { buttonVariants };
