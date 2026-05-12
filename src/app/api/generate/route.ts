import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateMessages } from '@/lib/ai/openrouter'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contactId } = await req.json()
    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Fetch all necessary data and ensure ownership
    const { data: contact, error: contactError } = await (adminSupabase as any)
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found or unauthorized' }, { status: 404 })
    }

    const { data: company } = await (adminSupabase as any).from('companies').select('*').eq('id', (contact as any).company_id || '').single()
    const { data: context } = await (adminSupabase as any).from('user_context').select('*').eq('user_id', user.id).single()
    const { data: profile } = await (adminSupabase as any).from('linkedin_profiles').select('*').eq('contact_id', contactId).single()
    const { data: companyProfile } = await (adminSupabase as any).from('company_profiles').select('*').eq('company_id', (company as any)?.id || '').single()

    if (!context) {
      return NextResponse.json({ error: 'User context not found. Please complete your profile settings.' }, { status: 400 })
    }

    if (!profile) {
      return NextResponse.json({ error: 'LinkedIn profile data not yet available.' }, { status: 400 })
    }

    // 2. Generate messages
    const messages = await generateMessages(context, contact, company || { name: 'Unknown' } as any, profile, companyProfile)

    // 3. Save to database
    const { error: upsertError } = await (adminSupabase as any).from('generated_messages').upsert({
      contact_id: contactId,
      ...messages,
      generated_at: new Date().toISOString(),
    })

    if (upsertError) throw upsertError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Generate Messages Error:', error)
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
