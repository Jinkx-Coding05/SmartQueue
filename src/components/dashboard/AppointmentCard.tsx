import { ArrowUpRight, CalendarDays, CheckCircle2, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

type Appointment = { department: string; date: string; time: string; center: string; status: string }

export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  return <article className="appointment-card"><div className="appointment-icon"><CalendarDays size={19} /></div><div className="appointment-info"><div className="appointment-title"><h3>{appointment.department}</h3><span className={`appointment-status appointment-status--${appointment.status.toLowerCase()}`}>{appointment.status === 'Cancelled' ? null : <CheckCircle2 size={13} />} {appointment.status}</span></div><p><CalendarDays size={14} /> {appointment.date} · {appointment.time}</p><p><MapPin size={14} /> {appointment.center}</p></div><Link className="icon-action" to="/citizen/appointments" aria-label={`View details for ${appointment.department}`}><ArrowUpRight size={17} /></Link></article>
}
