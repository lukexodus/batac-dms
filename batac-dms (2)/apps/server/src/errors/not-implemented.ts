export class NotImplementedError extends Error {
  constructor(message: string = 'Method not implemented') {
    super(message);
    this.name = 'NotImplementedError';
  }
}
