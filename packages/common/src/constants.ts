import { parseUnits } from "@ethersproject/units"
import { BigNumber } from "@ethersproject/bignumber"

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
export const VOCDONI_MAINNET_ENTITY_ID = "0xF8f263C7D028AfC754252059382226cf28F812D3"
export const VOCDONI_GOERLI_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"
export const VOCDONI_RINKEBY_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"
export const VOCDONI_XDAI_ENTITY_ID = "0x01f5cbe42e7D758a5b184Cb96dCbF79aD603C592"
export const VOCDONI_XDAI_STG_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"
export const VOCDONI_SOKOL_ENTITY_ID = "0x60E134146338EEce72EF01275Ea4109744e6Ca4A"

export const XDAI_CHAIN_ID = 100
export const XDAI_PROVIDER_URI = "https://dai.poa.network"
export const XDAI_GAS_PRICE = parseUnits("60", "gwei") as BigNumber
export const XDAI_ENS_REGISTRY_ADDRESS = "0x00cEBf9E1E81D3CC17fbA0a49306EBA77a8F26cD"
export const XDAI_STG_ENS_REGISTRY_ADDRESS = "0x693E79F3FD7DC5B3c32D1914E02a932b88397cC7"

export const SOKOL_CHAIN_ID = 77
export const SOKOL_PROVIDER_URI = "https://sokol.poa.network"
export const SOKOL_GAS_PRICE = parseUnits("1", "gwei") as BigNumber
export const SOKOL_ENS_REGISTRY_ADDRESS = "0xDb6C74071116D17a47D9c191cbE6d640111Ee5C2"

// export const SIGNATURE_TIMESTAMP_TOLERANCE = 60 * 8 // +/- 8 minutes
export const VOCHAIN_BLOCK_TIME = 12 // seconds
export const CENSUS_MAX_BULK_SIZE = 400 // # of claims per addClaimBulk request
export const GATEWAY_SELECTION_TIMEOUT = 4000  // milliseconds

export const ZK_VOTING_CIRCUIT_WASM_FILE_NAME = "circuit.wasm"
export const ZK_VOTING_ZKEY_FILE_NAME = "circuit_final.zkey"
export const ZK_VOTING_VERIFICATION_KEY_FILE_NAME = "verification-key.json"

/**
 * ENS keys used to store the Text Records on the Smart Contract
 */
export namespace TextRecordKeys {
  export const JSON_METADATA_CONTENT_URI = "vnd.vocdoni.meta"
  export const VOCDONI_ARCHIVE = "vnd.vocdoni.archive"
  export const VOCDONI_BOOT_NODES = "vnd.vocdoni.boot-nodes"
  export const VOCDONI_GATEWAY_HEARTBEAT = "vnd.vocdoni.gateway-heartbeat"
}
