import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'LearnOS — Intelligent Study System',
  description: 'Spaced-repetition learning for university students',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    statusBarStyle: 'default',
    title: 'LearnOS',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0D9488',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
