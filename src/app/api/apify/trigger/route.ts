import { NextResponse } from 'next/server'
import { scrapeProfile, scrapeCompany, scrapePost } from '@/lib/scraping/apify'
import { createClient } from '@/lib/supabase/server'

function normalizeUrl(url: string) {
  if (!url) return ''
  return url.toLowerCase()
    .replace(/\/$/, '')
    .replace('www.', '')
    .replace('http://', 'https://')
}

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

    const data = items[0]
    const normalizedUrl = normalizeUrl(linkedinUrl)

    if (contactId) {
      let companyIdToUse = companyId

      if (!companyIdToUse && data.companyLinkedin) {
        const companyUrl = data.companyLinkedin.startsWith('http') 
          ? data.companyLinkedin 
          : `https://www.linkedin.com/company/${data.companyLinkedin.split('/').pop()}`
        
        const normalizedCompanyUrl = normalizeUrl(companyUrl)

        const { data: companies } = await (supabase as any)
          .from('companies')
          .select('id, linkedin_url')

        const existingCompany = companies?.find((c: any) => normalizeUrl(c.linkedin_url) === normalizedCompanyUrl)

        if (existingCompany) {
          companyIdToUse = existingCompany.id
        } else {
          const { data: newCompany } = await (supabase as any)
            .from('companies')
            .insert({
              name: data.companyName || 'Unknown Company',
              linkedin_url: companyUrl,
              user_id: user.id,
              website_url: data.companyWebsite
            })
            .select()
            .single()
          
          if (newCompany) {
            companyIdToUse = newCompany.id
          }
        }

        if (companyIdToUse) {
          await (supabase as any).from('contacts').update({ company_id: companyIdToUse }).eq('id', contactId)
        }
      }

      const profileData = {
        contact_id: contactId,
        headline: data.headline,
        about: data.summary || data.about,
        current_company_description: data.currentJobDescription,
        experience: data.experiences || data.experience,
        skills: data.skills,
        raw_data: data,
        scraped_at: new Date().toISOString(),
      }

      await (supabase as any).from('linkedin_profiles').upsert(profileData)

      const discoveredEmail = data.email || (data.contacts && data.contacts[0] && data.contacts[0].email)
      
      if (discoveredEmail) {
        await (supabase as any).from('email_permutations').upsert({
          contact_id: contactId,
          email: discoveredEmail,
          status: 'pending',
          metadata: { source: 'apify' }
        }, { onConflict: 'contact_id,email' })
      } else {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/emails/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId, userId: user.id }),
        }).catch(err => console.error('Failed to trigger permutations:', err))
      }

      const posts = await scrapePost(linkedinUrl)
      if (posts && posts.length > 0) {
        const recent_posts = posts.slice(0, 4).map((p: any) => ({
          text: p.text,
          url: p.postUrl,
          date: p.postedAt,
          likes: p.numLikes,
          comments: p.numComments
        }))
        await (supabase as any).from('linkedin_profiles').update({ recent_posts }).eq('contact_id', contactId)
      }

      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, userId: user.id }),
      }).catch(err => console.error('Failed to trigger generation:', err))
    }

    if (companyId) {
      const companyData = {
        company_id: companyId,
        user_id: user.id,
        name: data.name || data.companyName,
        industry: data.industry,
        website: data.website || data.companyWebsite,
        company_size: data.companySize,
        headcount: data.headcount,
        about: data.about || data.description || data.summary,
        specialties: data.specialties,
        headquarters: data.headquarters,
        founded: data.founded,
        raw_data: data,
        scraped_at: new Date().toISOString(),
      }

      await (supabase as any).from('company_profiles').upsert(companyData)

      await (supabase as any).from('companies').update({
        description: data.about || data.description || data.summary,
        tech_stack: data.specialties || []
      }).eq('id', companyId)
    }

    return NextResponse.json({ success: true, data, count: items.length })
  } catch (error: any) {
    console.error('Scrape Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to scrape' }, { status: 500 })
  }
}