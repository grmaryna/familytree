
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
    
  }
}
 
