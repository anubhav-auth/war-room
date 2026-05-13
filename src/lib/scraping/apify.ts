const ACTOR_PROFILE = 'supreme_coder~linkedin-profile-scraper'
const ACTOR_POST = 'supreme_coder~linkedin-post'

function getActorUrl(actor: string, sync = false) {
  const base = `https://api.apify.com/v2/acts/${actor}`
  if (sync) {
    return `${base}/run-sync-get-dataset-items?token=${process.env.APIFY_API_TOKEN}`
  }
  return `${base}/runs?token=${process.env.APIFY_API_TOKEN}`
}

export async function scrapeProfile(linkedinUrl: string): Promise<any[]> {
  const payload = {
    urls: [{ url: linkedinUrl }],
    findContacts: true,
    "findContacts.contactCompassToken": process.env.CONTACT_COMPASS_TOKEN,
    scrapeCompany: true,
  }

  console.log('[Apify] Scraping Profile (sync):', linkedinUrl)
  
  const response = await fetch(getActorUrl(ACTOR_PROFILE, true), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Apify error: ${error}`)
  }

  const data = await response.json()
  return data
}

export async function scrapePost(linkedinUrl: string): Promise<any[]> {
  const payload = {
    urls: [linkedinUrl],
    limitPerSource: 5,
    deepScrape: true,
  }

  console.log('[Apify] Scraping Posts (sync):', linkedinUrl)
  
  const response = await fetch(getActorUrl(ACTOR_POST, true), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Apify error: ${error}`)
  }

  const data = await response.json()
  return data
}

export async function scrapeCompany(linkedinUrl: string): Promise<any[]> {
  const payload = {
    urls: [{ url: linkedinUrl }],
    scrapeCompany: true,
  }

  console.log('[Apify] Scraping Company (sync):', linkedinUrl)
  
  const response = await fetch(getActorUrl(ACTOR_PROFILE, true), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Apify error: ${error}`)
  }

  const data = await response.json()
  return data
}

export async function triggerScrape(linkedinUrl: string) {
  const payload = {
    urls: [{ url: linkedinUrl }],
    findContacts: true,
    "findContacts.contactCompassToken": process.env.CONTACT_COMPASS_TOKEN,
    scrapeCompany: true,
  }

  console.log('[Apify] Triggering Scrape for:', linkedinUrl)
  
  const response = await fetch(getActorUrl(ACTOR_PROFILE), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Apify error: ${error}`)
  }

  const data = await response.json()
  return data.data.id
}

export async function triggerPostScrape(linkedinUrl: string) {
  const response = await fetch(getActorUrl(ACTOR_POST), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      urls: [linkedinUrl],
      limitPerSource: 5,
      deepScrape: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Apify error: ${error}`)
  }

  const data = await response.json()
  return data.data.id
}

export async function triggerCompanyScrape(linkedinUrl: string) {
  const response = await fetch(getActorUrl(ACTOR_PROFILE), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      urls: [{ url: linkedinUrl }],
      scrapeCompany: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Apify error: ${error}`)
  }

  const data = await response.json()
  return data.data.id
}