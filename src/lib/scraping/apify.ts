export async function triggerScrape(linkedinUrl: string) {
  const payload = {
    urls: [{ url: linkedinUrl }],
    findContacts: true,
    "findContacts.contactCompassToken": process.env.CONTACT_COMPASS_TOKEN,
    scrapeCompany: true,
  }

  console.log('[Apify] Triggering Scrape for:', linkedinUrl)
  
  const response = await fetch(`https://api.apify.com/v2/acts/supreme_coder~linkedin-profile-scraper/runs?token=${process.env.APIFY_API_TOKEN}`, {
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
  return data.data.id // runId
}

export async function triggerPostScrape(linkedinUrl: string) {
  const response = await fetch(`https://api.apify.com/v2/acts/supreme_coder~linkedin-post/runs?token=${process.env.APIFY_API_TOKEN}`, {
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
  // The same actor supports company scraping if the URL is a company URL
  const response = await fetch(`https://api.apify.com/v2/acts/supreme_coder~linkedin-profile-scraper/runs?token=${process.env.APIFY_API_TOKEN}`, {
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
