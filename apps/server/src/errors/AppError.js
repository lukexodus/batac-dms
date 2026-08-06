export class AppError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
        // Maintain correct prototype chain after TypeScript transpilation
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
