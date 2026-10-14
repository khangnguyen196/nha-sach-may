import { Be_Vietnam_Pro, Lora } from 'next/font/google'

export const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
})

export const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-lora',
})

export const fontVariables = `${beVietnamPro.variable} ${lora.variable}`
