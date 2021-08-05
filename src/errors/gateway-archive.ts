export class GatewayArchiveError extends Error {
    constructor(message?: string) {
        super(message ? message : "Archive error");
    }
}
