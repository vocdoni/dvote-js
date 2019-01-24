import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";
import MerkleProof from "./merkleProof";

import Axios from "axios";
import * as tweetnacl from "tweetnacl";

export default class Census {

    private Blockchain: Blockchain;
    private CensusServiceUrl: string;

    public initBlockchain(blockchainUrl: string, votingProcessContractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, votingProcessContractAddress, DvoteContracts.VotingProcess.abi);
    }

    public initCensusService(censusServiceUrl: string) {
        this.CensusServiceUrl = censusServiceUrl;
    }

    public async getMetadata(id: string): Promise<string> {
        if (id.length === 0) {
            throw Error("ID can't be empty");
        }

        return await this.Blockchain.exec("getCensusMetadata", [id]);
    }

    public async getProof(votingPublicKey: string, censusId: string, franchiseProofUrl?: string): Promise<MerkleProof> {
        if (votingPublicKey.length === 0
            || censusId.length === 0) {
            throw Error("Neither votePublicKey nor censusId can be empty");
        }

        if (!franchiseProofUrl) {
            franchiseProofUrl = this.CensusServiceUrl + "/genProof";
        }

        const data = { claimData: votingPublicKey, censusId };
        const response = await Axios.post(franchiseProofUrl, data);
        return new MerkleProof(response.data.response);
    }

    public async addClaim(votingPublicKey: string, censusId: string, privateKey: string): Promise<boolean> {
        if (votingPublicKey.length === 0
            || censusId.length === 0) {
            throw Error("Neither votePublicKey nor censusId can be empty");
        }

        const timeStamp: string = Math.floor(new Date().getTime() / 1000).toString();
        const data = { claimData: votingPublicKey, censusId, timeStamp, signature: "" };
        data.signature = this.sign(data, privateKey);

        const response = await Axios.post(this.CensusServiceUrl + "/addClaim", data);

        return (response.data.error === false);
    }

    public async checkProof(votingPublicKey: string, censusId: string, proof: string): Promise<boolean> {
        if (votingPublicKey.length === 0
            || censusId.length === 0) {
            throw Error("Neither votePublicKey nor censusId can be empty");
        }

        const data = { claimData: votingPublicKey, censusId, proofData: proof };
        const response = await Axios.post(this.CensusServiceUrl + "/checkProof", data);
        return (response.data.response === "valid");
    }

    public async getRoot(censusId: string): Promise<string> {
        if (censusId.length === 0) {
            throw Error("CensusId can't be empty");
        }

        const data = { censusId };
        const response = await Axios.post(this.CensusServiceUrl + "/getRoot", data);
        return response.data.response;
    }

    public async snapshot(censusId: string): Promise<string> {
        const data = { censusId };
        const response = await Axios.post(this.CensusServiceUrl + "/snapshot", data);
        return response.data.response;
    }

    public async dump(censusId: string): Promise<string[]> {
        const data = { censusId };
        const response = await Axios.post(this.CensusServiceUrl + "/dump", data);
        return JSON.parse(response.data.response);
    }

    private sign(data: any, privateKey: string): string {
        const message: string = data.censusId + data.claimData + data.timeStamp;
        const signed: Uint8Array = tweetnacl.sign(Buffer.from(message), Buffer.from(privateKey, "hex"));
        return Buffer.from(signed).toString("hex").slice(0, 128);
    }
}
