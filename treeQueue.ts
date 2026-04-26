import {
  BiDirectionalPriorityQueue,
  type AccessMode,
} from "./priorityQueue.ts";

export const TaskPriority = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
  BACKGROUND: 5,
} as const;

export type TaskPriorityLevel = (typeof TaskPriority)[keyof typeof TaskPriority];

export type TaskType =
  | "renderNode"
  | "savePerson"
  | "deletePerson"
  | "fetchRecord"
  | "loadPhoto"
  | "undoAction"
  | "redoAction"
  | "searchAncestors";

export interface FamilyTreeTask {
  id: string;
  type: TaskType;
  label: string;           // human-readable description for the UI
  priority: TaskPriorityLevel;
  payload?: unknown;       // arbitrary data the handler needs
  execute: () => Promise<void> | void;
}

// ─── Task Scheduler ───────────────────────────────────────────────────────────

export class FamilyTreeTaskScheduler {
  private readonly queue = new BiDirectionalPriorityQueue<FamilyTreeTask>();
  private running = false;
  private processedCount = 0;

  // ── Enqueue helpers ──────────────────────────────────────────────────────

  /** Enqueue any task with an explicit priority level. */
  schedule(task: FamilyTreeTask): void {
    this.queue.enqueue(task, task.priority);
    if (!this.running) this._tick();
  }

  /**
   * Enqueue a "render node" task.
   * Nodes currently visible on screen get HIGH priority; distant ancestors LOW.
   */
  scheduleRender(
    personId: string,
    label: string,
    isVisible: boolean,
    execute: () => void
  ): void {
    this.schedule({
      id: `render:${personId}`,
      type: "renderNode",
      label,
      priority: isVisible ? TaskPriority.HIGH : TaskPriority.LOW,
      execute,
    });
  }

  /**
   * Enqueue a save operation.
   * Always HIGH priority — data loss risk if dropped.
   */
  scheduleSave(personId: string, label: string, execute: () => Promise<void>): void {
    this.schedule({
      id: `save:${personId}`,
      type: "savePerson",
      label,
      priority: TaskPriority.HIGH,
      execute,
    });
  }

  /**
   * Enqueue an undo action.
   * CRITICAL priority — must run before any subsequent write.
   * Uses "newest" dequeue so the most recent undo is always processed first (LIFO).
   */
  scheduleUndo(label: string, execute: () => void): void {
    this.schedule({
      id: `undo:${Date.now()}`,
      type: "undoAction",
      label,
      priority: TaskPriority.CRITICAL,
      execute,
    });
  }

  // ── Introspection ────────────────────────────────────────────────────────

  get pendingCount(): number {
    return this.queue.size;
  }

  /** Preview next task by a given mode without mutating the queue. */
  peekNext(mode: AccessMode = "highest"): FamilyTreeTask | undefined {
    return this.queue.peek(mode);
  }

  /** All pending tasks sorted by the given mode. */
  listPending(mode: AccessMode = "highest"): FamilyTreeTask[] {
    return this.queue.toArray(mode);
  }

  /** Drain the queue immediately (e.g. on page unload — flush all saves). */
  async flushAll(): Promise<void> {
    while (!this.queue.isEmpty) {
      const task = this.queue.dequeue("highest");
      if (task) {
        try { await task.execute(); } catch { /* log in prod */ }
        this.processedCount++;
      }
    }
  }

  // ── Internal tick loop ───────────────────────────────────────────────────

  /**
   * Runs one task per animation frame so the browser stays responsive.
   * Undo tasks use LIFO ("newest"); all others use priority ("highest").
   */
  private async _tick(): Promise<void> {
    this.running = true;

    while (!this.queue.isEmpty) {
      // Peek: if the top task is an undo, dequeue newest (LIFO); else highest.
      const next = this.queue.peek("highest");
      const mode: AccessMode =
        next?.type === "undoAction" || next?.type === "redoAction"
          ? "newest"
          : "highest";

      const task = this.queue.dequeue(mode);
      if (!task) break;

      try {
        await task.execute();
      } catch (err) {
        console.error(`[FamilyTreeQueue] Task "${task.label}" failed:`, err);
      }

      this.processedCount++;

      // Yield to the browser between tasks.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    this.running = false;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const taskScheduler = new FamilyTreeTaskScheduler();

// ─── Usage examples (dev-only) ────────────────────────────────────────────────

if (import.meta.env?.DEV) {
  // Render grandparent node (visible on screen)
  taskScheduler.scheduleRender(
    "person-001",
    "Render: Іван Шевченко",
    true,
    () => console.log("[render] Іван Шевченко")
  );

  // Load a background photo (low priority)
  taskScheduler.schedule({
    id: "photo:person-042",
    type: "loadPhoto",
    label: "Load photo: Оксана Ковальчук",
    priority: TaskPriority.BACKGROUND,
    execute: () => console.log("[photo] loading..."),
  });

  // Save a newly added person (high priority)
  taskScheduler.scheduleSave(
    "person-099",
    "Save: Марія Бондаренко",
    async () => console.log("[save] Марія Бондаренко persisted")
  );

  // Undo last deletion (critical, LIFO)
  taskScheduler.scheduleUndo(
    "Undo: delete Петро Гончаренко",
    () => console.log("[undo] restored Петро Гончаренко")
  );

  console.log(
    "[FamilyTreeQueue] pending tasks:",
    taskScheduler.listPending("highest").map((t) => `${t.label} (p=${t.priority})`)
  );
}