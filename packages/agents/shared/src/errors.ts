export class NotImplementedError extends Error {
  constructor(marker: string) {
    super(`Not implemented: ${marker}`);
    this.name = "NotImplementedError";
  }
}
