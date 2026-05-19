import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70',
  {
    variants: {
      variant: {
        default:
          'bg-cyan-300 text-slate-950 shadow-[0_0_35px_rgba(103,232,249,0.25)] hover:bg-cyan-200',
        secondary: 'border border-white/10 bg-white/8 text-slate-100 hover:bg-white/12',
        ghost: 'text-slate-300 hover:bg-white/8 hover:text-white',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
