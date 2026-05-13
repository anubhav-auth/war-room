import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { triggerPostScrape } from '@/lib/scraping/apify'

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    console.log(`[Apify Webhook] Incoming request to: ${url.pathname}${url.search}`)

    // 0. Strict Security Check
    const { searchParams } = url
    const secret = searchParams.get('secret')
    
    if (!secret || secret !== process.env.APIFY_WEBHOOK_SECRET) {
      console.warn('[Apify Webhook] Unauthorized Attempt: Invalid or missing secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    console.log('[Apify Webhook] Payload:', JSON.stringify(body, null, 2))
    
    const { resource } = body // Apify webhook payload
    
    if (!resource || !resource.defaultDatasetId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Helper to normalize LinkedIn URLs for matching
    const normalizeUrl = (url: string) => {
      if (!url) return ''
      return url.toLowerCase()
        .replace(/\/$/, '') // remove trailing slash
        .replace('www.', '') // remove www
        .replace('http://', 'https://') // force https
    }

    const normalizedProfileUrl = normalizeUrl(result.linkedinUrl || result.url)
    console.log(`[Apify Webhook] Looking for matching contact/company for: ${normalizedProfileUrl}`)

    // 1. Fetch data from Apify Dataset
    const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${resource.defaultDatasetId}/items?token=${process.env.APIFY_API_TOKEN}`)
    const items = await datasetResponse.json()

    if (!items || items.length === 0) {
      console.warn('[Apify Webhook] No data in dataset')
      return NextResponse.json({ error: 'No data in dataset' }, { status: 400 })
    }

    // Determine Base URL for internal calls
    const host = req.headers.get('host')
    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`

    // 2. Determine Actor Type and Process
    // supreme_coder~linkedin-profile-scraper returns a single profile object (usually)
    // supreme_coder~linkedin-post returns an array of posts
    const firstItem = items[0]
    const isPostData = firstItem.authorUrl || firstItem.postUrl || (firstItem.text && !firstItem.firstName)

    if (isPostData) {
      // Handle Post Data
      const profileUrl = firstItem.authorUrl
      if (!profileUrl) return NextResponse.json({ error: 'No profile URL in post data' }, { status: 400 })
      
      const normalizedUrl = normalizeUrl(profileUrl)

      const { data: contacts } = await (supabase as any)
        .from('contacts')
        .select('id, user_id, linkedin_url')

      const contact = contacts?.find((c: any) => normalizeUrl(c.linkedin_url) === normalizedUrl)

      if (contact) {
        console.log(`[Apify Webhook] Processing post data for contact: ${contact.id}`)
        // Format posts for our database
        const recent_posts = items.map((p: any) => ({
          text: p.text,
          url: p.postUrl,
          date: p.postedAt,
          likes: p.numLikes,
          comments: p.numComments
        }))

        await (supabase as any)
          .from('linkedin_profiles')
          .update({ recent_posts })
          .eq('contact_id', (contact as any).id)

        // Regenerate messages with new post context
        await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: (contact as any).id, userId: (contact as any).user_id }),
        })

        return NextResponse.json({ success: true, type: 'posts' })
      }
    }

    const profileUrl = result.linkedinUrl || result.url
    const normalizedUrl = normalizeUrl(profileUrl)
    
    // Fetch all candidates to find normalized match
    const { data: contacts } = await (supabase as any)
      .from('contacts')
      .select('id, user_id, email, linkedin_url, company_id')

    const contact = contacts?.find((c: any) => normalizeUrl(c.linkedin_url) === normalizedUrl)

    if (contact) {
      console.log(`[Apify Webhook] Processing profile data for contact: ${contact.id}`)
      // 2.1 Handle/Create Company for this contact automatically
      let companyId = (contact as any).company_id
      
      if (!companyId && result.companyLinkedin) {
        const companyUrl = result.companyLinkedin.startsWith('http') 
          ? result.companyLinkedin 
          : `https://www.linkedin.com/company/${result.companyLinkedin.split('/').pop()}`
        
        const normalizedCompanyUrl = normalizeUrl(companyUrl)

        // Check if company exists by URL
        const { data: companies } = await (supabase as any)
          .from('companies')
          .select('id, linkedin_url')

        const existingCompany = companies?.find((c: any) => normalizeUrl(c.linkedin_url) === normalizedCompanyUrl)

        if (existingCompany) {
          companyId = (existingCompany as any).id
        } else {
          // Create new company automatically
          const { data: newCompany } = await (supabase as any)
            .from('companies')
            .insert({
              name: result.companyName || 'Unknown Company',
              linkedin_url: companyUrl,
              user_id: (contact as any).user_id,
              website_url: result.companyWebsite
            })
            .select()
            .single()
          
          if (newCompany) {
            companyId = (newCompany as any).id
            // Trigger enrichment for the brand new company
            const { triggerCompanyScrape } = await import('@/lib/scraping/apify')
            triggerCompanyScrape(companyUrl).catch(err => console.error('Failed to trigger auto company scrape:', err))
          }
        }

        // Link contact to company if not already linked
        if (companyId) {
          await (supabase as any).from('contacts').update({ company_id: companyId }).eq('id', (contact as any).id)
        }
      }

      // Handle Contact Scraping
      const profileData = {
        contact_id: (contact as any).id,
        headline: result.headline,
        about: result.summary || result.about,
        current_company_description: result.currentJobDescription,
        experience: result.experiences || result.experience,
        skills: result.skills,
        raw_data: result,
        apify_run_id: resource.runId || resource.id,
        scraped_at: new Date().toISOString(),
      }

      await (supabase as any).from('linkedin_profiles').upsert(profileData)

      // 3. Handle Email Discovery
      const discoveredEmail = result.email || (result.contacts && result.contacts[0] && result.contacts[0].email)
      
      if (discoveredEmail) {
        // Add to permutations for verification
        await (supabase as any).from('email_permutations').upsert({
          contact_id: (contact as any).id,
          email: discoveredEmail,
          status: 'pending',
          metadata: { source: 'apify' }
        }, { onConflict: 'contact_id,email' })
      } else {
        // No email found by scraper, trigger permutations in background
        fetch(`${baseUrl}/api/emails/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: (contact as any).id, userId: (contact as any).user_id }),
        }).catch(err => console.error('Failed to trigger permutations:', err))
      }

      // 4. Trigger Post Scraper for even more context
      const { triggerPostScrape: triggerPostScrapeFn } = await import('@/lib/scraping/apify')
      triggerPostScrapeFn(profileUrl).catch(err => console.error('Failed to trigger post scraper:', err))

      return NextResponse.json({ success: true, type: 'contact' })
    }

    // Check if it's a company
    const { data: companies } = await (supabase as any)
      .from('companies')
      .select('id, user_id, linkedin_url')

    const company = companies?.find((c: any) => normalizeUrl(c.linkedin_url) === normalizedUrl)

    if (company) {
      console.log(`[Apify Webhook] Processing data for company: ${company.id}`)
      // Handle Company Scraping
      const companyData = {
        company_id: (company as any).id,
        user_id: (company as any).user_id,
        name: result.name || result.companyName,
        industry: result.industry,
        website: result.website || result.companyWebsite,
        company_size: result.companySize,
        headcount: result.headcount,
        about: result.about || result.description || result.summary,
        specialties: result.specialties,
        headquarters: result.headquarters,
        founded: result.founded,
        raw_data: result,
        apify_run_id: resource.runId || resource.id,
        scraped_at: new Date().toISOString(),
      }

      await (supabase as any).from('company_profiles').upsert(companyData)

      // Also update the main company table with description if available
      await (supabase as any).from('companies').update({
        description: result.about || result.description || result.summary,
        tech_stack: result.specialties || []
      }).eq('id', (company as any).id)

      return NextResponse.json({ success: true, type: 'company' })
    }

    console.warn(`[Apify Webhook] No matching contact or company found for: ${normalizedUrl}`)
    return NextResponse.json({ error: 'No matching contact or company found' }, { status: 404 })
  } catch (error: any) {
    console.error('Apify Webhook Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
