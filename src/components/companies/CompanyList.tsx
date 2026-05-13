'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Company } from '@/types/database'
import { Building2, Plus, ExternalLink } from 'lucide-react'

export default function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCompany, setNewCompany] = useState<Partial<Company & { linkedin_url?: string }>>({
    name: '',
    tier: 2,
    funding_stage: '',
    website_url: '',
    linkedin_url: '',
    tech_stack: [],
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    const { data, error } = await (supabase as any)
      .from('companies')
      .select('*, company_profiles(scraped_at)')
      .order('tier', { ascending: true })
      .order('name', { ascending: true })

    if (data) setCompanies(data as any)
    setLoading(false)
  }

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: company, error } = await (supabase as any)
      .from('companies')
      .insert([{ ...newCompany, user_id: user.id }])
      .select()
      .single()

    if (error) {
      alert('Error adding company: ' + error.message)
    } else if (company) {
      setShowAddModal(false)
      setNewCompany({ name: '', tier: 2, funding_stage: '', website_url: '', linkedin_url: '', tech_stack: [], notes: '' })
      fetchCompanies()

      // Trigger Apify if LinkedIn URL is present and not already scraped
      if ((company as any).linkedin_url) {
        (supabase as any).from('company_profiles').select('id').eq('company_id', (company as any).id).single()
          .then(({ data }: any) => {
            if (!data) {
              fetch('/api/apify/trigger', {
                method: 'POST',
                body: JSON.stringify({ linkedinUrl: (company as any).linkedin_url, companyId: (company as any).id }),
              }).then(() => {
                // Refresh data after scraping completes
                fetchCompanies()
              }).catch(err => console.error('Failed to trigger Apify:', err))
            }
          })
      }
    }
    setSaving(false)
  }

  if (loading) return <div>Loading companies...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Company
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div key={company.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="ml-3 text-lg font-bold text-gray-900">{company.name}</h3>
              </div>
              <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${
                company.tier === 1 ? 'bg-red-100 text-red-700' :
                company.tier === 2 ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                Tier {company.tier}
              </span>
            </div>
            
            <div className="mt-4 space-y-2">
              {company.funding_stage && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Stage:</span> {company.funding_stage}
                </p>
              )}
              {company.tech_stack && company.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {company.tech_stack.map((tech) => (
                    <span key={tech} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-3 mt-2">
                {company.website_url && (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Website
                  </a>
                )}
                {(company as any).linkedin_url && (
                  <a
                    href={(company as any).linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                  >
                    <span className="w-4 h-4 mr-1" />
                    LinkedIn
                  </a>
                )}
              </div>
              {!(company as any).company_profiles?.[0] && (company as any).linkedin_url && (
                <p className="text-[10px] text-yellow-600 font-bold uppercase animate-pulse mt-2">
                  Scraping Company Data...
                </p>
              )}
            </div>
            
            {company.notes && (
              <p className="mt-4 text-sm text-gray-500 line-clamp-2 italic">
                &quot;{company.notes}&quot;
              </p>
            )}
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-6">Add New Company</h2>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tier</label>
                <select
                  value={newCompany.tier}
                  onChange={(e) => setNewCompany({ ...newCompany, tier: parseInt(e.target.value) })}
                  className="mt-1 block w-full border rounded-md p-2"
                >
                  <option value={1}>Tier 1 (High Priority)</option>
                  <option value={2}>Tier 2 (Standard)</option>
                  <option value={3}>Tier 3 (Bulk)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Funding Stage</label>
                <input
                  type="text"
                  value={newCompany.funding_stage || ''}
                  onChange={(e) => setNewCompany({ ...newCompany, funding_stage: e.target.value })}
                  placeholder="e.g. Seed, Series A"
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Website URL</label>
                <input
                  type="url"
                  value={newCompany.website_url || ''}
                  onChange={(e) => setNewCompany({ ...newCompany, website_url: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">LinkedIn Company URL</label>
                <input
                  type="url"
                  value={newCompany.linkedin_url || ''}
                  onChange={(e) => setNewCompany({ ...newCompany, linkedin_url: e.target.value })}
                  className="mt-1 block w-full border rounded-md p-2"
                  placeholder="https://www.linkedin.com/company/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tech Stack (comma separated)</label>
                <input
                  type="text"
                  value={newCompany.tech_stack?.join(', ') || ''}
                  onChange={(e) => setNewCompany({ ...newCompany, tech_stack: e.target.value.split(',').map(s => s.trim()) })}
                  className="mt-1 block w-full border rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={newCompany.notes || ''}
                  onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
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
                  {saving ? 'Saving...' : 'Add Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
