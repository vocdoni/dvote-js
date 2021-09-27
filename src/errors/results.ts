export class ResultsNotAvailableError extends Error {
  constructor(message?: string) {
    super(message ? message : "The results are not available");
  }
}
