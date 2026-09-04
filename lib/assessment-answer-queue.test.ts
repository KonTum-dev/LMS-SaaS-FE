import { describe, expect, it, vi } from "vitest";
import { SerializedAssessmentAnswerQueue } from "./assessment-answer-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, reject, resolve };
}

describe("SerializedAssessmentAnswerQueue", () => {
  it("không bao giờ chạy hai answer PUT đồng thời và nối revision canonical", async () => {
    const first = deferred<{ revision: number }>();
    const second = deferred<{ revision: number }>();
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const saved = vi.fn();
    const queue = new SerializedAssessmentAnswerQueue({
      initialRevision: 3,
      onSaved: saved,
      onStateChange: vi.fn(),
      save,
    });

    queue.enqueue("question-1", ["choice-a"]);
    queue.enqueue("question-2", ["choice-b"]);
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0].slice(0, 3)).toEqual(["question-1", ["choice-a"], 3]);

    first.resolve({ revision: 4 });
    await Promise.resolve();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1].slice(0, 3)).toEqual(["question-2", ["choice-b"], 4]);

    const flushed = queue.flush();
    second.resolve({ revision: 5 });
    await expect(flushed).resolves.toBe(5);
    expect(saved).toHaveBeenCalledTimes(2);
  });

  it("coalesce giá trị mới nhất của cùng câu khi request trước đang chạy", async () => {
    const first = deferred<{ revision: number }>();
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ revision: 3 });
    const queue = new SerializedAssessmentAnswerQueue({
      initialRevision: 1,
      onSaved: vi.fn(),
      onStateChange: vi.fn(),
      save,
    });

    queue.enqueue("question-1", ["choice-a"]);
    queue.enqueue("question-1", ["choice-b"]);
    queue.enqueue("question-1", ["choice-c"]);
    first.resolve({ revision: 2 });
    await expect(queue.flush()).resolves.toBe(3);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1].slice(0, 3)).toEqual(["question-1", ["choice-c"], 2]);
  });

  it("giữ target lỗi, chặn flush rồi retry từ revision mới", async () => {
    const conflict = new Error("ATTEMPT_REVISION_MISMATCH");
    const save = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ revision: 8 });
    const queue = new SerializedAssessmentAnswerQueue({
      initialRevision: 6,
      onSaved: vi.fn(),
      onStateChange: vi.fn(),
      save,
    });

    queue.enqueue("question-1", ["choice-a"]);
    await expect(queue.flush()).rejects.toBe(conflict);
    expect(queue.hasPending("question-1")).toBe(true);

    queue.retryFromRevision(7);
    await expect(queue.flush()).resolves.toBe(8);
    expect(save.mock.calls[1].slice(0, 3)).toEqual(["question-1", ["choice-a"], 7]);
  });

  it("replace pending giữ đúng local dirty targets sau refetch", async () => {
    const save = vi.fn().mockResolvedValue({ revision: 11 });
    const queue = new SerializedAssessmentAnswerQueue({
      initialRevision: 8,
      onSaved: vi.fn(),
      onStateChange: vi.fn(),
      save,
    });
    queue.enqueue("obsolete", ["choice-old"]);
    await Promise.resolve();
    queue.replacePending(new Map([["question-2", ["choice-new"]]]));
    queue.retryFromRevision(10);
    await queue.flush();
    expect(save.mock.calls.at(-1)?.slice(0, 3)).toEqual(["question-2", ["choice-new"], 10]);
  });

  it("dispose abort request đang chạy và không phát sinh write kế tiếp", async () => {
    let signal: AbortSignal | undefined;
    const save = vi.fn((_question, _values, _revision, currentSignal: AbortSignal) => {
      signal = currentSignal;
      return new Promise<{ revision: number }>(() => undefined);
    });
    const queue = new SerializedAssessmentAnswerQueue({
      initialRevision: 1,
      onSaved: vi.fn(),
      onStateChange: vi.fn(),
      save,
    });
    queue.enqueue("question-1", ["choice-a"]);
    await Promise.resolve();
    queue.dispose();
    expect(signal?.aborted).toBe(true);
    queue.enqueue("question-2", ["choice-b"]);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
