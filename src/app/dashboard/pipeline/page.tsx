import PipelineList from '@/components/pipeline/PipelineList'

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
      </div>
      <p className="text-gray-600">
        All your contacts across every company. Search, filter, and track progress here.
      </p>
      <PipelineList />
    </div>
  )
}
