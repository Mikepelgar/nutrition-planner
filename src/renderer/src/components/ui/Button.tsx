import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', className = '', children, ...rest }, ref) => {
    const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:pointer-events-none'
    const variants = {
      primary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      ghost: 'bg-transparent hover:bg-gray-800 text-gray-300 hover:text-gray-100',
      danger: 'bg-red-700 hover:bg-red-600 text-white'
    }
    const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-1.5 text-sm' }
    return (
      <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
