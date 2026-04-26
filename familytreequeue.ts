import {
  BiDirectionalPriorityQueue,
  type AccessMode,
} from "./bidirectionalpriorityqueue";

export const TaskPriority = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
  BACKGROUND: 5,
} as const;

export type TaskPriorityLevel =
  (typeof TaskPriority)[keyof typeof TaskPriority];

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
  label: string;
  priority: TaskPriorityLevel;
  payload?: unknown;
  execute: () => Promise<void> | void;
}

export class FamilyTreeTaskScheduler {
  private readonly queue =
    new BiDirectionalPriorityQueue<FamilyTreeTask>();
  private running = false;
  private processedCount = 0;

  schedule(task: FamilyTreeTask): void {
    this.queue.enqueue(task, task.priority);
    if (!this.running) {
      this.running = true;
      this._tick();
    }
  }

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

  scheduleSave(
    personId: string,
    label: string,
    execute: () => Promise<void>
  ): void {
    this.schedule({
      id: `save:${personId}`,
      type: "savePerson",
      label,
      priority: TaskPriority.HIGH,
      execute,
    });
  }

  scheduleUndo(label: string, execute: () => void): void {
    this.schedule({
      id: `undo:${Date.now()}`,
      type: "undoAction",
      label,
      priority: TaskPriority.CRITICAL,
      execute,
    });
  }

  get pendingCount(): number {
    return this.queue.size;
  }

  peekNext(mode: AccessMode = "highest"): FamilyTreeTask | undefined {
    return this.queue.peek(mode);
  }

  listPending(mode: AccessMode = "highest"): FamilyTreeTask[] {
    return this.queue.toArray(mode);
  }

  async flushAll(): Promise<void> {
    while (!this.queue.isEmpty) {
      const task = this.queue.dequeue("highest");
      if (task) {
        try {
          await task.execute();
        } catch {}
        this.processedCount++;
      }
    }
  }

  private async _tick(): Promise<void> {
    while (!this.queue.isEmpty) {
      const task = this.queue.dequeue("highest");
      if (!task) break;

      try {
        await task.execute();
      } catch (err) {
        console.error(
          `[FamilyTreeQueue] Task "${task.label}" failed:`,
          err
        );
      }

      this.processedCount++;

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
    }

    this.running = false;
  }
}

export const taskScheduler = new FamilyTreeTaskScheduler();

const isDev =
  typeof process !== "undefined" &&
  process.env?.NODE_ENV === "development";

if (isDev) {
  taskScheduler.scheduleRender(
    "person-001",
    "Render: Іван Шевченко",
    true,
    () => console.log("[render] Іван Шевченко")
  );

  taskScheduler.schedule({
    id: "photo:person-042",
    type: "loadPhoto",
    label: "Load photo: Оксана Ковальчук",
    priority: TaskPriority.BACKGROUND,
    execute: () => console.log("[photo] loading..."),
  });

  taskScheduler.scheduleSave(
    "person-099",
    "Save: Марія Бондаренко",
    async () =>
      console.log("[save] Марія Бондаренко persisted")
  );

  taskScheduler.scheduleUndo(
    "Undo: delete Петро Гончаренко",
    () => console.log("[undo] restored Петро Гончаренко")
  );

  console.log(
    "[FamilyTreeQueue] pending tasks:",
    taskScheduler
      .listPending("highest")
      .map((t) => `${t.label} (p=${t.priority})`)
  );
}