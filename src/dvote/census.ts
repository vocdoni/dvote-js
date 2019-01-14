import DvoteContracts = require("dvote-smart-contracts");
import HttpRequest = require("request-promise");
import Blockchain from "./blockchain";
import MerkleProof from "./merkleProof";

export default class Census {

    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, votingProcessContractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, votingProcessContractAddress, DvoteContracts.VotingProcess.abi);
    }

    public async getMetadata(id: string): Promise<string> {
        if (id.length === 0) {
            throw Error("ID can't be empty");
        }

        return await this.Blockchain.exec("getCensusMetadata", [id]);
    }

    public async getProof(votePublicKey: string, franchiseProofUrl: string): Promise<MerkleProof> {
        if (votePublicKey.length === 0) {
            throw Error("votePublicKey can't be empty");
        }

        if (franchiseProofUrl.length === 0) {
            throw Error("franchiseProofUrl can't be empty");
        }

        return new Promise((resolve, reject) => {
            const options = {
                json: true,
                uri: franchiseProofUrl,
            };

            HttpRequest(options)
                .then((proof: string[]) => {
                    resolve(new MerkleProof(proof));
                })
                .catch((err) => {
                    // API call failed...
                    resolve(new MerkleProof([]));
                });
        });

    }
}
