
export type AccessMode = "highest" | "lowest" | "oldest" | "newest";
 
interface Entry<T> {
  item: T;
  priority: number;
  insertionOrder: number;
}

type Comparator<T> = (a: Entry<T>, b: Entry<T>) => number;
 
function byHighestPriority<T>(a: Entry<T>, b: Entry<T>): number {
  return b.priority - a.priority || a.insertionOrder - b.insertionOrder;
}
 
function byLowestPriority<T>(a: Entry<T>, b: Entry<T>): number {
  return a.priority - b.priority || a.insertionOrder - b.insertionOrder;
}
 
function byOldest<T>(a: Entry<T>, b: Entry<T>): number {
  return a.insertionOrder - b.insertionOrder;
}
 
function byNewest<T>(a: Entry<T>, b: Entry<T>): number {
  return b.insertionOrder - a.insertionOrder;
}
 
class BinaryHeap<T> {
  private heap: Entry<T>[] = [];
  private readonly cmp: Comparator<T>;
 
  constructor(cmp: Comparator<T>) {
    this.cmp = cmp;
  }
 
  get size(): number {
    return this.heap.length;
  }
 
  push(entry: Entry<T>): void {
    this.heap.push(entry);
    this._bubbleUp(this.heap.length - 1);
  }
 
  pop(): Entry<T> | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
peek(): Entry<T> | undefined {
    return this.heap[0];
  }
 
  remove(insertionOrder: number): boolean {
    const idx = this.heap.findIndex(
      (e) => e.insertionOrder === insertionOrder
    );
    if (idx === -1) return false;
    const last = this.heap.pop()!;
    if (idx < this.heap.length) {
      this.heap[idx] = last;
      this._bubbleUp(idx);
      this._sinkDown(idx);
    }
    return true;
  }
 
  toSortedArray(): Entry<T>[] {
    return [...this.heap].sort(this.cmp);
  }
 
  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.cmp(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }
 
  private _sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let best = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.cmp(this.heap[l], this.heap[best]) < 0) best = l;
      if (r < n && this.cmp(this.heap[r], this.heap[best]) < 0) best = r;
      if (best === i) break;
      [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]];
      i = best;
    }
  }
}
 
export class priorityQueue<T> {
  private readonly heaps: Record<AccessMode, BinaryHeap<T>>;
  private readonly live = new Set<number>(); // active insertionOrders
  private counter = 0;
 
  constructor() {
    this.heaps = {
      highest: new BinaryHeap(byHighestPriority),
      lowest: new BinaryHeap(byLowestPriority),
      oldest: new BinaryHeap(byOldest),
      newest: new BinaryHeap(byNewest),
    };
  }
 
  get size(): number {
    return this.live.size;
  }
 
  get isEmpty(): boolean {
    return this.live.size === 0;
  }
 
  enqueue(item: T, priority: number): void {
    const entry: Entry<T> = {
      item,
      priority,
      insertionOrder: this.counter++,
    };
    this.live.add(entry.insertionOrder);
    for (const heap of Object.values(this.heaps)) {
      heap.push(entry);
    }
  }
 
  dequeue(mode: AccessMode): T | undefined {
    return this._extract(mode, true);
  }

  peek(mode: AccessMode): T | undefined {
    return this._extract(mode, false);
  }
 
  clear(): void {
    this.live.clear();
    for (const heap of Object.values(this.heaps)) {
      (heap as any).heap = []; // reset internal array
    }
  }
 
  toArray(mode: AccessMode): T[] {
    const cmpFn: Record<AccessMode, Comparator<T>> = {
      highest: byHighestPriority,
      lowest: byLowestPriority,
      oldest: byOldest,
      newest: byNewest,
    };
    return this.heaps[mode]
      .toSortedArray()
      .filter((e) => this.live.has(e.insertionOrder))
      .sort(cmpFn[mode])
      .map((e) => e.item);
  }
 
  private _extract(mode: AccessMode, remove: boolean): T | undefined {
    const heap = this.heaps[mode];
 
    while (heap.size > 0 && !this.live.has(heap.peek()!.insertionOrder)) {
      heap.pop();
    }
 
    if (heap.size === 0) return undefined;
 
    if (!remove) return heap.peek()!.item;
 
    const entry = heap.pop()!;
    this.live.delete(entry.insertionOrder);
    return entry.item;
  }
}