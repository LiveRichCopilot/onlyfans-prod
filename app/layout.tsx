import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OF Essentials Dashboard',
  description: 'Manage your creator modules and notifications',
}

const SKIP_ONBOARDING_CHECK = ['/login', '/onboarding', '/auth/callback', '/api/']

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headerList = await headers()
  const pathname = headerList.get('x-next-pathname') || headerList.get('x-invoke-path') || ''

  const shouldCheck = !SKIP_ONBOARDING_CHECK.some(p => pathname.startsWith(p))

  if (shouldCheck) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        const prismaUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { organizationId: true, role: true },
        })
        if (!prismaUser || !prismaUser.organizationId || prismaUser.role === 'UNASSIGNED') {
          redirect('/onboarding')
        }
      }
    } catch (e: any) {
      // redirect() throws a NEXT_REDIRECT error — let it propagate
      if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e
    }
  }

  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
