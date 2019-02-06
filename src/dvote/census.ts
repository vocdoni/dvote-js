import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";
import MerkleProof from "./merkleProof";

import Axios from "axios";
import * as tweetnacl from "tweetnacl";

interface ICensusMetadata {
    censusMerkleRoot: string
    censusProofUrl: string
}

interface IPayload {
    censusId: string
    claimData: string
    timeStamp: string
    signature: string
}

export default class Census {
    // STATIC METHODS

    public static async getProof(voterPublicKey: string, censusId: string, censusProofUrl: string): Promise<MerkleProof> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")
        else if (!censusProofUrl) throw new Error("censusProofUrl is required")

        const data = { claimData: voterPublicKey, censusId };
        const response = await Axios.post(censusProofUrl, data);
        return new MerkleProof(response.data.response);
    }

    public static sign(data: IPayload, privateKey: string): string {
        if (!data) throw new Error("data is required")
        else if (!privateKey) throw new Error("privateKey is required")

        const message: string = data.censusId + data.claimData + data.timeStamp;
        const signed: Uint8Array = tweetnacl.sign(Buffer.from(message), Buffer.from(privateKey, "hex"));
        return Buffer.from(signed).toString("hex").slice(0, 128);
    }

    public static getCensusIdFromAddress(address: string) {
        if (address.match(/^0x/)) {
            return address.substr(2);
        }
        else {
            return address;
        }
    }

    // INTENRAL VARIABLES

    private ProcessInstance: Blockchain;
    private CensusServiceUrl: string;

    // INTENRAL METHODS

    public initBlockchain(web3Provider: any, votingProcessContractAddress: string) {
        this.ProcessInstance = new Blockchain(web3Provider, votingProcessContractAddress, DvoteContracts.VotingProcess.abi);
    }

    public initCensusService(censusServiceUrl: string) {
        this.CensusServiceUrl = censusServiceUrl;
    }

    public getMetadata(processId: string): Promise<ICensusMetadata> {
        if (processId.length === 0) {
            return Promise.reject(new Error("processId is required"));
        }

        return this.ProcessInstance.exec("getCensusMetadata", [processId]);
    }

    public async getProof(voterPublicKey: string, censusId: string): Promise<MerkleProof> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId);

        const data = { claimData: voterPublicKey, censusId };
        const response = await Axios.post(this.CensusServiceUrl, data);
        return new MerkleProof(response.data.response);
    }

    public async addClaim(voterPublicKey: string, censusId: string, privateKey: string): Promise<boolean> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId);

        const timeStamp: string = Math.floor(new Date().getTime() / 1000).toString();
        const data: IPayload = { claimData: voterPublicKey, censusId, timeStamp, signature: "" };
        data.signature = Census.sign(data, privateKey);

        const response = await Axios.post(this.CensusServiceUrl + "/addClaim", data);

        return (response.data.error === false);
    }

    public async checkProof(voterPublicKey: string, censusId: string, proof: string): Promise<boolean> {
        if (!voterPublicKey) throw new Error("voterPublicKey is required")
        else if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId);

        const data = { claimData: voterPublicKey, censusId, proofData: proof };
        const response = await Axios.post(this.CensusServiceUrl + "/checkProof", data);
        return (response.data.response === "valid");
    }

    public async getRoot(censusId: string): Promise<string> {
        if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId);

        const data = { censusId };
        const response = await Axios.post(this.CensusServiceUrl + "/getRoot", data);
        return response.data.response;
    }

    public async snapshot(censusId: string, privateKey: string): Promise<string> {
        if (!censusId) throw new Error("censusId is required")
        else if (!privateKey) throw new Error("privateKey is required")

        censusId = Census.getCensusIdFromAddress(censusId);

        const timeStamp: string = Math.floor(new Date().getTime() / 1000).toString();
        const data = { censusId, claimData: "", timeStamp, signature: "" };
        data.signature = Census.sign(data, privateKey);

        const response = await Axios.post(this.CensusServiceUrl + "/snapshot", data);
        return response.data.response;
    }

    public async dump(censusId: string): Promise<string[]> {
        if (!censusId) throw new Error("censusId is required")

        censusId = Census.getCensusIdFromAddress(censusId);

        const data = { censusId };
        const response = await Axios.post(this.CensusServiceUrl + "/dump", data);
        return JSON.parse(response.data.response);
    }
}
