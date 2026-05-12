import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Zap, Target, TrendingUp } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <main className="max-w-5xl mx-auto px-6 py-24 md:py-32">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-bold border border-blue-100 uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            <span>High-Volume Outreach Engine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
            Dominate Your <br />
            <span className="text-blue-600">Job Search Sprint.</span>
          </h1>
          
          <p className="max-w-2xl text-xl text-gray-600 leading-relaxed">
            Automate lead research, AI personalization, and task sequencing. 
            Manage a 100-contact startup pipeline in under 30 minutes a day.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            {user ? (
              <Link
                href="/dashboard"
                className="flex h-14 items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 text-white font-bold text-lg transition-all hover:bg-blue-700 hover:shadow-lg active:scale-95"
              >
                Go to War Room
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex h-14 items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 text-white font-bold text-lg transition-all hover:bg-blue-700 hover:shadow-lg active:scale-95"
              >
                Launch Your Sprint
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32">
          <FeatureCard 
            icon={<Target className="w-6 h-6 text-blue-600" />}
            title="Lead Prioritization"
            description="Our Next-Action engine tells you exactly who to reach out to and when, based on engagement."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-blue-600" />}
            title="AI Intelligence"
            description="Hyper-personalized messages generated from LinkedIn bios, recent posts, and company tech stacks."
          />
          <FeatureCard 
            icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
            title="Pipeline Tracking"
            description="No more spreadsheets. One centralized dashboard for visits, comments, and email sequences."
          />
        </div>
      </main>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}
