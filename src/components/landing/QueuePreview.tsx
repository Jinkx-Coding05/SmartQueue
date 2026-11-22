import { ArrowUpRight, Clock3, UsersRound } from 'lucide-react'
import { motion } from 'framer-motion'

export function QueuePreview() {
  return (
    <motion.div
      className="queue-preview"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.15 }}
    >
      <div className="preview-topline">
        <div>
          <span className="preview-label">Today’s queue</span>
          <strong>General Medicine</strong>
        </div>
        <span className="live-badge"><span /> Queue preview</span>
      </div>

      <div className="token-panel">
        <div>
          <span className="preview-label">Your token</span>
          <strong className="token-number">A-024</strong>
        </div>
        <div className="token-status">
          <span className="status-dot" />
          Waiting in queue
        </div>
      </div>

      <div className="queue-progress" aria-label="5 people ahead in the queue">
        <div className="progress-labels"><span>Now serving <strong>A-019</strong></span><span>5 ahead</span></div>
        <div className="progress-track"><span /></div>
      </div>

      <div className="preview-metrics">
        <div className="preview-metric">
          <span className="metric-icon metric-icon--blue"><UsersRound size={17} /></span>
          <div><span>People ahead</span><strong>5</strong></div>
        </div>
        <div className="preview-metric">
          <span className="metric-icon metric-icon--green"><Clock3 size={17} /></span>
          <div><span>Estimated wait</span><strong>18 min</strong></div>
        </div>
      </div>

      <a className="preview-link" href="#how-it-works">View queue details <ArrowUpRight size={16} /></a>
    </motion.div>
  )
}
