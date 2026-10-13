// Start the first write immediately; while it is running, retain only the latest
// waiting snapshot for each document. Writes never overlap within this queue.
export class LatestSaveQueue<T> {
  private pending = new Map<string, { value: T; waiters: { resolve: () => void; reject: (error: unknown) => void }[] }>()
  private running = false
  private idleWaiters: (() => void)[] = []

  constructor(private write: (value: T) => Promise<void>) {}

  enqueue(key: string, value: T): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      const waiting = this.pending.get(key)
      this.pending.set(key, { value, waiters: [...(waiting?.waiters ?? []), { resolve, reject }] })
    })
    void this.drain()
    return promise
  }

  waitForIdle(): Promise<void> {
    if (!this.running && this.pending.size === 0) return Promise.resolve()
    return new Promise(resolve => this.idleWaiters.push(resolve))
  }

  private async drain() {
    if (this.running) return
    this.running = true
    try {
      while (this.pending.size) {
        const [key, job] = this.pending.entries().next().value!
        this.pending.delete(key)
        try {
          await this.write(job.value)
          job.waiters.forEach(waiter => waiter.resolve())
        } catch (error) {
          job.waiters.forEach(waiter => waiter.reject(error))
        }
      }
    } finally {
      this.running = false
      this.idleWaiters.splice(0).forEach(resolve => resolve())
    }
  }
}
