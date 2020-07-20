import { utils } from "ethers"

export const ipfsGatewayListUri = "https://ipfs.github.io/public-gateway-checker/gateways.json"

export const entityResolverEnsDomain = "entity-resolver.vocdoni.eth"
export const votingProcessEnsDomain = "voting-process.vocdoni.eth"

export const vocdoniMainnetEntityId = "0x0"
export const vocdoniGoerliEntityId = "0x180dd5765d9f7ecef810b565a2e5bd14a3ccd536c442b3de74867df552855e85"
export const vocdoniXDaiEntityId = "0x8469d886788116e18b82d6566d951c77bc0b19ef7b6b837b725b667addeef6b5"

export const XDAI_CHAIN_ID = 100
export const XDAI_PROVIDER_URI = "https://dai.poa.network"
export const XDAI_GAS_PRICE = utils.parseUnits("1", "gwei")
export const XDAI_ENS_REGISTRY_ADDRESS = "0x00cEBf9E1E81D3CC17fbA0a49306EBA77a8F26cD"

// export const SIGNATURE_TIMESTAMP_TOLERANCE = 60 * 8 // +/- 8 minutes
export const VOCHAIN_BLOCK_TIME = 10 // seconds
export const CENSUS_MAX_BULK_SIZE = 400 // # of claims per addClaimBulk request
export const GATEWAY_SELECTION_TIMEOUT = 10000  // milliseconds
