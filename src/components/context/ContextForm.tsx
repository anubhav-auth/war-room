'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserContext } from '@/types/database'

export default function ContextForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [context, setContext] = useState<Partial<UserContext>>({
    name: '',
    current_role: '',
    years_exp: '',
    location: '',
    headline: '',
    loom_url: '',
    portfolio_url: '',
    github_url: '',
    linkedin_url: '',
    primary_stack: '',
    specialisation: '',
    target_role: '',
    target_stage: '',
    open_to: '',
    email_tone: 'Direct, technical, under 120 words',
    li_tone: 'Peer-to-peer, specific, not salesy',
    extra_context: '',
    projects: [],
  })

  const supabase = createClient()

  useEffect(() => {
    async function loadContext() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await (supabase as any)
        .from('user_context')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setContext(data)
      } else if (error && error.code !== 'PGRST116') {
        console.error('Error loading context:', error)
      }
      setLoading(false)
    }

    loadContext()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await (supabase as any)
      .from('user_context')
      .upsert({
        ...context,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      alert('Error saving context: ' + error.message)
    } else {
      alert('Context saved successfully!')
    }
    setSaving(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setContext((prev) => ({ ...prev, [name]: value }))
  }

  if (loading) return <div>Loading context...</div>

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identity */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Identity</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input type="text" name="name" value={context.name || ''} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Current Role</label>
            <input type="text" name="current_role" value={context.current_role || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Years of Experience</label>
            <input type="text" name="years_exp" value={context.years_exp || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input type="text" name="location" value={context.location || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
        </section>

        {/* Links & Hook */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">The Hook & Links</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Headline Hook</label>
            <input type="text" name="headline" value={context.headline || ''} onChange={handleChange} placeholder="e.g. Built zero-disk Go pipeline, 588k rows/sec" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Loom Demo URL</label>
            <input type="url" name="loom_url" value={context.loom_url || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Portfolio/GitHub/LinkedIn</label>
            <div className="space-y-2 mt-1">
              <input type="url" name="portfolio_url" value={context.portfolio_url || ''} onChange={handleChange} placeholder="Portfolio URL" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
              <input type="url" name="github_url" value={context.github_url || ''} onChange={handleChange} placeholder="GitHub URL" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
              <input type="url" name="linkedin_url" value={context.linkedin_url || ''} onChange={handleChange} placeholder="LinkedIn URL" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
            </div>
          </div>
        </section>

        {/* Stack & Expertise */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Expertise</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Primary Stack</label>
            <input type="text" name="primary_stack" value={context.primary_stack || ''} onChange={handleChange} placeholder="e.g. Go, Java, PostgreSQL" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Specialisation</label>
            <input type="text" name="specialisation" value={context.specialisation || ''} onChange={handleChange} placeholder="e.g. Distributed systems, high-throughput pipelines" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
        </section>

        {/* Target */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Target Role</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">Target Role</label>
            <input type="text" name="target_role" value={context.target_role || ''} onChange={handleChange} placeholder="e.g. Founding/Backend Engineer" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Target Company Stage</label>
            <input type="text" name="target_stage" value={context.target_stage || ''} onChange={handleChange} placeholder="e.g. Seed, Series A" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Open To</label>
            <input type="text" name="open_to" value={context.open_to || ''} onChange={handleChange} placeholder="e.g. Remote, Bangalore" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
          </div>
        </section>

        {/* Tone Preferences */}
        <section className="space-y-4 md:col-span-2">
          <h2 className="text-lg font-semibold border-b pb-2">Tone Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Tone</label>
              <textarea name="email_tone" value={context.email_tone || ''} onChange={handleChange} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">LinkedIn Tone</label>
              <textarea name="li_tone" value={context.li_tone || ''} onChange={handleChange} rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
            </div>
          </div>
        </section>

        {/* Extra Context */}
        <section className="space-y-4 md:col-span-2">
          <h2 className="text-lg font-semibold border-b pb-2">Extra Context for AI</h2>
          <textarea name="extra_context" value={context.extra_context || ''} onChange={handleChange} rows={4} placeholder="Any other specific details you want the AI to know..." className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
        </section>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Context'}
        </button>
      </div>
    </form>
  )
}
