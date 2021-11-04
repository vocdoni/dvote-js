export class GatewayDiscoveryError extends Error {

    public static BOOTNODE_FETCH_ERROR: string = "Could not fetch the bootnode details"
    public static BOOTNODE_TIMEOUT_ERROR: string = "Timeout fetching the bootnode details"
    public static BOOTNODE_NOT_ENOUGH_GATEWAYS: string = "Not enough gateways found in the bootnode"
    public static NO_CANDIDATES_READY: string = "None of the candidates is ready"

    constructor(message?: string) {
        super(message ? message : "No working gateways found");
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
