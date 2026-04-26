const createTree = document.getElementById("createTree");
createTree.addEventListener("click", () => {
  window.location.href = "createTree.html";
});

const treeList = document.getElementById("treeList");
treeList.addEventListener("click", () => {
  window.location.href = "./treeList.html";
});

const signIn = document.getElementById("signIn");
signIn.addEventListener("click", () => {          // ← was: treeList
  window.location.href = "./signIn.html";
});

const seatings = document.getElementById("seatings");
seatings.addEventListener("click", () => {        // ← was: treeList
  window.location.href = "./seatings.html";
});