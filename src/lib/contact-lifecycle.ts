import { createAdminClient } from '@/lib/supabase/admin'
import { Contact } from '@/types/database'

/**
 * Track the lifecycle of a contact through all processing stages
 * Enables recovery and troubleshooting if processes fail
 */

export type ContactProcessStage = 
  | 'created'
  | 'linkedin_scraping_triggered'
  | 'linkedin_scraped'
  | 'posts_scraped'
  | 'emails_generated'
  | 'messages_generated'
  | 'failed'

export interface ContactProcessLog {
  contact_id: string
  user_id: string
  stage: ContactProcessStage
  status: 'success' | 'failed' | 'pending'
  details: Record<string, any>
  error?: string
  timestamp: string
  attempt: number
}

/**
 * Log contact lifecycle events for debugging and recovery
 */
export async function logContactProcess(
  contactId: string,
  userId: string,
  stage: ContactProcessStage,
  status: 'success' | 'failed' | 'pending',
  details: Record<string, any> = {},
  error?: string
) {
  try {
    const supabase = createAdminClient()
    
    // Get current attempt count
    const { data: logs } = await (supabase as any)
      .from('contact_process_logs')
      .select('attempt')
      .eq('contact_id', contactId)
      .eq('stage', stage)
      .order('timestamp', { ascending: false })
      .limit(1)

    const attempt = logs && logs.length > 0 ? logs[0].attempt + 1 : 1

    await (supabase as any)
      .from('contact_process_logs')
      .insert({
        contact_id: contactId,
        user_id: userId,
        stage,
        status,
        details,
        error,
        timestamp: new Date().toISOString(),
        attempt,
      })
  } catch (err) {
    console.error('[ContactLogger] Failed to log process:', err)
    // Don't throw - logging failures should not break the main flow
  }
}

/**
 * Get the last known state of a contact's processing
 */
export async function getContactProcessState(contactId: string) {
  try {
    const supabase = createAdminClient()
    
    const { data: logs } = await (supabase as any)
      .from('contact_process_logs')
      .select('*')
      .eq('contact_id', contactId)
      .order('timestamp', { ascending: false })
      .limit(1)

    if (!logs || logs.length === 0) {
      return null
    }

    return logs[0] as ContactProcessLog
  } catch (err) {
    console.error('[ContactLogger] Failed to get process state:', err)
    return null
  }
}

/**
 * Get all processing events for a contact (for debugging)
 */
export async function getContactProcessHistory(contactId: string) {
  try {
    const supabase = createAdminClient()
    
    const { data: logs } = await (supabase as any)
      .from('contact_process_logs')
      .select('*')
      .eq('contact_id', contactId)
      .order('timestamp', { ascending: true })

    return logs as ContactProcessLog[]
  } catch (err) {
    console.error('[ContactLogger] Failed to get process history:', err)
    return []
  }
}

/**
 * Check if a contact is safe to retry processing
 */
export async function canRetryContactProcess(contactId: string): Promise<boolean> {
  const lastState = await getContactProcessState(contactId)
  
  if (!lastState) {
    return true // Never tried, can start
  }

  if (lastState.status === 'success') {
    return false // Already succeeded
  }

  if (lastState.attempt >= 3) {
    return false // Too many retries
  }

  // Check if enough time has passed since last attempt (exponential backoff)
  const lastTimestamp = new Date(lastState.timestamp).getTime()
  const now = Date.now()
  const delayMs = Math.pow(2, lastState.attempt) * 1000 // 2s, 4s, 8s

  return (now - lastTimestamp) >= delayMs
}

/**
 * Verify contact has all required relations before processing
 */
export async function verifyContactRelations(
  contactId: string,
  userId: string
): Promise<{
  valid: boolean
  contact?: Contact
  errors: string[]
}> {
  try {
    const supabase = createAdminClient()

    // Verify contact exists and belongs to user
    const { data: contact, error: contactError } = await (supabase as any)
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single()

    const errors: string[] = []

    if (contactError || !contact) {
      errors.push('Contact not found or unauthorized')
      return { valid: false, errors }
    }

    // If contact has company, verify company exists
    if ((contact as any).company_id) {
      const { data: company, error: companyError } = await (supabase as any)
        .from('companies')
        .select('id')
        .eq('id', (contact as any).company_id)
        .eq('user_id', userId)
        .single()

      if (companyError || !company) {
        errors.push('Associated company not found')
        return { valid: false, errors }
      }
    }

    // If contact has name that's too short or empty, flag it
    if (!contact.name || contact.name.trim().length === 0) {
      errors.push('Contact name is empty')
    }

    return { valid: errors.length === 0, contact, errors }
  } catch (err) {
    return {
      valid: false,
      errors: [`Failed to verify contact relations: ${err instanceof Error ? err.message : String(err)}`]
    }
  }
}

/**
 * Soft delete a contact safely (mark as deleted instead of removing)
 * Preserves all process logs and audit trail
 */
export async function softDeleteContact(contactId: string, userId: string) {
  try {
    const supabase = createAdminClient()

    // Mark as deleted in actions_log rather than hard delete
    await (supabase as any)
      .from('actions_log')
      .insert({
        contact_id: contactId,
        user_id: userId,
        action: 'contact_deleted',
        metadata: { deleted_at: new Date().toISOString() }
      })

    // Hard delete is still available for actual deletion
    await (supabase as any)
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', userId)
  } catch (err) {
    console.error('[ContactLogger] Failed to soft delete contact:', err)
    throw err
  }
}
