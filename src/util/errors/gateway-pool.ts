export class GatewayPoolError extends Error {

    public static OPERATION_CANNOT_COMPLETE: string = "The operation cannot be completed"
    public static NO_DVOTE_CLIENTS: string = "The pool has no Dvote clients"
    public static NO_WEB3_CLIENTS: string = "The pool has no Web3 clients"
    public static SEQUENTIAL_METHOD_ERROR: string = "Connection to gateway lost. The process needs to be restarted. Reason: "

    constructor(message: string) {
        super(message);
    }
}
