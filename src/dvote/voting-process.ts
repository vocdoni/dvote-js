import { providers, utils, Contract } from "ethers"
import { VotingProcess as VotingProcessContractDefinition } from "dvote-solidity"
import SmartContract from "../lib/smart-contract"

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
    constructor(params: VotingProcessConstructorParams) {
        if (!params) throw new Error("Invalid parameters")

        const { web3Provider, providerUrl, provider, privateKey, mnemonic, mnemonicPath } = params

        super({
            abi,
            bytecode,

            web3Provider,
            providerUrl,
            provider,

            privateKey,
            mnemonic,
            mnemonicPath
        })
    }

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
}
