const OPEN_ADD_CREATOR = "open-add-creator";

export function emitOpenAddCreator() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_ADD_CREATOR));
  }
}

export { OPEN_ADD_CREATOR };
