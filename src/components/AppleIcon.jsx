import React from "react";

// The official Apple logo silhouette (lucide's "Apple" is a generic fruit, not
// the brand mark, so we use the real vector here). fill="currentColor" so it
// inherits the button's text color in both light and dark themes.
export default function AppleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.94.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.78 1.3 10.33.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.02.84 3.4.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.74-4.11zM14.6 4.6c.72-.87 1.21-2.08 1.08-3.29-1.04.04-2.31.69-3.05 1.56-.67.77-1.26 2-1.1 3.19 1.16.09 2.35-.59 3.07-1.46z" />
    </svg>
  );
}