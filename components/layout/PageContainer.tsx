import React from "react";

export interface PageContainerProps {
  children: React.ReactNode;
  /** Max width sizing: 'sm' (768px), 'md' (1024px), 'lg' (1280px), 'xl' (1440px), 'full' (100%) */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** Whether to add standard vertical padding. Defaults to true */
  paddedY?: boolean;
  className?: string;
}

/**
 * Standard page container that ensures consistent margins, responsive horizontal padding,
 * and maximum widths across all screen sizes (mobile, tablet, laptop, desktop).
 */
export function PageContainer({
  children,
  size = "lg",
  paddedY = true,
  className = "",
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-3xl",
    md: "max-w-5xl",
    lg: "max-w-7xl",
    xl: "max-w-[1400px]",
    full: "max-w-full",
  };

  const paddingYClass = paddedY ? "py-4 sm:py-6 lg:py-8" : "";

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${maxWidthClasses[size]} ${paddingYClass} ${className}`}
    >
      {children}
    </div>
  );
}

export default PageContainer;
