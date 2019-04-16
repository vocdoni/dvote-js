import { providers, utils, Contract } from "ethers"
import { VotingProcess as VotingProcessContractDefinition } from "dvote-solidity"
import { VotingProcessData } from "dvote-solidity/build/types"
import SmartContract from "../lib/smart-contract"
import Gateway from "./gateway"

const { abi, bytecode } = VotingProcessContractDefinition

type VotingProcessConstructorParams = {
    // connectivity
    web3Provider?: providers.Web3Provider,  // for window.web3.currentProvider
    providerUrl?: string,                   // URL's like http://localhost:8545
    provider?: providers.Provider,          // specific ethers.js provider

    // wallet
    privateKey?: string,
    mnemonic?: string,
    mnemonicPath?: string                   // Derivation path
}

/**
 * The class extends the behavior of the SmartContract base class
 */
export default class VotingProcess extends SmartContract {
    // STATIC FUNCTIONS

    /**
     * Compute the ID of a process off-chain
     * @param entityAddress 
     * @param processIndex 
     */
    public static getProcessId(entityAddress: string, processIndex: number): string {
        const hexStr = "0000000000000000000000000000000000000000000000000000000000000000" + processIndex.toString(16)
        const processIndexBytes = hexStr.slice(-64)

        return utils.keccak256(entityAddress + processIndexBytes)
    }

    // METHODS

    /**
     * Creates a contract factory to deploy or attach to VotingProcess instances
     * @param params 
     */
    constructor(params: VotingProcessConstructorParams) {
        if (!params) throw new Error("Invalid parameters")

        const { web3Provider, providerUrl, provider, privateKey, mnemonic, mnemonicPath } = params

        super({
            // mandatory
            abi,
            bytecode,

            // one of
            web3Provider,
            providerUrl,
            provider,

            // optional for read-only
            privateKey,
            mnemonic,
            mnemonicPath
        })
    }

    /**
     * Fetch the JSON metadata for the given processId using the given gateway
     * @param processId 
     * @param gatewayIp 
     * @param gatewayPort 
     */
    public async getJsonMetadata(processId: string, gatewayIp: string, gatewayPort: number): Promise<string> {
        if (!processId) throw new Error("Invalid processId")
        else if (!gatewayIp) throw new Error("Invalid gateway IP")
        else if (!gatewayPort) throw new Error("Invalid gateway port")

        const data: VotingProcessData = await this.contractInstance.get(processId)
        if (!data || !data.metadataContentUri) throw new Error("The given entity has no metadata defined yet")

        const gw = new Gateway(gatewayIp, gatewayPort)
        return gw.fetchFile(data.metadataContentUri)
    }
}
