import DvoteContracts = require("dvote-smart-contracts")
// import Web3 = require("web3");
import Blockchain from "./blockchain"
import MerkleProof from "./merkleProof"

import Axios from "axios"

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

    public static sign(data: ISignPayload, web3Provider: any): string {
        if (!data) throw new Error("data is required")
        else if (!web3Provider) throw new Error("A web3Provider is required")

        const timeStamp: string = Math.floor(new Date().getTime() / 1000).toString()

        const payload: string = data.method + data.censusId + (data.rootHash || "") + (data.claimData || "") + timeStamp

        // TODO:  Refactor to be NodeJS independent

        // TODO: Implement payload signature using web3

        // const web3 = new Web3(web3Provider)
        // const signature: string = web3.eth.personal.sign(payload, web3Provider.getAddress())
        // return signature

        return ""
    }

    // INTENRAL VARIABLES

    private web3Provider: any
    private ProcessInstance: Blockchain
    private CensusServiceUrl: string

    // INTENRAL METHODS

    public initBlockchain(web3Provider: any, votingProcessContractAddress: string) {
        this.web3Provider = web3Provider
        this.ProcessInstance = new Blockchain(web3Provider, votingProcessContractAddress, DvoteContracts.VotingProcess.abi)
    }

    public initCensusService(censusServiceUrl: string) {
        this.CensusServiceUrl = censusServiceUrl
    }

    // TODO: Refactor into the Process Class
    public getMetadata(processId: string): Promise<ICensusMetadata> {
        if (processId.length === 0) {
            return Promise.reject(new Error("processId is required"))
        }

        return this.ProcessInstance.exec("getCensusMetadata", [processId])
    }

    public async getProof(voterPublicKey: string, censusId: string): Promise<MerkleProof> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")

        const payload: ICensusRequestPayload = { method: "genProof", claimData: voterPublicKey, censusId }
        const response = await Axios.post(this.CensusServiceUrl, payload)
        
        if (!response.data || !response.data.response) throw new Error("Invalid response")
        return new MerkleProof(response.data.response)
    }

    // TODO: Refactor (privateKey should not be the mechanism => web3.eth.personal.sign() instead)
    public async addClaim(voterPublicKey: string, censusId: string): Promise<boolean> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")
        else if (!this.web3Provider) throw new Error("A web3Provider is needed")

        const signablePayload: ISignPayload = {
            method: "addClaim",
            claimData: voterPublicKey,
            censusId
        }

        const signature = Census.sign(signablePayload, this.web3Provider)

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

        const payload: ICensusRequestPayload = { method: "checkProof", claimData: voterPublicKey, censusId, proofData: proof }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        return (response.data.response === "valid")
    }

    public async getRoot(censusId: string): Promise<string> {
        if (!censusId) throw new Error("censusId is required")

        const payload: ICensusRequestPayload = { method: "getRoot", censusId }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        if (!response.data) throw new Error("Invalid response")
        else if (response.data.error) throw new Error(response.data.response)
        return response.data.response
    }

    // TODO: Refactor (privateKey should not be the mechanism => web3.eth.personal.sign() instead)
    public async dump(censusId: string): Promise<string[]> {
        if (!censusId) throw new Error("censusId is required")
        else if (!this.web3Provider) throw new Error("A web3Provider is required")

        const signablePayload: ISignPayload = { method: "dump", censusId }
        const signature = Census.sign(signablePayload, this.web3Provider)

        const payload: ICensusRequestPayload = { method: "dump", censusId, signature }
        const response = await Axios.post(this.CensusServiceUrl, payload)

        if (!response.data) throw new Error("Invalid response")
        else if (response.data.error) throw new Error(response.data.response)

        return JSON.parse(response.data.response)
    }
}
