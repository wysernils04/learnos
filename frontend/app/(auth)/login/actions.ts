'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export async function loginAction(
  email: string,
  password: string,
): Promise<{ error: string }> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  // redirect() bundles the Set-Cookie headers and the redirect instruction
  // into the same RSC response — cookies are committed before navigation.
  redirect('/dashboard')
}
