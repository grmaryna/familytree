function* findByName(person, name) {
  if (person.name === name) {
    yield person; 
  }

  if (person.children) {
    for (const child of person.children) {
      yield* findByName(child, name);
    }
  }
}
