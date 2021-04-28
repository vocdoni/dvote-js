import { utils } from "ethers"

export const ipfsGatewayListUri = "https://ipfs.github.io/public-gateway-checker/gateways.json"

export const productionEnsDomainSuffix = ".vocdoni.eth"
export const stagingEnsDomainSuffix = ".stg.vocdoni.eth"
export const developmentEnsDomainSuffix = ".dev.vocdoni.eth"

export const publicResolverEnsSubdomain = "entities"
export const genesisEnsSubdomain = "genesis"
export const namespacesEnsSubdomain = "namespaces"
export const processesEnsSubdomain = "processes"
export const resultsEnsSubdomain = "results"
export const erc20StorageProofsEnsSubdomain = "erc20.proofs"

export const vocdoniMainnetEntityId = "0x0"
export const vocdoniGoerliEntityId = "0x99024a2fA351C3B1f6AA069F120329d980Fc95Ed"
export const vocdoniRinkebyEntityId = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"
export const vocdoniXDaiEntityId = "0x8469d886788116e18b82d6566d951c77bc0b19ef7b6b837b725b667addeef6b5"
export const vocdoniSokolEntityId = "0xe00f56aac24b5b78b94c38f511631b8b09a5c5a9ee49978dbe57f28135695e1a"

export const XDAI_CHAIN_ID = 100
export const XDAI_PROVIDER_URI = "https://dai.poa.network"
export const XDAI_GAS_PRICE = utils.parseUnits("1", "gwei")
export const XDAI_ENS_REGISTRY_ADDRESS = "0x00cEBf9E1E81D3CC17fbA0a49306EBA77a8F26cD"

export const SOKOL_CHAIN_ID = 77
export const SOKOL_PROVIDER_URI = "https://sokol.poa.network"
export const SOKOL_GAS_PRICE = utils.parseUnits("1", "gwei")
export const SOKOL_ENS_REGISTRY_ADDRESS = "0xDb6C74071116D17a47D9c191cbE6d640111Ee5C2"

// export const SIGNATURE_TIMESTAMP_TOLERANCE = 60 * 8 // +/- 8 minutes
export const VOCHAIN_BLOCK_TIME = 12 // seconds
export const CENSUS_MAX_BULK_SIZE = 400 // # of claims per addClaimBulk request
export const GATEWAY_SELECTION_TIMEOUT = 4000  // milliseconds
