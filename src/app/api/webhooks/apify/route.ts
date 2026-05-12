import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { triggerPostScrape } from '@/lib/scraping/apify'

export async function POST(req: Request) {
  try {
    // 0. Strict Security Check
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')
    
    if (!secret || secret !== process.env.APIFY_WEBHOOK_SECRET) {
      console.warn('Unauthorized Webhook Attempt: Invalid or missing secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { resource } = body // Apify webhook payload
    
    if (!resource || !resource.defaultDatasetId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch data from Apify Dataset
    const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${resource.defaultDatasetId}/items?token=${process.env.APIFY_API_TOKEN}`)
    const items = await datasetResponse.json()

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No data in dataset' }, { status: 400 })
    }

    // 2. Determine Actor Type and Process
    // supreme_coder~linkedin-profile-scraper returns a single profile object (usually)
    // supreme_coder~linkedin-post returns an array of posts
    const firstItem = items[0]
    const isPostData = firstItem.authorUrl || firstItem.postUrl || (firstItem.text && !firstItem.firstName)

    if (isPostData) {
      // Handle Post Data
      const profileUrl = firstItem.authorUrl
      if (!profileUrl) return NextResponse.json({ error: 'No profile URL in post data' }, { status: 400 })

      const { data: contact } = await (supabase as any)
        .from('contacts')
        .select('id, user_id')
        .eq('linkedin_url', profileUrl)
        .single()

      if (contact) {
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
        await fetch(`${req.headers.get('origin')}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: (contact as any).id, userId: (contact as any).user_id }),
        })

        return NextResponse.json({ success: true, type: 'posts' })
      }
    }

    const result = firstItem
    const profileUrl = result.linkedinUrl || result.url
    
    // Check if it's a contact first
    const { data: contact } = await (supabase as any)
      .from('contacts')
      .select('id, user_id, email')
      .eq('linkedin_url', profileUrl)
      .single()

    if (contact) {
      // 2.1 Handle/Create Company for this contact automatically
      let companyId = (contact as any).company_id
      
      if (!companyId && result.companyLinkedin) {
        const companyUrl = result.companyLinkedin.startsWith('http') 
          ? result.companyLinkedin 
          : `https://www.linkedin.com/company/${result.companyLinkedin.split('/').pop()}`

        // Check if company exists by URL
        const { data: existingCompany } = await (supabase as any)
          .from('companies')
          .select('id')
          .eq('linkedin_url', companyUrl)
          .single()

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
        fetch(`${req.headers.get('origin')}/api/emails/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: (contact as any).id, userId: (contact as any).user_id }),
        }).catch(err => console.error('Failed to trigger permutations:', err))
      }

      // 4. Trigger Post Scraper for even more context
      triggerPostScrape(profileUrl).catch(err => console.error('Failed to trigger post scraper:', err))

      // 5. We NO LONGER trigger AI Generation here. 
      // We wait for the post scraper to finish and trigger it then,
      // ensuring we have the absolute maximum context for the first generation.

      return NextResponse.json({ success: true, type: 'contact' })
    }

    // Check if it's a company
    const { data: company } = await (supabase as any)
      .from('companies')
      .select('id, user_id')
      .eq('linkedin_url', profileUrl)
      .single()

    if (company) {
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

    return NextResponse.json({ error: 'No matching contact or company found' }, { status: 404 })
  } catch (error: any) {
    console.error('Apify Webhook Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
