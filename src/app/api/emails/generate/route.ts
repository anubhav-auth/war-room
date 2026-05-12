import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmailPermutations } from '@/lib/scraping/email'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contactId } = await req.json()
    const adminSupabase = createAdminClient()

    // 1. Fetch contact and company domain, ensuring ownership
    const { data: contact, error: contactError } = await (adminSupabase as any)
      .from('contacts')
      .select('*, companies(website_url)')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found or unauthorized' }, { status: 404 })
    }

    const domain = ((contact as any).companies as any)?.website_url
    if (!domain) {
      return NextResponse.json({ message: 'No domain found for company' })
    }

    // 2. Generate permutations
    const emails = generateEmailPermutations((contact as any).name, domain)
    
    if (emails.length === 0) {
      return NextResponse.json({ message: 'Could not generate permutations' })
    }

    // 3. Insert into email_permutations
    // 3. Save to database
    const permutations = emails.map(email => ({
      contact_id: (contact as any).id,
      email,
      status: 'pending'
    }))

    const { error: insertError } = await (supabase as any)
      .from('email_permutations')
      .insert(permutations)
    if (insertError) throw insertError

    return NextResponse.json({ success: true, count: emails.length })
  } catch (error: any) {
    console.error('Generate Permutations Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
