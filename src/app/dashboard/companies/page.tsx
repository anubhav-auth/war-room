import CompanyList from '@/components/companies/CompanyList'

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
      </div>
      <p className="text-gray-600">
        Manage the companies you are targeting. Tiers help prioritize your outreach.
      </p>
      <CompanyList />
    </div>
  )
}
