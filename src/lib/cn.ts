import { twMerge } from 'tailwind-merge'

/** Junta classes CSS ignorando valores falsos; em conflito, a última classe do Tailwind vence. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '))
}
