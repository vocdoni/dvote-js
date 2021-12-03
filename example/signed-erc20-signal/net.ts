import { DVoteGateway, GatewayPool, IGatewayDiscoveryParameters } from "@vocdoni/client"
import { EthNetworkID } from "@vocdoni/common"
import { getConfig } from "./config"

const config = getConfig()

export async function connectGateways(): Promise<GatewayPool> {
    console.log("Connecting to the gateways")
    const options: IGatewayDiscoveryParameters = {
        networkId: config.ethNetworkId as EthNetworkID,
        environment: config.vocdoniEnvironment,
        bootnodesContentUri: config.bootnodesUrlRw,
        // numberOfGateways: 2,
        // timeout: 10000,
    }
    const pool = await GatewayPool.discover(options)

    console.log("Connected to", pool.dvoteUri)
    console.log("Connected to", pool.provider["connection"].url)

    return pool
}

export async function getOracleClient() {
    const oracleClient = new DVoteGateway({
        uri: config.oracleUri,
        supportedApis: ["oracle"]
    })
    await oracleClient.init()

    console.log("Connected to", config.oracleUri)
    return oracleClient
}