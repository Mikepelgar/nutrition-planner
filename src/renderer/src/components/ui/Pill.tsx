import { type ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  /** Tailwind classes applied when active (defaults to the emerald accent). */
  activeClass?: string
}

/**
 * Small rounded toggle — the one pill/chip used by every selector row (chat
 * goal/style, progress ranges, profile units/allergens, settings AI access).
 * Previously each screen re-implemented this with slightly different styles.
 */
export function Pill({
  active = false,
  activeClass = 'bg-emerald-700 text-white',
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${
        active ? activeClass : 'bg-gray-800 text-gray-400 hover:text-gray-200'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
