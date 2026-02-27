function* branchColors() {
  const colors = ["red", "green", "blue", "orange"];
  let i = 0;

  while (true) {
    yield colors[i % colors.length];
    i++;
  }
}

function repetition(gen, seconds) {
  const interval = setInterval(() => {
    console.log(gen.next().value);
  }, 500);

  setTimeout(() => {
    clearInterval(interval);
  }, seconds * 1000);
}

const gen = branchColors();
repetition(gen, 5);