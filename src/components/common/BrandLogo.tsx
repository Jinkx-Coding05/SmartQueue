import { Activity } from 'lucide-react'
import { Link } from 'react-router-dom'

type BrandLogoProps = {
  compact?: boolean
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <Link className="brand-logo" to="/" aria-label="SmartQueue AI home">
      <span className="brand-mark" aria-hidden="true">
        <Activity size={20} strokeWidth={2.6} />
      </span>
      {!compact && (
        <span className="brand-copy">
          SmartQueue <strong>AI</strong>
        </span>
      )}
    </Link>
  )
}
