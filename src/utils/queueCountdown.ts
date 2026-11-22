export function remainingQueueMinutes(estimatedArrivalAt: string | null, now = Date.now()): number | null {
  if (!estimatedArrivalAt) return null
  const target = new Date(estimatedArrivalAt).getTime()
  if (!Number.isFinite(target)) return null
  return Math.max(0, Math.ceil((target - now) / 60000))
}
