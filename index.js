
import { branchColors, repetition } from "color-library";
import { memoize } from "./memoize.js";

const memoizedBranchColors = memoize(branchColors, {
  policy: "lru",
  maxSize: 20,
});

const memoizedRepetition = memoize(repetition, {
  policy: "lfu",
  maxSize: 50,
  keySerializer: (palette, count) =>
    `${JSON.stringify(palette?.id ?? palette)}_${count}`,
});

const gen1 = memoizedBranchColors();
memoizedRepetition(gen1, 5);

const gen2 = memoizedBranchColors();
memoizedRepetition(gen2, 10);

if (import.meta.env?.DEV) {
  console.group("[FamilyTree] Memoization stats");
  console.log("branchColors:", memoizedBranchColors.stats);
  console.log("repetition  :", memoizedRepetition.stats);
  console.groupEnd();
}

export { memoizedBranchColors, memoizedRepetition, gen1, gen2 };