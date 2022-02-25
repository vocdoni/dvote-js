export class ClientNoWalletSignerError extends Error {
    constructor(message?: string) {
        super(message ? message : "The client has no wallet or signer defined");
    }
}
export class TimeoutError extends Error {
    constructor(message?: string) {
        super(message ? message : "Time out");
    }
}
