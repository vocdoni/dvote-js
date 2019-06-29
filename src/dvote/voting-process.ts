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
    gateway: Gateway = null

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
     * @param privateKey 
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
    constructor(params: VotingProcessConstructorParams = {}) {
        super({
            // mandatory
            abi,
            bytecode,

            // one of
            web3Provider: params.web3Provider,
            providerUrl: params.providerUrl,
            provider: params.provider,

            // optional for read-only
            privateKey: params.privateKey,
            mnemonic: params.mnemonic,
            mnemonicPath: params.mnemonicPath
        })
    }

    /**
     * Fetch the JSON metadata for the given processId using the given gateway
     * @param processId 
     * @param gatewayUri 
     */
    public async getMetadata(processId: string, gatewayUri: string): Promise<string> {
        if (!processId) throw new Error("Invalid processId")
        else if (!gatewayUri) throw new Error("Invalid gateway IP")
        else if (!this.contractInstance) throw new Error("You need to attach to a contract or deploy a new one before invoking this operation")

        const data: VotingProcessData = await this.contractInstance.get(processId)
        if (!data || !data.metadataContentUri) throw new Error("The given entity has no metadata defined yet")

        // Ensure we are connected to the right Gateway
        if (!this.gateway) this.gateway = new Gateway(gatewayUri)
        else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

        const jsonBuffer = await this.gateway.fetchFile(data.metadataContentUri)
        this.gateway.disconnect()
        return jsonBuffer.toString()
    }

    /**
     * Fetch the modulus group of the given process census using the given gateway
     * @param processId 
     * @param address
     * @param gatewayUri 
     */
    public async getMerkleProof(processId: string, address: number, gatewayUri: string): Promise<string> {
        const metadata = await this.getMetadata(processId, gatewayUri)

        // TODO: Use the CensusService Object

        // TODO: Check that the vote type == ZK Snarks
        // TODO:

        throw new Error("unimplemented")
    }

    /**
     * Fetch the modulus group of the given process census using the given gateway
     * @param processId 
     * @param gatewayUri 
     * @param publicKeyModulus
     */
    public async getVotingRing(processId: string, gatewayUri: string, publicKeyModulus: number): Promise<boolean> {
        // Ensure we are connected to the right Gateway
        if (!this.gateway) this.gateway = new Gateway(gatewayUri)
        else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

        return this.gateway.request({
            method: "getVotingRing",
            processId,
            publicKeyModulus
        }).then(strData => JSON.parse(strData))
    }

    /**
     * Submit the vote envelope to a Gateway
     * @param voteEnvelope
     * @param processId 
     * @param gatewayUri 
     * @param relayAddress
     */
    public async submitVoteEnvelope(voteEnvelope: VoteEnvelopeLRS | VoteEnvelopeZK, processId: string, gatewayUri: string, relayAddress: string): Promise<boolean> {
        throw new Error("unimplemented")

        if (voteEnvelope.type == "lrs-envelope") {

        }
        else { // zk-snarks-envelope

        }

        // TODO: Encode in base64
        // TODO: Encrypt vote envelope with the public key of the Relay
        const encryptedEnvelope = JSON.stringify(voteEnvelope)

        // Ensure we are connected to the right Gateway
        if (!this.gateway) this.gateway = new Gateway(gatewayUri)
        else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

        return this.gateway.request({
            method: "submitVoteEnvelope",
            processId,
            encryptedEnvelope,
            relayAddress
        }).then(strData => JSON.parse(strData))
    }

    /**
     * 
     * @param processId 
     * @param gatewayUri 
     * @param nullifier
     */
    public async getVoteStatus(processId: string, gatewayUri: string, nullifier: string): Promise<boolean> {
        // Ensure we are connected to the right Gateway
        if (!this.gateway) this.gateway = new Gateway(gatewayUri)
        else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

        return this.gateway.request({
            method: "getVoteStatus",
            processId,
            nullifier
        }).then(strData => JSON.parse(strData))
    }

    /**
     * Fetches the vote batch of a given processId
     * @param processId 
     * @param gatewayUri 
     * @param batchNumber
     */
    public async fetchVoteBatch(processId: string, gatewayUri: string, batchNumber: number): Promise<string> {
        if (!this.contractInstance) throw new Error("Please, attach to an instance or deploy one")

        const contentUri = await this.contractInstance.getBatch(processId, batchNumber)
        if (!contentUri) throw new Error("A vote batch with the given number does not exist on process " + processId)

        // Ensure we are connected to the right Gateway
        if (!this.gateway) this.gateway = new Gateway(gatewayUri)
        else if (await this.gateway.getUri() != gatewayUri) await this.gateway.setGatewayUri(gatewayUri)

        const jsonBuffer = await this.gateway.fetchFile(contentUri)
        return jsonBuffer.toString("base64")
    }

    // COMPUTATION METHODS

    public packageVote(votePkg: VotePackageLRS | VotePackageZK, relayPublicKey: string): VoteEnvelopeLRS | VoteEnvelopeZK {
        if (votePkg.type == "lrs-package") {
            return this.packageLrsVote(votePkg, relayPublicKey)
        }
        else if (votePkg.type == "zk-snarks-package") {
            return this.packageZkVote(votePkg, relayPublicKey)
        }
        throw new Error("Unsupported vote type")
    }

    private packageLrsVote(votePkg: VotePackageLRS, relayPublicKey: string): VoteEnvelopeLRS {
        throw new Error("unimplemented")
    }

    private packageZkVote(votePkg: VotePackageZK, relayPublicKey: string): VoteEnvelopeLRS {
        throw new Error("unimplemented")
    }
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
