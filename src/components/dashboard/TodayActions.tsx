'use client'

import React, { useState } from 'react'
import { Contact, Company, GeneratedMessage } from '@/types/database'
import { computeNextAction, computePriorityScore, daysSinceLastTouch } from '@/lib/priority'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp, Copy, Check, RefreshCw } from 'lucide-react'

export default function TodayActions({ initialContacts }: { initialContacts: (Contact & { companies: Company, generated_messages: GeneratedMessage | null })[] }) {
  const [contacts, setContacts] = useState(initialContacts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  const sortedContacts = [...contacts]
    .filter(c => computeNextAction(c) !== '')
    .sort((a, b) => {
      const scoreA = computePriorityScore(a, a.companies.tier)
      const scoreB = computePriorityScore(b, b.companies.tier)
      return scoreB - scoreA
    })

  const handleActionDone = async (contact: Contact, actionLabel: string) => {
    const today = new Date().toISOString().split('T')[0]
    let update: Partial<Contact> = {}

    if (actionLabel.includes('Visit')) update = { li_visited_at: today }
    else if (actionLabel.includes('comment')) update = { li_commented_at: today }
    else if (actionLabel.includes('connection')) update = { li_connection_sent_at: today }
    else if (actionLabel.includes('post-accept')) update = { li_message_sent_at: today }
    else if (actionLabel.includes('first email')) update = { email1_sent_at: today }
    else if (actionLabel.includes('follow-up')) update = { email2_sent_at: today }
    else if (actionLabel.includes('pivot')) update = { email3_sent_at: today }
    else if (actionLabel.includes('Respond')) update = { replied_at: today }

    // Optimistic update
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, ...update } : c))

    const { error } = await (supabase as any).from('contacts').update(update).eq('id', contact.id)
    if (error) {
      console.error('Update error:', error)
      // revert on error if needed
    } else {
      // Log action
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await (supabase as any).from('actions_log').insert({
          contact_id: contact.id,
          user_id: user.id,
          action_type: actionLabel,
          outcome: 'positive'
        })
      }
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopyStatus({ ...copyStatus, [id]: true })
    setTimeout(() => setCopyStatus({ ...copyStatus, [id]: false }), 2000)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Today&apos;s Actions</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Contact</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Company</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-center">Next Step</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-center">Days</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedContacts.map((contact) => {
              const nextAction = computeNextAction(contact)
              const daysSince = daysSinceLastTouch(contact)
              const isTier1 = contact.companies.tier === 1

              return (
                <React.Fragment key={contact.id}>
                  <tr 
                    className={`hover:bg-gray-50 cursor-pointer ${isTier1 ? 'border-l-4 border-l-red-500' : ''}`}
                    onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{contact.name}</div>
                      <div className="text-sm text-gray-500">{contact.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{contact.companies.name}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleActionDone(contact, nextAction); }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        {nextAction}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-medium ${daysSince > 7 ? 'text-red-600' : 'text-gray-500'}`}>
                        {daysSince === 999 ? '-' : daysSince}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {expandedId === contact.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </td>
                  </tr>
                  {expandedId === contact.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-6 py-6 border-b border-gray-200">
                        <div className="space-y-6">
                          {contact.generated_messages ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <MessageSection 
                                title="LinkedIn Outreach" 
                                items={[
                                  { label: 'Comment', text: contact.generated_messages.li_comment },
                                  { label: 'Note', text: contact.generated_messages.li_connection_note },
                                  { label: 'Message', text: contact.generated_messages.li_message }
                                ]}
                                onCopy={handleCopy}
                                copyStatus={copyStatus}
                              />
                              <MessageSection 
                                title="Email Sequence" 
                                items={[
                                  { label: 'Email 1', text: contact.generated_messages.email1_body, subject: contact.generated_messages.email1_subject },
                                  { label: 'Email 2', text: contact.generated_messages.email2_body, subject: contact.generated_messages.email2_subject }
                                ]}
                                onCopy={handleCopy}
                                copyStatus={copyStatus}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                              <RefreshCw className="w-8 h-8 mb-2 animate-spin-slow" />
                              <p>Generating personalized messages...</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MessageSection({ title, items, onCopy, copyStatus }: { title: string, items: any[], onCopy: any, copyStatus: any }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</h3>
      <div className="space-y-4">
        {items.map((item, idx) => (
          item.text && (
            <div key={idx} className="bg-white p-3 rounded border border-gray-200 shadow-sm relative group">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase">{item.label}</span>
                <button 
                  onClick={() => onCopy(item.text, `${title}-${idx}`)}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                >
                  {copyStatus[`${title}-${idx}`] ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {item.subject && <div className="text-xs font-bold mb-1">Subject: {item.subject}</div>}
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{item.text}</div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

