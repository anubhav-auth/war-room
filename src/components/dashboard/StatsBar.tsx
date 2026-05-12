import { Contact } from '@/types/database'

export default function StatsBar({ contacts }: { contacts: Contact[] }) {
  const stats = [
    { label: 'Total Active', value: contacts.filter(c => c.outcome === 'active').length },
    { label: 'Replied', value: contacts.filter(c => c.replied_at).length },
    { label: 'Loom Viewed', value: contacts.filter(c => c.loom_viewed_at).length },
    { label: 'Calls', value: contacts.filter(c => c.call_booked_at).length },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-sm font-medium text-gray-500 uppercase">{stat.label}</p>
          <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
