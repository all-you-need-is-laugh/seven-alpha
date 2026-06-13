import type { InputHTMLAttributes } from 'react'

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={`text-input ${className}`.trim()} {...props} />
}
