import type { ScheduleDay } from './schedule-cache'

type Metadata = Pick<ScheduleDay, 'attendance' | 'manager'>

// Slots keep their fast fallback poll. Less frequently changing day metadata
// is refreshed on events, with a bounded fallback for missed events.
export class ScheduleMetadataCache {
  private entries = new Map<string, { data: Metadata; expiresAt: number }>()
  private generation = 0

  constructor(
    private loader: (date: string, signal: AbortSignal) => Promise<Metadata>,
    private now = Date.now,
  ) {}

  async load(date: string, signal: AbortSignal): Promise<Metadata> {
    const cached = this.entries.get(date)
    if (cached && this.now() < cached.expiresAt) {
      this.entries.delete(date)
      this.entries.set(date, cached)
      return cached.data
    }
    const generation = this.generation
    const data = await this.loader(date, signal)
    // An event or date cancellation during this request must not repopulate
    // the cache with a response that predates the change.
    if (!signal.aborted && generation === this.generation) {
      this.entries.delete(date)
      this.entries.set(date, { data, expiresAt: this.now() + 30_000 })
      while (this.entries.size > 7) this.entries.delete(this.entries.keys().next().value!)
    }
    return data
  }

  invalidate() {
    ++this.generation
    this.entries.clear()
  }
}
