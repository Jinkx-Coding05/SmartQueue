import { ArrowRight, Construction } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'

const sectionNames: Record<string, string> = {
  '/citizen/book-token': 'Token booking',
  '/citizen/appointments': 'Appointments',
  '/citizen/documents': 'Documents',
  '/citizen/profile': 'Profile',
  '/public-statistics': 'Public statistics',
}

export function CitizenSectionPlaceholderPage() {
  const { pathname } = useLocation()
  const sectionName = sectionNames[pathname] ?? 'This section'
  return <DashboardLayout><section className="dashboard-placeholder"><span className="not-found-icon"><Construction size={27} /></span><p className="dashboard-kicker">NEXT MILESTONE</p><h1>{sectionName} is coming next.</h1><p>This navigation is connected and ready. The full {sectionName.toLowerCase()} experience will be implemented in a later milestone.</p><Link className="button button--primary" to="/citizen/dashboard">Back to overview <ArrowRight size={17} /></Link></section></DashboardLayout>
}
