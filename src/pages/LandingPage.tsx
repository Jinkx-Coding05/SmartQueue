import {
  BellRing,
  CalendarCheck2,
  Check,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  HeartPulse,
  Lightbulb,
  MapPin,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  TrendingDown,
  UsersRound,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../components/common/BrandLogo'
import { SectionHeading } from '../components/common/SectionHeading'
import { FeatureCard } from '../components/landing/FeatureCard'
import { LandingNav } from '../components/landing/LandingNav'
import { QueuePreview } from '../components/landing/QueuePreview'

const steps = [
  { number: '01', icon: MapPin, title: 'Choose Your Service', text: 'Find a nearby hospital or public service center and choose the help you need.' },
  { number: '02', icon: TicketCheck, title: 'Book Your Token', text: 'Select a convenient time and receive a digital token in just a few taps.' },
  { number: '03', icon: MonitorCheck, title: 'Track Your Queue', text: 'Follow your position and get a clear estimate of when you will be served.' },
  { number: '04', icon: HeartPulse, title: 'Visit at the Right Time', text: 'Arrive prepared and close to your turn, without spending hours waiting.' },
]

const features = [
  { icon: TicketCheck, title: 'Smart Token Generation', description: 'Get a digital place in line without standing in a crowded queue.', tone: 'blue' as const },
  { icon: UsersRound, title: 'Live Queue Tracking', description: 'Know your position and plan your visit with timely queue updates.', tone: 'green' as const },
  { icon: Sparkles, title: 'AI Waiting-Time Prediction', description: 'Use helpful estimates to make better decisions about your day.', tone: 'purple' as const },
  { icon: FileCheck2, title: 'Document Assistant', description: 'See what to bring before your appointment so your visit stays smooth.', tone: 'orange' as const },
  { icon: CalendarCheck2, title: 'Appointment Management', description: 'Keep upcoming visits, services and times organized in one place.', tone: 'blue' as const },
  { icon: BellRing, title: 'Accessible Notifications', description: 'Receive clear updates designed for citizens of every age and ability.', tone: 'green' as const },
]

const waitTimes = [
  { name: 'City General Hospital', service: 'Outpatient Department', wait: '18 min', progress: 38 },
  { name: 'Civic Services Center', service: 'Citizen Help Desk', wait: '12 min', progress: 25 },
  { name: 'Community Health Hub', service: 'Vaccination Clinic', wait: '24 min', progress: 52 },
]

export function LandingPage() {
  return (
    <div className="landing-page">
      <LandingNav />

      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <motion.div className="hero-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <span className="hero-badge"><span className="badge-dot" /> AI-Powered Queue Management</span>
              <h1>Skip the Queue.<br /><span>Save Your Time.</span></h1>
              <p className="hero-description">SmartQueue AI helps you book service tokens, track your place in line and arrive when it matters — so public services work better for everyone.</p>
              <div className="hero-actions">
                <Link className="button button--primary" to="/login">Book Your Token <span aria-hidden="true">→</span></Link>
                <a className="button button--secondary" href="#how-it-works"><span className="play-icon" aria-hidden="true">▶</span> How It Works</a>
              </div>
              <div className="hero-note"><ShieldCheck size={17} /> Simple, secure and made for citizens</div>
            </motion.div>

            <div className="hero-visual">
              <div className="visual-orb visual-orb--one" aria-hidden="true" />
              <div className="visual-orb visual-orb--two" aria-hidden="true" />
              <QueuePreview />
              <div className="floating-card floating-card--top"><span className="floating-icon"><Check size={15} /></span><span><strong>Token confirmed</strong><small>Ready when you are</small></span></div>
              <div className="floating-card floating-card--bottom"><span className="floating-icon floating-icon--green"><Clock3 size={15} /></span><span><strong>18 min</strong><small>Estimated wait time</small></span></div>
            </div>
          </div>
        </section>

        <section className="trust-section" aria-label="Illustrative platform statistics">
          <div className="container trust-row">
            <p className="trust-intro">Helping communities<br /><strong>move forward</strong></p>
            <div className="trust-stat"><strong>50<span>+</span></strong><span>Service Centers</span></div>
            <div className="trust-stat"><strong>12,000<span>+</span></strong><span>Tokens Managed</span></div>
            <div className="trust-stat"><strong>30<span>%</span></strong><span>Less Average Waiting</span></div>
          </div>
          <p className="demo-note">Illustrative sample figures; live service-center connections are not configured.</p>
        </section>

        <section className="section section--steps" id="how-it-works">
          <div className="container">
            <SectionHeading eyebrow="HOW IT WORKS" title="A better way to wait" description="From booking to arrival, SmartQueue AI keeps every step clear and simple." />
            <div className="steps-grid">
              {steps.map(({ number, icon: Icon, title, text }) => (
                <article className="step-card" key={number}>
                  <div className="step-topline"><span className="step-number">{number}</span><Icon size={25} strokeWidth={1.8} /></div>
                  <h3>{title}</h3><p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--features" id="features">
          <div className="container">
            <SectionHeading eyebrow="BUILT AROUND YOU" title="Everything you need for a smoother visit" description="Thoughtful tools for citizens, staff and the public service teams that support them." />
            <div className="features-grid">{features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}</div>
          </div>
        </section>

        <section className="benefits-section">
          <div className="container benefits-grid">
            <div className="benefits-art" aria-hidden="true"><div className="benefits-circle"><HeartPulse size={36} /></div><div className="benefit-mini benefit-mini--one"><TrendingDown size={17} /> Less waiting</div><div className="benefit-mini benefit-mini--two"><Lightbulb size={17} /> Better planning</div></div>
            <div className="benefits-copy"><p className="eyebrow">WHY SMARTQUEUE AI</p><h2>Your time matters more than a waiting room.</h2><p>Public services should be accessible, predictable and respectful of your day. SmartQueue AI gives citizens visibility while helping service centers work with less congestion.</p><ul><li><span><Check size={15} /></span> Spend less time waiting in crowded spaces</li><li><span><Check size={15} /></span> Plan visits around your real schedule</li><li><span><Check size={15} /></span> Help centers serve people more efficiently</li></ul><a className="text-link" href="#final-cta">See how it works <span aria-hidden="true">→</span></a></div>
          </div>
        </section>

        <section className="section stats-section" id="public-statistics">
          <div className="container">
            <div className="stats-heading-row"><SectionHeading align="left" eyebrow="PUBLIC TRANSPARENCY" title="Know before you go" description="Preview example waiting-time displays. Live service-center connections are not configured." /><Link className="text-link stats-link" to="/public-statistics">View all statistics <span aria-hidden="true">→</span></Link></div>
            <div className="wait-times-card">
              <div className="wait-times-header"><span>Service center</span><span>Current wait</span></div>
              {waitTimes.map((item) => <div className="wait-time-row" key={item.name}><div className="service-name"><span className="service-icon"><ClipboardCheck size={17} /></span><span><strong>{item.name}</strong><small>{item.service}</small></span></div><div className="wait-progress"><div className="wait-track"><span style={{ width: `${item.progress}%` }} /></div><strong>{item.wait}</strong></div></div>)}
              <div className="wait-times-footer"><span><span className="legend-dot" /> Queue preview data</span><span>Updated a few minutes ago</span></div>
            </div>
          </div>
        </section>

        <section className="final-cta" id="final-cta">
          <div className="container final-cta-inner"><div><p className="eyebrow">A LITTLE LESS WAITING. A LOT MORE LIVING.</p><h2>Your Time Matters.<br /><span>Start with SmartQueue AI.</span></h2></div><Link className="button button--white" to="/register">Get Started <span aria-hidden="true">→</span></Link></div>
        </section>
      </main>

      <footer className="site-footer" id="footer">
        <div className="container footer-grid"><div className="footer-brand"><BrandLogo /><p>Making public services simpler, one queue at a time.</p></div><div className="footer-links"><div><h3>Explore</h3><a href="#how-it-works">How It Works</a><a href="#features">Features</a><a href="#public-statistics">Public Statistics</a></div><div><h3>Company</h3><a href="#top">About SmartQueue</a><a href="#final-cta">Contact</a><a href="#final-cta">Help Center</a></div><div><h3>Legal</h3><a href="#final-cta">Privacy Policy</a><a href="#final-cta">Terms & Conditions</a></div></div></div>
        <div className="container footer-bottom"><span>© 2026 SmartQueue AI. Built for better public services.</span><span>Service-center preview figures are illustrative; signed-in workflows use the API.</span></div>
      </footer>
    </div>
  )
}
