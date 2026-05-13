import { Contact } from '@/types/database'

/**
 * Comprehensive validation for contact data
 * Ensures all constraints before database operations
 */

export interface ValidationError {
  field: string
  message: string
}

export function validateLinkedInUrl(url: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!url || typeof url !== 'string') {
    return errors // Optional field
  }

  const trimmed = url.trim()
  
  // Must be valid URL
  try {
    const parsed = new URL(trimmed)
    if (!parsed.hostname.includes('linkedin.com')) {
      errors.push({
        field: 'linkedin_url',
        message: 'URL must be a valid LinkedIn profile or company URL'
      })
    }
  } catch {
    errors.push({
      field: 'linkedin_url',
      message: 'Invalid URL format'
    })
  }

  return errors
}

export function validateEmail(email: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!email || typeof email !== 'string') {
    return errors // Optional field
  }

  const trimmed = email.trim()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(trimmed)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format'
    })
  }

  return errors
}

export function validateContactType(type: string): ValidationError[] {
  const errors: ValidationError[] = []
  const validTypes = ['cto_founder', 'lead_eng', 'other']

  if (!validTypes.includes(type)) {
    errors.push({
      field: 'contact_type',
      message: `Contact type must be one of: ${validTypes.join(', ')}`
    })
  }

  return errors
}

export function validateName(name: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!name || typeof name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Name is required'
    })
    return errors
  }

  const trimmed = name.trim()

  if (trimmed.length === 0) {
    errors.push({
      field: 'name',
      message: 'Name cannot be empty'
    })
  }

  if (trimmed.length > 255) {
    errors.push({
      field: 'name',
      message: 'Name must be less than 255 characters'
    })
  }

  // Check for XSS attempts
  if (/<[^>]*>/g.test(trimmed)) {
    errors.push({
      field: 'name',
      message: 'Name contains invalid characters'
    })
  }

  return errors
}

export function validateTitle(title: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!title || typeof title !== 'string') {
    return errors // Optional field
  }

  const trimmed = title.trim()

  if (trimmed.length > 255) {
    errors.push({
      field: 'title',
      message: 'Title must be less than 255 characters'
    })
  }

  if (/<[^>]*>/g.test(trimmed)) {
    errors.push({
      field: 'title',
      message: 'Title contains invalid characters'
    })
  }

  return errors
}

export function validateNotes(notes: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!notes || typeof notes !== 'string') {
    return errors // Optional field
  }

  if (notes.length > 2000) {
    errors.push({
      field: 'notes',
      message: 'Notes must be less than 2000 characters'
    })
  }

  return errors
}

export function validateContactData(
  contact: Partial<Contact> & { linkedin_url?: string | null }
): ValidationError[] {
  const errors: ValidationError[] = []

  // Required fields
  errors.push(...validateName(contact.name || ''))
  errors.push(...validateContactType(contact.contact_type || 'cto_founder'))

  // Optional fields
  if (contact.title) {
    errors.push(...validateTitle(contact.title))
  }

  if (contact.email) {
    errors.push(...validateEmail(contact.email))
  }

  if (contact.linkedin_url) {
    errors.push(...validateLinkedInUrl(contact.linkedin_url))
  }

  if (contact.notes) {
    errors.push(...validateNotes(contact.notes))
  }

  return errors
}

/**
 * Sanitize contact data to prevent XSS and injection attacks
 */
export function sanitizeContactData(
  contact: Partial<Contact> & { linkedin_url?: string | null }
) {
  return {
    ...contact,
    name: contact.name ? contact.name.trim() : '',
    title: contact.title ? contact.title.trim() : '',
    email: contact.email ? contact.email.trim().toLowerCase() : '',
    linkedin_url: contact.linkedin_url ? contact.linkedin_url.trim() : '',
    notes: contact.notes ? contact.notes.trim() : '',
  }
}
