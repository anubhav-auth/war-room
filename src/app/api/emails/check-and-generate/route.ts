import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { contactId } = body

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    // 0. Check ownership
    const { data: contact, error: contactError } = await (adminSupabase as any)
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single()
      
    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found or unauthorized' }, { status: 404 })
    }

    // 1. Get the contact's most recently queued email
    const { data: permutations, error: permError } = await (adminSupabase as any)
      .from('email_permutations')
      .select('id, email, status, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (permError) throw permError

    if (!permutations || permutations.length === 0) {
      // No email was ever queued - run permutations
      return NextResponse.json({ action: 'run_permutations', reason: 'no_email_found' })
    }

    const lastEmail = permutations[0]

    // 2. Check verification status
    if (lastEmail.status === 'pending') {
      // Email is still being verified - wait before deciding
      return NextResponse.json({ action: 'wait', reason: 'verification_pending', email: lastEmail.email })
    }

    if (lastEmail.status === 'valid') {
      // Email verified successfully - no permutations needed
      return NextResponse.json({ action: 'skip_permutations', reason: 'email_verified', email: lastEmail.email })
    }

    if (lastEmail.status === 'invalid' || lastEmail.status === 'catch_all' || lastEmail.status === 'unknown') {
      // Email verification failed - run permutations to find alternatives
      return NextResponse.json({ action: 'run_permutations', reason: `email_${lastEmail.status}`, email: lastEmail.email })
    }

    return NextResponse.json({ action: 'unknown', status: lastEmail.status })
  } catch (error: any) {
    console.error('Check Email Status Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to check email status' }, { status: 500 })
  }
}
