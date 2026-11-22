import type { LucideIcon } from 'lucide-react'

type FeatureCardProps = {
  icon: LucideIcon
  title: string
  description: string
  tone: 'blue' | 'green' | 'orange' | 'purple'
}

export function FeatureCard({ icon: Icon, title, description, tone }: FeatureCardProps) {
  return (
    <article className="feature-card">
      <span className={`feature-icon feature-icon--${tone}`}><Icon size={21} strokeWidth={2} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      <a href="#final-cta" aria-label={`Learn more about ${title}`}>Learn more <span aria-hidden="true">→</span></a>
    </article>
  )
}
