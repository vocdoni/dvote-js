export class GatewayArchiveError extends Error {
    constructor(message?: string) {
        super(message ? message : "Fetching archive data failed");
    }
}
