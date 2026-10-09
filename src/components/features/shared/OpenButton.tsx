"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OpenButtonProps = {
  href?: string;
  onClick?: (event: MouseEvent) => void;
  label?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  disabled?: boolean;
  className?: string;
  /** Stop click bubbling (default true for table rows). */
  stopPropagation?: boolean;
};

export function OpenButton({
  href,
  onClick,
  label,
  disabled,
  className,
  stopPropagation = true,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: OpenButtonProps) {
  const t = useTranslations("table");
  const text = label ?? t("open");

  const handleClick = (event: MouseEvent) => {
    if (stopPropagation) event.stopPropagation();
    onClick?.(event);
  };

  const content = (
    <>
      <Eye className="h-3.5 w-3.5" />
      {text}
    </>
  );

  if (href) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn("h-8 gap-1.5", className)}
        disabled={disabled}
        data-testid={testId}
      >
        <Link href={href} onClick={handleClick} aria-label={ariaLabel ?? text}>
          {content}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5", className)}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel ?? text}
      data-testid={testId}
    >
      {content}
    </Button>
  );
}
