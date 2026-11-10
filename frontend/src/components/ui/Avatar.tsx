import { cn } from '../../lib/utils'

interface AvatarProps {
  name?: string
  src?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initial = name?.[0]?.toUpperCase() || '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={cn('rounded-full object-cover border-2 border-indigo-500/30', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold',
        'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-2 border-indigo-500/40 text-indigo-300',
        sizes[size],
        className
      )}
    >
      {initial}
    </div>
  )
}
