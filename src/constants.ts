import { utils } from "ethers"

export const IPFS_GATEWAY_LIST_URI = "https://ipfs.github.io/public-gateway-checker/gateways.json"

export const VOCDONI_ENS_ROOT = "voc.eth"
export const VOCDONI_ENS_ROOT_STAGING = "stg." + VOCDONI_ENS_ROOT
export const VOCDONI_ENS_ROOT_DEV = "dev." + VOCDONI_ENS_ROOT

export const ENTITY_RESOLVER_ENS_SUBDOMAIN = "entities"
export const GENESIS_ENS_SUBDOMAIN = "genesis"
export const NAMESPACES_ENS_SUBDOMAIN = "namespaces"
export const PROCESSES_ENS_SUBDOMAIN = "processes"
export const RESULTS_ENS_SUBDOMAIN = "results"
export const ERC20_STORAGE_PROOFS_ENS_SUBDOMAIN = "erc20.proofs"

// Address used for ENS text records: keccak256(address) => ensNode
export const VOCDONI_MAINNET_ENTITY_ID = "0x0"
export const VOCDONI_GOERLI_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"
export const VOCDONI_RINKEBY_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"
export const VOCDONI_XDAI_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"
export const VOCDONI_SOKOL_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"

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
