import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";
import MerkleProof from "./merkleProof";

import Axios from "axios";

export default class Census {

    private Blockchain: Blockchain;
    private CensusServiceUrl: string;

    constructor(blockchainUrl: string, votingProcessContractAddress: string, censusServiceUrl: string) {
        this.Blockchain = new Blockchain(blockchainUrl, votingProcessContractAddress, DvoteContracts.VotingProcess.abi);
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

    public async addClaim(votingPublicKey: string, censusId: string) {
        if (votingPublicKey.length === 0
            || censusId.length === 0) {
            throw Error("Neither votePublicKey nor censusId can be empty");
        }

        const data = { claimData: votingPublicKey, censusId };
        const response = await Axios.post(this.CensusServiceUrl + "/addClaim", data);
        return (response.data.error === false);
    }

    public async checkProof(votingPublicKey: string, censusId: string, proof: string) {
        if (votingPublicKey.length === 0
            || censusId.length === 0) {
            throw Error("Neither votePublicKey nor censusId can be empty");
        }

        const data = { claimData: votingPublicKey, censusId, proofData: proof };
        const response = await Axios.post(this.CensusServiceUrl + "/checkProof", data);
        return (response.data.response === "valid");
    }

    public async getRoot(censusId: string) {
        if (censusId.length === 0) {
            throw Error("CensusId can't be empty");
        }

        const data = { censusId };
        const response = await Axios.post(this.CensusServiceUrl + "/getRoot", data);
        return response.data.response;
    }
}
