import Blockchain from "./blockchain";

export default class Process {
    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, votingProcessContractAbiPath: string, votingProcessContractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, votingProcessContractAbiPath, votingProcessContractAddress);
    }

    public getMetadata(id: string): object {
        if (id.length === 0) {
            throw Error("ID can't be empty");
        }

        return this.Blockchain.getProcessMetadata(id);
    }

    public encryptVote(vote: string, votePublicKey: string): string {
        if (vote.length === 0) {
            throw Error("Vote can't be empty");
        }

        if (votePublicKey.length === 0) {
            throw Error("VotePublicKey can't be empty");
        }

        return "";
    }
}
