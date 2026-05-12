'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Contact, Company } from '@/types/database'
import { Plus, Search, Filter, Mail, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
// If Linkedin is not in lucide-react, we can just use the link icon or similar, but let's check package json or just omit it if it breaks.
import { computeNextAction, computePriorityScore } from '@/lib/priority'

export default function PipelineList() {
  const [contacts, setContacts] = useState<(Contact & { companies: Company })[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null)
  
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    company_id: '',
    title: '',
    contact_type: 'cto_founder',
    linkedin_url: '',
    email: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

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

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert([{ ...newContact, user_id: user.id }])
      .select()
      .single()

    if (error) {
      alert('Error adding contact: ' + error.message)
    } else if (contact) {
      setShowAddModal(false)
      setNewContact({ name: '', company_id: '', title: '', contact_type: 'cto_founder', linkedin_url: '', email: '', notes: '' })
      fetchData()
      
      // Trigger Apify if LinkedIn URL is present and not already scraped
      if (contact.linkedin_url) {
        // Fetch to see if profile exists
        supabase.from('linkedin_profiles').select('id').eq('contact_id', contact.id).single()
          .then(({ data }) => {
            if (!data) {
              fetch('/api/apify/trigger', {
                method: 'POST',
                body: JSON.stringify({ linkedinUrl: contact.linkedin_url, contactId: contact.id }),
              }).catch(err => console.error('Failed to trigger Apify:', err))
            }
          })
      }

      // Trigger email permutations if no email provided
      if (!contact.email) {
        fetch('/api/emails/generate', {
          method: 'POST',
          body: JSON.stringify({ contactId: contact.id, userId: user.id }),
        }).catch(err => console.error('Failed to trigger email permutations:', err))
      } else {
        // Trigger immediate generation if email is provided
        fetch('/api/generate', {
          method: 'POST',
          body: JSON.stringify({ contactId: contact.id, userId: user.id }),
        }).catch(err => console.error('Failed to trigger generation:', err))
      }
    }
    setSaving(false)
  }

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.companies?.name.toLowerCase().includes(searchTerm.toLowerCase())
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
                      <span className="text-gray-900">{contact.companies?.name}</span>
                      <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                        contact.companies?.tier === 1 ? 'bg-red-100 text-red-700' :
                        contact.companies?.tier === 2 ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        T{contact.companies?.tier}
                      </span>
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
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">Add New Contact</h2>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Company (Optional)</label>
                <select
                  value={newContact.company_id}
                  onChange={(e) => setNewContact({ ...newContact, company_id: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                >
                  <option value="">Select a company (or leave blank for auto-discovery)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">If blank, we&apos;ll auto-create the company from their LinkedIn profile.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={newContact.title || ''}
                  onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">LinkedIn URL</label>
                <input
                  type="url"
                  value={newContact.linkedin_url || ''}
                  onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={newContact.email || ''}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Contact'}
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

