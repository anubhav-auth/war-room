'use client'

import { Contact, Company } from '@/types/database'
import { Flame, MessageCircle } from 'lucide-react'

export default function HotLeads({ contacts }: { contacts: (Contact & { companies: Company })[] }) {
  const hotLeads = contacts.filter(c => c.loom_viewed_at || c.replied_at)

  if (hotLeads.length === 0) return null

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 flex items-center">
        <Flame className="w-6 h-6 text-orange-500 mr-2" />
        Hot Leads
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hotLeads.map((contact) => (
          <div key={contact.id} className="bg-white p-4 rounded-lg shadow-sm border border-orange-200 hover:shadow-md transition-shadow relative">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900">{contact.name}</h3>
                <p className="text-sm text-gray-500">{contact.companies.name}</p>
              </div>
              <div className="flex space-x-1">
                {contact.replied_at && <span className="p-1 bg-green-100 text-green-600 rounded" title="Replied"><MessageCircle className="w-4 h-4" /></span>}
                {contact.loom_viewed_at && <span className="p-1 bg-orange-100 text-orange-600 rounded" title="Loom Viewed"><Flame className="w-4 h-4" /></span>}
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                contact.replied_at ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {contact.replied_at ? 'Replied' : 'Loom Viewed'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
