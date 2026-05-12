import { createClient } from '@/lib/supabase/server'
import StatsBar from '@/components/dashboard/StatsBar'
import TodayActions from '@/components/dashboard/TodayActions'
import HotLeads from '@/components/dashboard/HotLeads'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: contacts } = await (supabase as any)
    .from('contacts')
    .select('*, companies(*), generated_messages(*)')
    .eq('outcome', 'active')

  const allContacts = (contacts || []) as any

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">War Room</h1>
        <p className="text-gray-500 mt-1">Focus on what matters most today.</p>
      </header>

      <StatsBar contacts={allContacts} />

      <HotLeads contacts={allContacts} />

      <TodayActions initialContacts={allContacts} />
    </div>
  )
}
