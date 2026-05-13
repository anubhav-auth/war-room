import { NextResponse } from 'next/server'
import { scrapeProfile, scrapeCompany, scrapePost } from '@/lib/scraping/apify'
import { createClient } from '@/lib/supabase/server'
import { logContactProcess } from '@/lib/contact-lifecycle'

function normalizeUrl(url: string) {
  if (!url) return ''
  return url.toLowerCase()
    .replace(/\/$/, '')
    .replace('www.', '')
    .replace('http://', 'https://')
}

function validateLinkedInUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  const trimmed = url.trim()
  
  try {
    const parsed = new URL(trimmed)
    if (!parsed.hostname.includes('linkedin.com')) {
      return { valid: false, error: 'URL must be a LinkedIn profile or company URL' }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export async function POST(req: Request) {
  let contactId: string | null = null
  let userId: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    userId = user.id

    // Parse and validate request
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { linkedinUrl, contactId: reqContactId, companyId } = body
    contactId = reqContactId

    // Validate LinkedIn URL
    const urlValidation = validateLinkedInUrl(linkedinUrl)
    if (!urlValidation.valid) {
      if (contactId) {
        await logContactProcess(contactId, userId, 'linkedin_scraping_triggered', 'failed', {}, urlValidation.error)
      }
      return NextResponse.json({ error: urlValidation.error }, { status: 400 })
    }

    // Verify contact exists and belongs to user
    if (contactId) {
      const { data: contact, error: contactError } = await (supabase as any)
        .from('contacts')
        .select('id, user_id')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .single()

      if (contactError || !contact) {
        return NextResponse.json(
          { error: 'Contact not found or unauthorized' },
          { status: 404 }
        )
      }
    }

    // Verify company exists if provided
    if (companyId) {
      const { data: company, error: companyError } = await (supabase as any)
        .from('companies')
        .select('id')
        .eq('id', companyId)
        .eq('user_id', user.id)
        .single()

      if (companyError || !company) {
        if (contactId) {
          await logContactProcess(contactId, userId, 'linkedin_scraping_triggered', 'failed', {}, 'Company not found')
        }
        return NextResponse.json(
          { error: 'Company not found or unauthorized' },
          { status: 404 }
        )
      }
    }

    console.log('[Apify Trigger] Starting sync scrape for:', linkedinUrl, 'contactId:', contactId)

    // Scrape data
    let items
    try {
      if (companyId) {
        items = await scrapeCompany(linkedinUrl)
      } else {
        items = await scrapeProfile(linkedinUrl)
      }
    } catch (scrapeError: any) {
      console.error('[Apify Trigger] Scrape failed:', scrapeError)
      if (contactId) {
        await logContactProcess(
          contactId,
          userId,
          'linkedin_scraping_triggered',
          'failed',
          { url: linkedinUrl },
          scrapeError.message
        )
      }
      return NextResponse.json(
        { error: `Scrape failed: ${scrapeError.message}` },
        { status: 500 }
      )
    }

    if (!items || items.length === 0) {
      console.warn('[Apify Trigger] No data returned from scrape')
      if (contactId) {
        await logContactProcess(contactId, userId, 'linkedin_scraping_triggered', 'failed', { url: linkedinUrl }, 'No data returned')
      }
      return NextResponse.json({ error: 'No data returned from scrape' }, { status: 400 })
    }

    const data = items[0]
    if (!data || typeof data !== 'object') {
      if (contactId) {
        await logContactProcess(contactId, userId, 'linkedin_scraping_triggered', 'failed', { url: linkedinUrl }, 'Invalid data format')
      }
      return NextResponse.json({ error: 'Invalid data format from scrape' }, { status: 400 })
    }

    const normalizedUrl = normalizeUrl(linkedinUrl)

    if (contactId) {
      let companyIdToUse = companyId

      try {
        // Handle company creation/linking
        if (!companyIdToUse && data.companyLinkedin) {
          const companyUrl = data.companyLinkedin.startsWith('http') 
            ? data.companyLinkedin 
            : `https://www.linkedin.com/company/${data.companyLinkedin.split('/').pop()}`
          
          const normalizedCompanyUrl = normalizeUrl(companyUrl)

          const { data: companies, error: companiesError } = await (supabase as any)
            .from('companies')
            .select('id, linkedin_url')

          if (companiesError) {
            console.warn('[Apify Trigger] Failed to fetch companies:', companiesError)
          }

          const existingCompany = companies?.find((c: any) => normalizeUrl(c.linkedin_url || '') === normalizedCompanyUrl)

          if (existingCompany) {
            companyIdToUse = existingCompany.id
            console.log('[Apify Trigger] Linked to existing company:', companyIdToUse)
          } else if (data.companyName) {
            const { data: newCompany, error: createError } = await (supabase as any)
              .from('companies')
              .insert({
                name: data.companyName || 'Unknown Company',
                linkedin_url: companyUrl,
                user_id: user.id,
                website_url: data.companyWebsite || null,
                tier: 2, // Default tier
              })
              .select()
              .single()
            
            if (createError) {
              console.warn('[Apify Trigger] Failed to create company:', createError)
            } else if (newCompany) {
              companyIdToUse = newCompany.id
              console.log('[Apify Trigger] Created new company:', companyIdToUse)
            }
          }
        }

        // Link contact to company if we have a company ID
        if (companyIdToUse) {
          const { error: updateError } = await (supabase as any)
            .from('contacts')
            .update({ company_id: companyIdToUse })
            .eq('id', contactId)

          if (updateError) {
            console.warn('[Apify Trigger] Failed to link company to contact:', updateError)
          }
        }

        // Save LinkedIn profile data
        const profileData = {
          contact_id: contactId,
          headline: data.headline || null,
          about: data.summary || data.about || null,
          current_company_description: data.currentJobDescription || null,
          experience: Array.isArray(data.experiences) ? data.experiences : (data.experience || []),
          skills: Array.isArray(data.skills) ? data.skills : [],
          raw_data: data,
          scraped_at: new Date().toISOString(),
        }

        const { error: profileError } = await (supabase as any)
          .from('linkedin_profiles')
          .upsert(profileData)

        if (profileError) {
          console.error('[Apify Trigger] Failed to save LinkedIn profile:', profileError)
          await logContactProcess(contactId, userId, 'linkedin_scraped', 'failed', {}, profileError.message)
          throw profileError
        }

        await logContactProcess(contactId, userId, 'linkedin_scraped', 'success', {
          headline: data.headline,
          skills_count: Array.isArray(data.skills) ? data.skills.length : 0,
        })

        console.log('[Apify Trigger] LinkedIn profile saved:', contactId)

        // Handle discovered email
        const discoveredEmail = data.email || (data.contacts && data.contacts[0] && data.contacts[0].email)
        
        if (discoveredEmail) {
          const { error: emailError } = await (supabase as any)
            .from('email_permutations')
            .upsert({
              contact_id: contactId,
              email: discoveredEmail,
              status: 'pending',
              metadata: { source: 'apify_direct' }
            }, { onConflict: 'contact_id,email' })

          if (emailError) {
            console.warn('[Apify Trigger] Failed to save discovered email:', emailError)
          } else {
            console.log('[Apify Trigger] Saved discovered email:', discoveredEmail)
          }
        } else {
          // No email found - trigger permutations in background
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
          fetch(`${appUrl}/api/emails/generate`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_SECRET}`
            },
            body: JSON.stringify({ contactId, userId: user.id }),
          }).catch(err => console.error('[Apify Trigger] Failed to trigger email generation:', err))        }

        // Scrape and save posts
        let postsScraped = false
        try {
          const posts = await scrapePost(linkedinUrl)
          if (posts && posts.length > 0) {
            const recent_posts = posts.slice(0, 4).map((p: any) => ({
              text: p.text || p.resharedPost?.text || '',
              url: p.url || p.resharedPost?.url || '',
              date: p.postedAtISO || p.resharedPost?.postedAtISO || null,
              likes: p.numLikes || p.resharedPost?.numLikes || 0,
              comments: p.numComments || p.resharedPost?.numComments || 0
            }))

            const { error: postsError } = await (supabase as any)
              .from('linkedin_profiles')
              .update({ recent_posts })
              .eq('contact_id', contactId)

            if (postsError) {
              console.warn('[Apify Trigger] Failed to save posts:', postsError)
            } else {
              postsScraped = true
              console.log('[Apify Trigger] Posts saved:', contactId)
              await logContactProcess(contactId, userId, 'posts_scraped', 'success', {
                posts_count: recent_posts.length,
              })
            }
          }
        } catch (postErr: any) {
          console.warn('[Apify Trigger] Failed to scrape posts:', postErr)
          // Don't fail the entire request if posts fail
        }

        // Generate AI messages
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        fetch(`${appUrl}/api/generate`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_SECRET}`
          },
          body: JSON.stringify({ contactId, userId: user.id }),
        }).catch(err => {
          console.error('[Apify Trigger] Failed to trigger message generation:', err)
          if (contactId && userId) {
            logContactProcess(contactId, userId, 'messages_generated', 'failed', {}, err.message)
          }
        })

      } catch (processError: any) {
        console.error('[Apify Trigger] Error processing contact data:', processError)
        await logContactProcess(contactId, userId, 'linkedin_scraped', 'failed', {}, processError.message)
        return NextResponse.json(
          { error: `Failed to process scraped data: ${processError.message}` },
          { status: 500 }
        )
      }
    }

    if (companyId) {
      try {
        const companyData = {
          company_id: companyId,
          user_id: user.id,
          name: data.name || data.companyName || 'Unknown',
          industry: data.industry || null,
          website: data.website || data.companyWebsite || null,
          company_size: data.companySize || null,
          headcount: data.headcount || null,
          about: data.about || data.description || data.summary || null,
          specialties: Array.isArray(data.specialties) ? data.specialties : [],
          headquarters: data.headquarters || null,
          founded: data.founded || null,
          raw_data: data,
          scraped_at: new Date().toISOString(),
        }

        const { error: companyProfileError } = await (supabase as any)
          .from('company_profiles')
          .upsert(companyData)

        if (companyProfileError) {
          console.warn('[Apify Trigger] Failed to save company profile:', companyProfileError)
        }

        const { error: updateError } = await (supabase as any)
          .from('companies')
          .update({
            notes: data.about || data.description || data.summary || null,
            tech_stack: Array.isArray(data.specialties) ? data.specialties : []
          })
          .eq('id', companyId)

        if (updateError) {
          console.warn('[Apify Trigger] Failed to update company:', updateError)
        }

      } catch (companyErr: any) {
        console.error('[Apify Trigger] Error processing company data:', companyErr)
        return NextResponse.json(
          { error: `Failed to process company data: ${companyErr.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Scrape completed successfully',
      contactId,
      dataReceived: items.length,
    })

  } catch (error: any) {
    console.error('[Apify Trigger] Unexpected error:', error)
    if (contactId && userId) {
      await logContactProcess(contactId, userId, 'linkedin_scraping_triggered', 'failed', {}, error.message)
    }
    return NextResponse.json(
      { error: error.message || 'Failed to process scrape' },
      { status: 500 }
    )
  }
}