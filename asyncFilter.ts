type NodeCallback<T> = (error: Error | null, result?: T) => void;

type AsyncPredicate<T> = (
  item: T,
  index: number,
  array: T[],
  signal?: AbortSignal
) => Promise<boolean>;

type CallbackPredicate<T> = (
  item: T,
  index: number,
  done: (error: Error | null, keep: boolean) => void
) => void;

export class AsyncFilterAbortError extends Error {
  constructor(message = "asyncFilter: operation was aborted") {
    super(message);
    this.name = "AsyncFilterAbortError";
  }
}

export function filterCallback<T>(
  array: T[],
  predicate: CallbackPredicate<T>,
  done: NodeCallback<T[]>
): void {
  const result: T[] = [];
  let index = 0;

  function processNext(): void {
    if (index === array.length) {
      done(null, result);
      return;
    }

    const currentIndex = index++;
    const item = array[currentIndex];

    predicate(item, currentIndex, (err, keep) => {
      if (err) {
        done(err);
        return;
      }
      if (keep) result.push(item);
      processNext();
    });
  }

  if (array.length === 0) {
    done(null, []);
    return;
  }

  processNext();
}

export async function filterPromise<T>(
  array: T[],
  predicate: AsyncPredicate<T>,
  options: { signal?: AbortSignal; sequential?: boolean } = {}
): Promise<T[]> {
  const { signal, sequential = false } = options;

  if (signal?.aborted) {
    throw new AsyncFilterAbortError();
  }

  if (sequential) {
    return _filterSequential(array, predicate, signal);
  }

  return _filterConcurrent(array, predicate, signal);
}

async function _filterConcurrent<T>(
  array: T[],
  predicate: AsyncPredicate<T>,
  signal?: AbortSignal
): Promise<T[]> {
  const flags = await Promise.all(
    array.map((item, i) => {
      if (signal?.aborted) throw new AsyncFilterAbortError();
      return predicate(item, i, array, signal);
    })
  );

  if (signal?.aborted) throw new AsyncFilterAbortError();

  return array.filter((_, i) => flags[i]);
}

async function _filterSequential<T>(
  array: T[],
  predicate: AsyncPredicate<T>,
  signal?: AbortSignal
): Promise<T[]> {
  const result: T[] = [];

  for (let i = 0; i < array.length; i++) {
    if (signal?.aborted) throw new AsyncFilterAbortError();

    const keep = await predicate(array[i], i, array, signal);

    if (signal?.aborted) throw new AsyncFilterAbortError();

    if (keep) result.push(array[i]);
  }

  return result;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AsyncFilterAbortError());

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new AsyncFilterAbortError());
    });
  });
}

export interface Person {
  id: string;
  name: string;
  birthYear: number;
  isAlive: boolean;
  photoUrl?: string;
}

async function fetchHasRecord(person: Person, signal?: AbortSignal): Promise<boolean> {
  await delay(30, signal);
  return person.birthYear < 1950;
}

async function fetchIsVerifiedLiving(person: Person, signal?: AbortSignal): Promise<boolean> {
  await delay(20, signal);
  return person.isAlive;
}

async function fetchHasPhoto(person: Person, signal?: AbortSignal): Promise<boolean> {
  await delay(10, signal);
  return Boolean(person.photoUrl);
}

export const samplePersons: Person[] = [
  { id: "p1", name: "Іван Шевченко",    birthYear: 1920, isAlive: false, photoUrl: "/photos/p1.jpg" },
  { id: "p2", name: "Марія Бондаренко", birthYear: 1945, isAlive: false },
  { id: "p3", name: "Олег Кравченко",   birthYear: 1968, isAlive: true,  photoUrl: "/photos/p3.jpg" },
  { id: "p4", name: "Оксана Мельник",   birthYear: 1995, isAlive: true },
  { id: "p5", name: "Петро Гончаренко", birthYear: 1938, isAlive: false, photoUrl: "/photos/p5.jpg" },
];

export async function exampleA_filterWithRecords(): Promise<void> {
  console.group("Example A — filter ancestors with archival records (concurrent)");

  const result = await filterPromise(
    samplePersons,
    (person, _i, _arr, signal) => fetchHasRecord(person, signal)
  );

  console.log(result.map((p) => p.name));
  console.groupEnd();
}

export async function exampleB_abortable(): Promise<void> {
  console.group("Example B — living relatives, sequential, aborted after 50 ms");

  const controller = new AbortController();

  setTimeout(() => controller.abort(), 50);

  try {
    const result = await filterPromise(
      samplePersons,
      (person, _i, _arr, signal) => fetchIsVerifiedLiving(person, signal),
      { signal: controller.signal, sequential: true }
    );
    console.log("Living relatives:", result.map((p) => p.name));
  } catch (err) {
    if (err instanceof AsyncFilterAbortError) {
      console.warn("Filter was cancelled — user navigated away.");
    } else {
      throw err;
    }
  }

  console.groupEnd();
}

export async function exampleC_promiseChaining(): Promise<void> {
  console.group("Example C — persons with photos (Promise chaining)");

  filterPromise(
    samplePersons,
    (p, _i, _arr, signal) => fetchHasPhoto(p, signal)
  )
    .then((withPhotos) => {
      console.log(
        "With photos:",
        withPhotos.map((p) => p.name)
      );
    })
    .catch(console.error);

  console.groupEnd();
}

export function exampleD_callbackVersion(): void {
  console.group("Example D — callback version (legacy API integration)");

  filterCallback(
    samplePersons,
    (person, _i, next) => {
      setTimeout(() => {
        next(null, person.birthYear < 1960);
      }, 20);
    },
    (err, result) => {
      if (err) { console.error(err); return; }
      console.log(
        "Born before 1960:",
        result!.map((p) => p.name)
      );
      console.groupEnd();
    }
  );
}

export async function runAllExamples(): Promise<void> {
  await exampleA_filterWithRecords();
  await exampleB_abortable();
  await exampleC_promiseChaining();
  exampleD_callbackVersion();
}