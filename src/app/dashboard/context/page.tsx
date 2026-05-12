import ContextForm from '@/components/context/ContextForm'

export default function ContextPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Context</h1>
      </div>
      <p className="text-gray-600">
        This information is used to personalize all AI-generated outreach messages.
      </p>
      <ContextForm />
    </div>
  )
}
