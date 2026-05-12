import { NextResponse } from 'next/server'
import { triggerScrape, triggerCompanyScrape } from '@/lib/scraping/apify'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { linkedinUrl, contactId, companyId } = await req.json()
    
    if (!linkedinUrl) {
      return NextResponse.json({ error: 'LinkedIn URL is required' }, { status: 400 })
    }

    // Verify ownership of contact or company before triggering scrape
    if (contactId) {
      const { data: contact } = await (supabase as any).from('contacts').select('id').eq('id', contactId).eq('user_id', user.id).single()
      if (!contact) return NextResponse.json({ error: 'Contact not found or unauthorized' }, { status: 404 })
    }
    
    if (companyId) {
      const { data: company } = await (supabase as any).from('companies').select('id').eq('id', companyId).eq('user_id', user.id).single()
      if (!company) return NextResponse.json({ error: 'Company not found or unauthorized' }, { status: 404 })
    }

    let runId;
    if (companyId) {
      runId = await triggerCompanyScrape(linkedinUrl)
    } else {
      runId = await triggerScrape(linkedinUrl)
    }
    
    return NextResponse.json({ runId })
  } catch (error: any) {
    console.error('Trigger Scrape Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to trigger scrape' }, { status: 500 })
  }
}
