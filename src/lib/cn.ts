// Minimal classname utility (or use `clsx` + `tailwind-merge`)
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
