import type { LucideIcon } from 'lucide-react'

type StatCardProps = { label: string; value: string; detail: string; icon: LucideIcon; tone: 'blue' | 'green' | 'orange' | 'purple' }

export function StatCard({ label, value, detail, icon: Icon, tone }: StatCardProps) {
  return <article className="dashboard-stat-card"><div className={`dashboard-stat-icon dashboard-stat-icon--${tone}`}><Icon size={19} /></div><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>
}
