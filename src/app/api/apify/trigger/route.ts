import { NextResponse } from 'next/server'
import { scrapeProfile, scrapeCompany } from '@/lib/scraping/apify'
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

    if (contactId) {
      const { data: contact } = await (supabase as any).from('contacts').select('id').eq('id', contactId).eq('user_id', user.id).single()
      if (!contact) return NextResponse.json({ error: 'Contact not found or unauthorized' }, { status: 404 })
    }
    
    if (companyId) {
      const { data: company } = await (supabase as any).from('companies').select('id').eq('id', companyId).eq('user_id', user.id).single()
      if (!company) return NextResponse.json({ error: 'Company not found or unauthorized' }, { status: 404 })
    }

    console.log('[Apify Trigger] Starting sync scrape for:', linkedinUrl)

    let items
    if (companyId) {
      items = await scrapeCompany(linkedinUrl)
    } else {
      items = await scrapeProfile(linkedinUrl)
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No data returned from scrape' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: items[0], count: items.length })
  } catch (error: any) {
    console.error('Scrape Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to scrape' }, { status: 500 })
  }
}