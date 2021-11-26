import { GatewayDiscovery, GatewayPool } from "@vocdoni/client"

const BOOTNODE_URI = "https://bootnodes.vocdoni.net/gateways.dev.json"
const ENVIRONMENT = "dev"
const NETWORK_ID = "rinkeby"
const discoveryParams = {
  bootnodesContentUri: BOOTNODE_URI,
  networkId: NETWORK_ID as any,
  environment: ENVIRONMENT as any
}

export function getClient() {
  return GatewayDiscovery.run(discoveryParams)
    .then(result => {
      return new GatewayPool(result, discoveryParams)
    })
}
