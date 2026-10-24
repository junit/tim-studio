import React from 'react'
import { Separator } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  className?: string
  direction?: 'horizontal' | 'vertical'
  disableDoubleClick?: boolean
  onDoubleClick?: (e: React.MouseEvent) => void
  title?: string
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  className,
  direction = 'horizontal',
  disableDoubleClick,
  onDoubleClick,
  title,
}) => {
  return (
    <Separator
      disableDoubleClick={disableDoubleClick}
      onDoubleClick={onDoubleClick}
      title={title}
      className={cn(
        'group relative flex items-center justify-center transition-colors focus:outline-none select-none z-10',
        direction === 'horizontal'
          ? 'w-1.5 hover:w-1.5 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-600 bg-slate-200 dark:bg-slate-800'
          : 'h-2 cursor-row-resize bg-slate-100 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 hover:bg-blue-50/80 dark:hover:bg-slate-800/90 active:bg-blue-500/20',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full bg-slate-300 dark:bg-slate-600 transition-all group-hover:bg-blue-500 group-hover:scale-110',
          direction === 'horizontal' ? 'h-6 w-1' : 'h-1 w-8'
        )}
      />
    </Separator>
  )
}
