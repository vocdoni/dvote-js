export class GatewayDiscoveryError extends Error {

    public static BOOTNODE_FETCH_ERROR: string = "Could not fetch the bootnode details"
    public static NO_CANDIDATES_READY: string = "None of the candidates is ready"
    public static NO_WORKING_GATEWAYS: string = "No working gateway found"

    constructor(message: string) {
        super(message);
    }
}

export class GatewayDiscoveryValidationError extends GatewayDiscoveryError {

    public static INVALID_NETWORK_ID: string = "Invalid network ID"
    public static INVALID_ENVIRONMENT: string = "Invalid environment"
    public static INVALID_BOOTNODE_URI: string = "Invalid bootnode URI"
    public static INVALID_NUMBER_GATEWAYS: string = "Invalid number of gateways"
    public static INVALID_TIMEOUT: string = "Invalid timeout"

    constructor(message?: string) {
        super(message ? "Invalid parameters: " + message : "Invalid parameters");
    }
}
