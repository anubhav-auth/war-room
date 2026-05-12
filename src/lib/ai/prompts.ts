import { UserContext, Contact, Company, LinkedInProfile } from '@/types/database'

export function buildSystemPrompt(context: UserContext) {
  return `You are a technical outreach specialist writing messages for a backend software engineer 
doing a structured job search sprint.

ABOUT THE SENDER:
Name: ${context.name}
Role: ${context.current_role}
Experience: ${context.years_exp}
Headline Hook: ${context.headline}
Loom URL: ${context.loom_url}
Stack: ${context.primary_stack}
Specialisation: ${context.specialisation}
Target Role: ${context.target_role}
Email Tone: ${context.email_tone}
LinkedIn Tone: ${context.li_tone}
Extra Context: ${context.extra_context}

STRICT RULES:
- LinkedIn comment: 1-2 sentences, technically grounded, reference something specific from their actual recent post. Sound like a peer, not a fan. No flattery.
- Connection note: 1 sentence max. Mention something specific about their work.
- LinkedIn message (post-accept): 2-3 sentences. Make the email feel expected.
- Email 1 body: Under 120 words. One link (Loom). One ask (15 min call). First sentence must reference something specific to THIS company.
- Email 2 body: Value-add. Reference something new (post, commit, job posting update). Under 100 words. Reply to Email 1 thread.
- Email 3 body: Pivot to a different person. Under 80 words. Mention previous contact name.
- All subjects: Specific, no generic phrases, reference a technical detail or metric.

OUTPUT FORMAT: Return valid JSON with keys:
li_comment, li_connection_note, li_message,
email1_subject, email1_body,
email2_subject, email2_body,
email3_subject, email3_body`
}

export function buildUserPrompt(contact: Contact, company: Company, profile: LinkedInProfile | null, companyProfile: any | null = null) {
  let prompt = `ABOUT THE RECIPIENT:
Name: ${contact.name}
Title: ${contact.title}
Company: ${company.name}
Company description: ${company.description || (companyProfile ? companyProfile.about : '')}
Company stage: ${company.funding_stage}
Company tech stack: ${company.tech_stack?.join(', ')}
Job posting notes: ${company.notes}
`

  if (companyProfile) {
    prompt += `
COMPANY PROFILE (SCRAPED):
Industry: ${companyProfile.industry}
About: ${companyProfile.about}
Specialties: ${companyProfile.specialties?.join(', ')}
Headquarters: ${companyProfile.headquarters}
Founded: ${companyProfile.founded}
`
  }

  if (profile) {

    prompt += `
THEIR LINKEDIN DATA (use this to personalise):
Headline: ${profile.headline}
About: ${profile.about}
Experience: ${JSON.stringify(profile.experience)}
Skills: ${JSON.stringify(profile.skills)}
Recent Posts: ${JSON.stringify(profile.recent_posts)}
`
  }

  prompt += `\nGenerate all 9 outreach messages now.`
  return prompt
}
