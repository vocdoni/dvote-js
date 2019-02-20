import DvoteContracts = require("dvote-smart-contracts")
import Blockchain from "./blockchain"
import MerkleProof from "./merkleProof"

import Axios from "axios"
import * as tweetnacl from "tweetnacl"

interface ICensusMetadata {
    censusMerkleRoot: string
    censusProofUrl: string
}

type ICensusRequestPayload =
    { method: "addClaim", censusId: string, claimData: string, signature: string } |
    { method: "getRoot", censusId: string } |
    { method: "genProof", censusId: string, claimData: string, rootHash?: string } |
    { method: "checkProof", censusId: string, claimData: string, rootHash?: string, proofData: string } |
    { method: "getIdx", censusId: string, claimData: string, rootHash?: string } |
    { method: "dump", censusId: string, rootHash?: string, signature: string }

interface ISignPayload {
    method: "addClaim" | "getRoot" | "genProof" | "checkProof" | "getIdx" | "dump",
    censusId: string,
    claimData?: string,
    rootHash?: string
}

export default class Census {
    // STATIC METHODS

    public static async getProof(voterPublicKey: string, censusId: string, censusProofUrl: string): Promise<MerkleProof> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")
        else if (!censusProofUrl) throw new Error("censusProofUrl is required")

        const payload: ICensusRequestPayload = { method: "genProof", censusId, claimData: voterPublicKey }
        const response = await Axios.post(censusProofUrl, payload)
        return new MerkleProof(response.data.response)
    }

    public static sign(data: ISignPayload, privateKey: string): string {
        if (!data) throw new Error("data is required")
        else if (!privateKey) throw new Error("privateKey is required")

        const timeStamp: string = Math.floor(new Date().getTime() / 1000).toString()

        const payload: string = data.method + data.censusId +
            (data.rootHash || "") + (data.claimData || "") + timeStamp

        // TODO:  Refactor to be NodeJS independent
        const signature: Uint8Array = tweetnacl.sign(Buffer.from(payload), Buffer.from(privateKey, "hex"))
        return Buffer.from(signature).toString("hex").slice(0, 128)
    }

    public static getCensusIdFromAddress(address: string) {
        if (address.match(/^0x/)) {
            return address.substr(2)
        }
        else {
            return address
        }
    }

    // INTENRAL VARIABLES

    private ProcessInstance: Blockchain
    private CensusServiceUrl: string

    // INTENRAL METHODS

    public initBlockchain(web3Provider: any, votingProcessContractAddress: string) {
        this.ProcessInstance = new Blockchain(web3Provider, votingProcessContractAddress, DvoteContracts.VotingProcess.abi)
    }

    public initCensusService(censusServiceUrl: string) {
        this.CensusServiceUrl = censusServiceUrl
    }

    public getMetadata(processId: string): Promise<ICensusMetadata> {
        if (processId.length === 0) {
            return Promise.reject(new Error("processId is required"))
        }

        return this.ProcessInstance.exec("getCensusMetadata", [processId])
    }

    public async getProof(voterPublicKey: string, censusId: string): Promise<MerkleProof> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId)

        const payload = { claimData: voterPublicKey, censusId }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        if (!response.data || !response.data.response) throw new Error("Invalid response")
        return new MerkleProof(response.data.response)
    }

    // TODO: Refactor (privateKey should not be the mechanism => web3.eth.personal.sign() instead)
    public async addClaim(voterPublicKey: string, censusId: string, privateKey: string): Promise<boolean> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")
        else if (!privateKey) throw new Error("privateKey is still required")

        censusId = Census.getCensusIdFromAddress(censusId)

        const signablePayload: ISignPayload = {
            method: "addClaim",
            claimData: voterPublicKey,
            censusId
        }

        const signature = Census.sign(signablePayload, privateKey)

        const payload: ICensusRequestPayload = {
            method: "addClaim",
            claimData: voterPublicKey,
            censusId,
            signature
        }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        if (!response.data) throw new Error("Invalid response")
        else if (response.data.error) throw new Error(response.data.response)
        return true
    }

    public async checkProof(voterPublicKey: string, censusId: string, proof: string): Promise<boolean> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId)

        const payload: ICensusRequestPayload = { method: "checkProof", claimData: voterPublicKey, censusId, proofData: proof }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        return (response.data.response === "valid")
    }

    public async getRoot(censusId: string): Promise<string> {
        if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId)

        const payload: ICensusRequestPayload = { method: "getRoot", censusId }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        if (!response.data) throw new Error("Invalid response")
        else if (response.data.error) throw new Error(response.data.response)
        return response.data.response
    }

    // TODO: Refactor (privateKey should not be the mechanism => web3.eth.personal.sign() instead)
    public async dump(censusId: string, privateKey: string): Promise<string[]> {
        if (!censusId) throw new Error("censusId is required")
        else if (!privateKey) throw new Error("privateKey is still required")

        censusId = Census.getCensusIdFromAddress(censusId)

        const signablePayload: ISignPayload = { method: "dump", censusId }
        const signature = Census.sign(signablePayload, privateKey)

        const payload: ICensusRequestPayload = { method: "dump", censusId, signature }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        if (!response.data) throw new Error("Invalid response")
        else if (response.data.error) throw new Error(response.data.response)
        return JSON.parse(response.data.response)
    }
}
