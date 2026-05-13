import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  // Simple auth check for cron (optional, can use Vercel's headers)
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const apiKey = process.env.QUICK_EMAIL_VERIFICATION_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing QuickEmailVerification API Key' }, { status: 500 })
  }

  try {
    // 1. Fetch up to 100 pending permutations
    const { data: pending, error: fetchError } = await (supabase as any)
      .from('email_permutations')
      .select('*, contacts(user_id)')
      .eq('status', 'pending')
      .limit(100)

    if (fetchError) throw fetchError
    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: 'No pending permutations to verify' })
    }

    const results = []
    const processedContactIds = new Set<string>()

    for (const item of (pending as any[])) {
      if (processedContactIds.has(item.contact_id)) {
        continue
      }

      try {
        // 2. Call QuickEmailVerification Single API
        const response = await fetch(`https://api.quickemailverification.com/v1/verify?email=${encodeURIComponent(item.email)}&apikey=${apiKey}`)
        const data = await response.json()

        if (data.success) {
          const isValid = data.result === 'valid' || data.safe_to_send === true
          const status = isValid ? 'valid' : (data.accept_all ? 'catch_all' : 'invalid')

          // 3. Update permutation status
          await (supabase as any)
            .from('email_permutations')
            .update({ status })
            .eq('id', item.id)

          if (isValid) {
            processedContactIds.add(item.contact_id)
            // 4. If valid, update contact
            await (supabase as any)
              .from('contacts')
              .update({ email: item.email })
              .eq('id', item.contact_id)

            // Mark other pending permutations for this contact as 'skipped'
            await (supabase as any)
              .from('email_permutations')
              .update({ status: 'skipped' })
              .eq('contact_id', item.contact_id)
              .eq('status', 'pending')
          }

          results.push({ email: item.email, status })
        } else {
          results.push({ email: item.email, error: data.message })
        }
      } catch (err: any) {
        console.error(`Error verifying ${item.email}:`, err)
        results.push({ email: item.email, error: err.message })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Cron Verify Emails Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
