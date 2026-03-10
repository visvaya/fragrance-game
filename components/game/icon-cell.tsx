import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Container classes for interactive icon cells in the attempt log.
 * Each variant provides semantically appropriate hover/active feedback.
 */
const iconCellVariants = cva("group/icon rounded-sm transition", {
  defaultVariants: {
    cursor: "help",
    layout: "icon",
  },
  variants: {
    cursor: {
      default: "cursor-default",
      help: "cursor-help",
    },
    layout: {
      /** Square container for SVG icons */
      icon: "flex size-6  items-center justify-center",
      /** Padded container for inline content (?, ×) */
      pad: "inline-flex p-1",
      /** Horizontal container for text content (%) */
      text: "flex items-center justify-center px-1.5 py-1",
    },
    variant: {
      muted:
        "opacity-50 hover:bg-muted/25 hover:opacity-100 active:bg-muted/25 active:opacity-100",
      success: "hover:bg-success/10 active:bg-success/10",
      warning: "hover:bg-warning/10 active:bg-warning/10",
    },
  },
});

/**
 * Classes for the icon/content element inside IconCell.
 * Applies a brightness filter on hover via the parent's named group.
 */
export const iconInnerVariants = cva(
  "transition-[filter] group-hover/icon:brightness-75",
  {
    variants: {
      skewed: {
        true: "-skew-x-12 transform",
      },
    },
  },
);

type IconCellProperties = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof iconCellVariants> & {
    as?: "div" | "span";
  };

/**
 * Wrapper for interactive icon cells in the attempt log rows.
 * Provides consistent hover/active visual feedback per semantic variant:
 * - success: green tint + darker icon on hover
 * - warning: amber tint + darker icon on hover
 * - muted: appears at half opacity, becomes fully visible + darker on hover
 * @example
 * // SVG icon
 * <IconCell variant="success" cursor="default">
 *   <Check className={cn("h-4 w-4 text-success", iconInnerVariants())} />
 * </IconCell>
 *
 * // Text content
 * <IconCell variant="muted" layout="pad" as="span" className="text-muted-foreground">
 *   <span className={iconInnerVariants()}>?</span>
 * </IconCell>
 */
export function IconCell({
  as: Tag = "div",
  children,
  className,
  cursor,
  layout,
  variant,
  ...props
}: IconCellProperties) {
  return (
    <Tag
      className={cn(iconCellVariants({ cursor, layout, variant }), className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
