import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

type QuickActionCardProps = { title: string; description: string; to: string; icon: LucideIcon; tone: 'blue' | 'green' | 'orange' }

export function QuickActionCard({ title, description, to, icon: Icon, tone }: QuickActionCardProps) {
  return <Link className="quick-action-card" to={to}><span className={`quick-action-icon quick-action-icon--${tone}`}><Icon size={20} /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight className="quick-action-arrow" size={17} /></Link>
}
