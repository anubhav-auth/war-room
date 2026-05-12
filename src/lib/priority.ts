import { differenceInDays } from 'date-fns'
import { Contact } from '@/types/database'

export function computeNextAction(contact: Contact): string {
  if (contact.outcome !== 'active') return ''

  if (contact.replied_at) return '💬 Respond to their reply'
  if (contact.loom_viewed_at && !contact.replied_at) return '🔥 Follow up — they watched your Loom'
  if (contact.call_booked_at) return '📞 Confirm call details'

  if (contact.email3_sent_at) return '' // sequence complete

  const now = new Date()

  if (contact.email2_sent_at) {
    const daysSince = differenceInDays(now, new Date(contact.email2_sent_at))
    return daysSince >= 5 ? '📧 Send pivot email (Email 3)' : ''
  }

  if (contact.email1_sent_at) {
    const daysSince = differenceInDays(now, new Date(contact.email1_sent_at))
    return daysSince >= 5 ? '📧 Send follow-up (Email 2)' : ''
  }

  if (contact.li_connected_at) {
    return contact.li_message_sent_at ? '📧 Send first email' : '💬 Send post-accept message'
  }

  if (contact.li_connection_sent_at) {
    const daysSince = differenceInDays(now, new Date(contact.li_connection_sent_at))
    return daysSince >= 2 ? '📧 Send first email (48h passed)' : ''
  }

  if (contact.li_commented_at) return '🤝 Send connection request'
  if (contact.li_visited_at) return '💬 Leave a comment'
  if (contact.linkedin_url) return '👁 Visit LinkedIn profile'
  if (contact.email) return '📧 Send first email (no LinkedIn)'

  return '⚠️ Add LinkedIn or email'
}

export function computePriorityScore(contact: Contact, companyTier: number): number {
  if (contact.outcome !== 'active' && contact.outcome !== 'referral') return 0

  if (contact.replied_at) return 100
  if (contact.loom_viewed_at && !contact.replied_at) return 90
  if (contact.call_booked_at) return 85

  const nextAction = computeNextAction(contact)
  if (!nextAction) return 5 // sequence complete or waiting

  if (nextAction.includes('email')) {
    if (companyTier === 1) return 70
    if (companyTier === 2) return 60
    return 50
  }

  if (nextAction.includes('connection')) {
    if (companyTier === 1) return 40
    if (companyTier === 2) return 30
    return 20
  }

  if (nextAction.includes('visit') || nextAction.includes('comment') || nextAction.includes('message')) {
    if (companyTier === 1) return 35
    if (companyTier === 2) return 25
    return 15
  }

  return 10
}

export function daysSinceLastTouch(contact: Contact): number {
  const touches = [
    contact.li_visited_at,
    contact.li_commented_at,
    contact.li_connection_sent_at,
    contact.li_connected_at,
    contact.li_message_sent_at,
    contact.email1_sent_at,
    contact.email2_sent_at,
    contact.email3_sent_at,
  ]
    .filter(Boolean)
    .map((d) => new Date(d!).getTime())

  if (touches.length === 0) return 999

  const lastTouch = Math.max(...touches)
  return differenceInDays(new Date(), new Date(lastTouch))
}
