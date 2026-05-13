'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Contact, Company } from '@/types/database'
import { Plus, Search, Filter, Mail, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Trash2, AlertCircle } from 'lucide-react'
import { computeNextAction, computePriorityScore } from '@/lib/priority'
import { validateContactData, sanitizeContactData } from '@/lib/validation/contact'
import { logContactProcess } from '@/lib/contact-lifecycle'

export default function PipelineList() {
  const [contacts, setContacts] = useState<(Contact & { companies: Company | null })[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    company_id: undefined,
    title: '',
    contact_type: 'cto_founder',
    linkedin_url: '',
    email: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function fetchData() {
    const { data: contactsData, error: contactsError } = await supabase
      .from('contacts')
      .select('*, companies(*), email_permutations(status), linkedin_profiles(id), generated_messages(id)')
      .order('created_at', { ascending: false })

    const { data: companiesData } = await supabase
      .from('companies')
      .select('*')
      .order('name')

    if (contactsData) setContacts(contactsData as any)
    if (companiesData) setCompanies(companiesData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Subscribe to real-time updates on contacts table
    const subscription = supabase
      .channel('contacts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors({})
    setApiError(null)
    
    try {
      setSaving(true)

      // 1. Validate input data
      const validationErrs = validateContactData(newContact)
      if (validationErrs.length > 0) {
        const errorMap: Record<string, string> = {}
        validationErrs.forEach(err => {
          errorMap[err.field] = err.message
        })
        setValidationErrors(errorMap)
        setSaving(false)
        return
      }

      // 2. Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setApiError('Authentication failed. Please refresh and try again.')
        setSaving(false)
        return
      }

      // 3. Sanitize data to prevent XSS/injection
      const sanitizedContact = sanitizeContactData(newContact)

      // 4. Prepare contact data
      const contactData = {
        ...sanitizedContact,
        user_id: user.id,
        company_id: sanitizedContact.company_id || null,
        outcome: 'active',
      }

      // 5. Create contact in database
      const { data: contact, error } = await (supabase as any)
        .from('contacts')
        .insert([contactData])
        .select()
        .single()

      if (error || !contact) {
        console.error('[Pipeline] Database insert error:', error)
        setApiError(`Failed to create contact: ${error?.message || 'Unknown error'}`)
        setSaving(false)
        return
      }

      console.log('[Pipeline] Contact created:', contact.id)

      // 6. Log initial creation
      await logContactProcess(contact.id, user.id, 'created', 'success', {
        name: contact.name,
        has_linkedin_url: !!contact.linkedin_url,
        has_email: !!contact.email,
      })

      // 7. Reset modal
      setShowAddModal(false)
      setNewContact({
        name: '',
        company_id: undefined,
        title: '',
        contact_type: 'cto_founder',
        linkedin_url: '',
        email: '',
        notes: '',
      })

      // 8. Immediately refresh to show new contact
      await fetchData()

      // 9. Trigger background processes (fire and forget with logging)
      if (contact.linkedin_url) {
        console.log('[Pipeline] Triggering Apify scrape for:', contact.id)
        await logContactProcess(contact.id, user.id, 'linkedin_scraping_triggered', 'pending', {
          linkedin_url: contact.linkedin_url,
        })

        fetch('/api/apify/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkedinUrl: contact.linkedin_url, contactId: contact.id }),
        }).catch(err => {
          console.error('[Pipeline] Apify trigger failed:', err)
          logContactProcess(contact.id, user.id, 'linkedin_scraping_triggered', 'failed', {}, err.message)
        })
      }

      // 10. Generate emails if no email provided AND no linkedin_url provided
      // (If linkedin_url is provided, the Apify webhook will handle email generation)
      if (!contact.email && !contact.linkedin_url) {
        console.log('[Pipeline] Triggering email generation for:', contact.id)
        fetch('/api/emails/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: contact.id, userId: user.id }),
        }).catch(err => {
          console.error('[Pipeline] Email generation failed:', err)
          logContactProcess(contact.id, user.id, 'emails_generated', 'failed', {}, err.message)
        })
      } else if (contact.email) {
        // If email is provided, generate AI messages directly
        console.log('[Pipeline] Triggering message generation for:', contact.id)
        fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: contact.id, userId: user.id }),
        }).catch(err => {
          console.error('[Pipeline] Message generation failed:', err)
          logContactProcess(contact.id, user.id, 'messages_generated', 'failed', {}, err.message)
        })
      }
    } catch (err) {
      console.error('[Pipeline] Unexpected error:', err)
      setApiError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return
    
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error deleting contact: ' + error.message)
    } else {
      fetchData()
    }
  }

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div>Loading pipeline...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts or companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Contact
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Next Action</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredContacts.map((contact) => (
              <React.Fragment key={contact.id}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedContactId(expandedContactId === contact.id ? null : contact.id)}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{contact.name}</div>
                    <div className="text-sm text-gray-500">{contact.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className="text-gray-900">{contact.companies?.name || 'Auto-discovery...'}</span>
                      {contact.companies && (
                        <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                          contact.companies.tier === 1 ? 'bg-red-100 text-red-700' :
                          contact.companies.tier === 2 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          T{contact.companies.tier}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                      contact.outcome === 'active' ? 'bg-green-100 text-green-800' :
                      contact.outcome === 'hired' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {contact.outcome}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{computeNextAction(contact) || 'Sequence Complete'}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {!contact.email && (contact as any).email_permutations?.some((p: any) => p.status === 'pending') && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                          Verifying Emails...
                        </span>
                      )}
                      {contact.linkedin_url && !(contact as any).linkedin_profiles?.[0] && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                          Scraping Profile...
                        </span>
                      )}
                      {(contact as any).linkedin_profiles?.[0] && !(contact as any).generated_messages?.[0] && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                          Generating AI...
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-12 bg-gray-200 rounded-full h-1.5 mr-2">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full" 
                          style={{ width: `${computePriorityScore(contact, contact.companies?.tier || 2)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{computePriorityScore(contact, contact.companies?.tier || 2)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {expandedContactId === contact.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </td>
                </tr>
                {expandedContactId === contact.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-6 py-6 border-b border-gray-200">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Column 1: Identity & Scraped Bio */}
                        <div className="space-y-6">
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Profile Details</h4>
                            <div className="bg-white p-4 rounded border border-gray-200 shadow-sm space-y-3">
                              <div className="font-bold text-gray-900">{(contact as any).linkedin_profiles?.[0]?.headline || contact.title}</div>
                              <div className="text-sm text-gray-600 line-clamp-6 whitespace-pre-wrap">{(contact as any).linkedin_profiles?.[0]?.about || 'No bio scraped yet.'}</div>
                              <div className="flex flex-col space-y-2 pt-2 border-t">
                                {contact.linkedin_url && (
                                  <a href={contact.linkedin_url} target="_blank" className="flex items-center text-sm text-blue-600 hover:underline">
                                    <span className="w-4 h-4 mr-2" /> View LinkedIn
                                  </a>
                                )}
                                {contact.email && (
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Mail className="w-4 h-4 mr-2" /> {contact.email}
                                  </div>
                                )}
                                <button 
                                  onClick={() => handleDeleteContact(contact.id)}
                                  className="flex items-center text-xs text-red-600 hover:text-red-800 transition-colors pt-3 border-t mt-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Contact
                                </button>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recent Posts</h4>
                            <div className="space-y-3">
                              {(contact as any).linkedin_profiles?.[0]?.recent_posts?.slice(0, 3).map((post: any, i: number) => (
                                <div key={i} className="bg-white p-3 rounded border border-gray-100 text-xs text-gray-600 line-clamp-3 italic">
                                  &quot;{post.text}&quot;
                                </div>
                              )) || <div className="text-xs text-gray-400 italic">No recent posts found.</div>}
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Sequence & Status */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sequence Tracking</h4>
                          <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
                            <div className="grid grid-cols-1 gap-3">
                              <StatusBadge label="LinkedIn Visit" date={contact.li_visited_at} />
                              <StatusBadge label="Comment Left" date={contact.li_commented_at} />
                              <StatusBadge label="Connection Sent" date={contact.li_connection_sent_at} />
                              <StatusBadge label="Connected" date={contact.li_connected_at} />
                              <StatusBadge label="Post-Accept Msg" date={contact.li_message_sent_at} />
                              <StatusBadge label="Email 1 (Cold)" date={contact.email1_sent_at} />
                              <StatusBadge label="Email 2 (Followup)" date={contact.email2_sent_at} />
                              <StatusBadge label="Email 3 (Pivot)" date={contact.email3_sent_at} />
                            </div>
                            <div className="mt-6 pt-4 border-t">
                              <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Internal Notes</h5>
                              <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded">{contact.notes || 'No private notes.'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Column 3: Generated Messages */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Drafted Messages</h4>
                          {(contact as any).generated_messages?.[0] ? (
                            <div className="space-y-4">
                              <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">LI Comment</div>
                                <div className="text-sm text-gray-800 line-clamp-3">{(contact as any).generated_messages[0].li_comment}</div>
                              </div>
                              <div className="bg-purple-50 p-3 rounded border border-purple-100">
                                <div className="text-[10px] font-bold text-purple-600 uppercase mb-1">LI Connection Note</div>
                                <div className="text-sm text-gray-800 line-clamp-3">{(contact as any).generated_messages[0].li_connection_note}</div>
                              </div>
                              <div className="bg-green-50 p-3 rounded border border-green-100">
                                <div className="text-[10px] font-bold text-green-600 uppercase mb-1">Email 1</div>
                                <div className="text-xs font-bold mb-1">{(contact as any).generated_messages[0].email1_subject}</div>
                                <div className="text-sm text-gray-800 line-clamp-4">{(contact as any).generated_messages[0].email1_body}</div>
                              </div>
                              <button className="w-full py-2 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors uppercase border-t mt-2">
                                View Full Sequence in Dashboard →
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12 bg-white rounded border border-gray-200 border-dashed">
                              <RefreshCw className="w-6 h-6 text-gray-300 animate-spin-slow mb-2" />
                              <div className="text-xs text-gray-400 font-medium">Drafting intelligence...</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Add New Contact</h2>
            
            {/* API Error Display */}
            {apiError && (
              <div className="mb-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">{apiError}</p>
                  <button
                    type="button"
                    onClick={() => setApiError(null)}
                    className="text-xs text-red-600 hover:text-red-700 mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAddContact} className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full name of contact"
                  maxLength={255}
                  value={newContact.name || ''}
                  onChange={(e) => {
                    setNewContact({ ...newContact, name: e.target.value })
                    if (validationErrors.name) {
                      const newErrors = { ...validationErrors }
                      delete newErrors.name
                      setValidationErrors(newErrors)
                    }
                  }}
                  className={`mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:outline-none ${
                    validationErrors.name
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {validationErrors.name && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.name}
                  </p>
                )}
              </div>

              {/* Company Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Company (Optional)</label>
                <select
                  value={newContact.company_id ?? ''}
                  onChange={(e) => setNewContact({ ...newContact, company_id: e.target.value || null })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select a company (or leave blank for auto-discovery)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">If blank, we&apos;ll auto-create the company from their LinkedIn profile.</p>
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CTO, Lead Engineer"
                  maxLength={255}
                  value={newContact.title || ''}
                  onChange={(e) => {
                    setNewContact({ ...newContact, title: e.target.value })
                    if (validationErrors.title) {
                      const newErrors = { ...validationErrors }
                      delete newErrors.title
                      setValidationErrors(newErrors)
                    }
                  }}
                  className={`mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:outline-none ${
                    validationErrors.title
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {validationErrors.title && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.title}
                  </p>
                )}
              </div>

              {/* Contact Type Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contact Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={newContact.contact_type || 'cto_founder'}
                  onChange={(e) => {
                    setNewContact({ ...newContact, contact_type: e.target.value as any })
                    if (validationErrors.contact_type) {
                      const newErrors = { ...validationErrors }
                      delete newErrors.contact_type
                      setValidationErrors(newErrors)
                    }
                  }}
                  className={`mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:outline-none ${
                    validationErrors.contact_type
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                >
                  <option value="cto_founder">CTO / Founder</option>
                  <option value="lead_eng">Lead Engineer</option>
                  <option value="other">Other</option>
                </select>
                {validationErrors.contact_type && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.contact_type}
                  </p>
                )}
              </div>

              {/* LinkedIn URL Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">LinkedIn URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                  value={newContact.linkedin_url || ''}
                  onChange={(e) => {
                    setNewContact({ ...newContact, linkedin_url: e.target.value })
                    if (validationErrors.linkedin_url) {
                      const newErrors = { ...validationErrors }
                      delete newErrors.linkedin_url
                      setValidationErrors(newErrors)
                    }
                  }}
                  className={`mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:outline-none ${
                    validationErrors.linkedin_url
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {validationErrors.linkedin_url && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.linkedin_url}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 mt-1">We&apos;ll scrape their profile to enrich the contact data.</p>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={newContact.email || ''}
                  onChange={(e) => {
                    setNewContact({ ...newContact, email: e.target.value })
                    if (validationErrors.email) {
                      const newErrors = { ...validationErrors }
                      delete newErrors.email
                      setValidationErrors(newErrors)
                    }
                  }}
                  className={`mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:outline-none ${
                    validationErrors.email
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {validationErrors.email && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.email}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 mt-1">If not provided, we&apos;ll generate email permutations to try.</p>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setValidationErrors({})
                    setApiError(null)
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Creating...' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ label, date }: { label: string, date: string | null }) {
  return (
    <div className={`flex items-center px-2 py-1 rounded text-[10px] font-medium ${date ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${date ? 'bg-green-500' : 'bg-gray-300'}`}></span>
      {label}
    </div>
  )
}
