import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";

export default class Process {
    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, votingProcessContractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, votingProcessContractAddress, DvoteContracts.VotingProcess.abi);
    }

    public create(metadata: any, organizerAddress: string): Promise<string> {
        // TODO: Some input validation
        return this.Blockchain.exec("createProcess",
            [metadata.name,
            metadata.startBlock,
            metadata.endBlock,
            metadata.censusMerkleRoot,
            metadata.censusProofUrl,
            metadata.censusRequestUrl,
            metadata.question,
            metadata.votingOptions,
            metadata.voteEncryptionPublicKey],
            { type: "send", from: organizerAddress, gas: 999999 });
    }

    public getMetadata(id: string): Promise<any> {
        if (id.length === 0) {
            return Promise.reject("ID can't be empty");
        }
        return this.Blockchain.exec("getProcessMetadata", [id]);
    }

    public getId(name: string, organizerAddress: string): Promise<string> {
        return this.Blockchain.exec("getProcessId", [organizerAddress, name]);
    }

    public getProcessesIdsByOrganizer(organizerAddress: string): Promise<any> {
        return this.Blockchain.exec("getProcessesIdByOrganizer", [organizerAddress]);
    }

    public getMultipleMetadata(processesId) {
        const promises = [];
        for (const pid of processesId) {
            promises.push(this.getMetadata(pid));
        }

        return Promise.all(promises);
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
