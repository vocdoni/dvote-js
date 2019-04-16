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

    /**
     * Compute the derived public key given a processId
     * @param publicKey 
     * @param processId 
     */
    public static derivePublicKey(publicKey: string, processId: string): string {
        throw new Error("unimplemented")
    }

    /**
     * Compute the derived private key given a processId
     * @param publicKey 
     * @param processId 
     */
    public static derivePrivateKey(privateKey: string, processId: string): string {
        throw new Error("unimplemented")
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
     * @param gatewayUri 
     */
    public async getJsonMetadata(processId: string, gatewayUri: string): Promise<string> {
        if (!processId) throw new Error("Invalid processId")
        else if (!gatewayUri) throw new Error("Invalid gateway IP")
        else if (!this.contractInstance) throw new Error("You need to attach to a contract or deploy a new one before invoking this operation")

        const data: VotingProcessData = await this.contractInstance.get(processId)
        if (!data || !data.metadataContentUri) throw new Error("The given entity has no metadata defined yet")

        const gw = new Gateway(gatewayUri)
        return gw.fetchFile(data.metadataContentUri)
    }

    /**
     * Fetch the modulus group of the given process census using the given gateway
     * @param processId 
     * @param modulusGroup
     * @param gatewayUri 
     */
    public async getLrsRing(processId: string, modulusGroup: number, gatewayUri: string): Promise<string> {
        const metadata = await this.getJsonMetadata(processId, gatewayUri)

        // TODO: Check that the vote type == LRS
        // TODO:

        throw new Error("unimplemented")
    }

    /**
     * Fetch the modulus group of the given process census using the given gateway
     * @param processId 
     * @param address
     * @param gatewayUri 
     */
    public async getMerkleProof(processId: string, address: number, gatewayUri: string): Promise<string> {
        const metadata = await this.getJsonMetadata(processId, gatewayUri)

        // TODO: Check that the vote type == ZK Snarks
        // TODO:

        throw new Error("unimplemented")
    }

    /**
     * Submit the vote envelope to a Gateway
     * @param voteEnvelope
     * @param processId 
     * @param gatewayUri 
     * @param relayAddress
     */
    public async submitVoteEnvelope(voteEnvelope: VoteEnvelopeLRS | VoteEnvelopeZK, processId: string, gatewayUri: string, relayAddress: string): Promise<boolean> {

        if (voteEnvelope.type == "lrs-envelope") {

        }
        else { // zk-snarks-envelope

        }

        const payload: SubmitEnvelopeRequestPayload = {
            method: "submitVoteEnvelope",
            processId,
            content: JSON.stringify(voteEnvelope), // TODO:
            relayAddress
        }

        // TODO: Encrypt vote envelope with the public key of the Relay
        // TODO: 

        throw new Error("unimplemented")
    }

    // Get Vote Status

    // Package Vote (LRS)
    // Package Vote (ZK)
}


// TYPES

export type VotePackageLRS = {
    type: "lrs-package"
}
export type VotePackageZK = {
    type: "zk-snarks-package"
}
export type VoteEnvelopeLRS = {
    type: "lrs-envelope"
}
export type VoteEnvelopeZK = {
    type: "zk-snarks-envelope"
}

export type SubmitEnvelopeRequestPayload = {
    method: "submitVoteEnvelope",
    processId: string,
    content: string,  // Encrypted Vote package
    relayAddress: string
}
