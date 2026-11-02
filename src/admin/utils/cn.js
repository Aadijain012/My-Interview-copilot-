/**
 * Merge class names, filtering out falsy values.
 * Lightweight alternative to clsx/classnames — add clsx if conditional logic grows.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
