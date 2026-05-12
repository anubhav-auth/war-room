import { buildSystemPrompt, buildUserPrompt } from './prompts'
import { UserContext, Contact, Company, LinkedInProfile } from '@/types/database'

export async function generateMessages(
  context: UserContext,
  contact: Contact,
  company: Company,
  profile: LinkedInProfile | null,
  companyProfile: any | null = null
) {
  const systemPrompt = buildSystemPrompt(context)
  const userPrompt = buildUserPrompt(contact, company, profile, companyProfile)

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://war-room.vercel.app', // Optional
      'X-Title': 'War Room', // Optional
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'minimax/minimax-text-01',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error: ${error}`)
  }

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}
