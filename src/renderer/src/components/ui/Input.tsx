import { type InputHTMLAttributes, forwardRef } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, className = '', id, ...rest }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-xs text-gray-400 font-medium">{label}</label>}
      <input
        ref={ref}
        id={id}
        className={`bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 ${className}`}
        {...rest}
      />
    </div>
  )
)
Input.displayName = 'Input'
