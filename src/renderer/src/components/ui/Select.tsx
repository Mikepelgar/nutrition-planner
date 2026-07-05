import { type SelectHTMLAttributes, forwardRef } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Array<{ value: string; label: string }>
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, id, options, className = '', ...rest }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-xs text-gray-400 font-medium">{label}</label>}
      <select
        ref={ref}
        id={id}
        className={`bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 ${className}`}
        {...rest}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
)
Select.displayName = 'Select'
