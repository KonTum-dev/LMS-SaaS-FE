export interface RevisionedAssessmentAttempt {
  revision: number;
}

export interface AssessmentAnswerQueueState {
  error: unknown | null;
  pendingCount: number;
  saving: boolean;
}

interface AssessmentAnswerQueueOptions<TAttempt extends RevisionedAssessmentAttempt> {
  initialRevision: number;
  onSaved: (attempt: TAttempt, questionId: string, selectedChoiceIds: string[]) => void;
  onStateChange: (state: AssessmentAnswerQueueState) => void;
  save: (
    questionId: string,
    selectedChoiceIds: string[],
    expectedRevision: number,
    signal: AbortSignal,
  ) => Promise<TAttempt>;
}

const copySelection = (values: readonly string[]) => [...values];

/**
 * Serializes per-question CAS writes. A Map keeps only the newest unsent value
 * for each question while preserving writes to other questions.
 */
export class SerializedAssessmentAnswerQueue<TAttempt extends RevisionedAssessmentAttempt> {
  private readonly pending = new Map<string, string[]>();
  private readonly options: AssessmentAnswerQueueOptions<TAttempt>;
  private revision: number;
  private running: Promise<void> | null = null;
  private activeController: AbortController | null = null;
  private error: unknown | null = null;
  private disposed = false;

  constructor(options: AssessmentAnswerQueueOptions<TAttempt>) {
    this.options = options;
    this.revision = options.initialRevision;
    this.emit();
  }

  enqueue(questionId: string, selectedChoiceIds: readonly string[]): void {
    if (this.disposed) return;
    this.pending.set(questionId, copySelection(selectedChoiceIds));
    this.emit();
    if (!this.error) void this.startDrain();
  }

  hasPending(questionId?: string): boolean {
    return questionId ? this.pending.has(questionId) : this.pending.size > 0;
  }

  replacePending(values: ReadonlyMap<string, readonly string[]>): void {
    if (this.disposed) return;
    this.pending.clear();
    values.forEach((selection, questionId) => {
      this.pending.set(questionId, copySelection(selection));
    });
    this.emit();
  }

  retryFromRevision(revision: number): void {
    if (this.disposed) return;
    this.revision = revision;
    this.error = null;
    this.emit();
    void this.startDrain();
  }

  syncRevision(revision: number): void {
    if (!this.disposed) this.revision = revision;
  }

  async flush(): Promise<number> {
    while (!this.disposed) {
      if (this.error) throw this.error;
      if (this.pending.size > 0 && !this.running) void this.startDrain();
      if (this.running) await this.running;
      if (this.error) throw this.error;
      if (this.pending.size === 0) return this.revision;
    }
    throw new DOMException("Answer queue was disposed", "AbortError");
  }

  dispose(): void {
    this.disposed = true;
    this.activeController?.abort();
    this.activeController = null;
    this.pending.clear();
    this.emit();
  }

  private startDrain(): Promise<void> {
    if (this.running || this.disposed || this.error || this.pending.size === 0) {
      return this.running ?? Promise.resolve();
    }
    this.running = this.drain().finally(() => {
      this.running = null;
      this.emit();
      if (!this.disposed && !this.error && this.pending.size > 0) void this.startDrain();
    });
    this.emit();
    return this.running;
  }

  private async drain(): Promise<void> {
    while (!this.disposed && !this.error && this.pending.size > 0) {
      const next = this.pending.entries().next().value as [string, string[]] | undefined;
      if (!next) break;
      const [questionId, selectedChoiceIds] = next;
      this.pending.delete(questionId);
      const controller = new AbortController();
      this.activeController = controller;
      this.emit();
      try {
        const attempt = await this.options.save(
          questionId,
          copySelection(selectedChoiceIds),
          this.revision,
          controller.signal,
        );
        if (this.disposed) return;
        this.revision = attempt.revision;
        this.options.onSaved(attempt, questionId, copySelection(selectedChoiceIds));
      } catch (error) {
        if (this.disposed) return;
        if (!this.pending.has(questionId)) {
          this.pending.set(questionId, copySelection(selectedChoiceIds));
        }
        this.error = error;
      } finally {
        if (this.activeController === controller) this.activeController = null;
        this.emit();
      }
    }
  }

  private emit(): void {
    this.options.onStateChange({
      error: this.error,
      pendingCount: this.pending.size + (this.activeController ? 1 : 0),
      saving: Boolean(this.activeController || this.running),
    });
  }
}
