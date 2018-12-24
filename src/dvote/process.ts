import Blockchain from "./blockchain";

export default class Process {
    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, votingProcessContractPath: string, votingProcessContractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, votingProcessContractPath, votingProcessContractAddress);
    }

    public async create(metadata: any, organizerAddress: string): Promise<string> {
        // TODO: Some input validation
        return await this.Blockchain.exec("createProcess",
                                            [metadata.name,
                                            metadata.startBlock,
                                            metadata.endBlock,
                                            metadata.censusMerkleRoot,
                                            metadata.question,
                                            metadata.votingOptions,
                                            metadata.voteEncryptionPublicKey],
                                            {type: "send", from: organizerAddress, gas: 999999});
    }

    public async getMetadata(id: string): Promise<any> {
        if (id.length === 0) {
            throw Error("ID can't be empty");
        }

        return await this.Blockchain.exec("getProcessMetadata", [id]);
    }

    public async getId(name: string, organizerAddress: string): Promise<string> {
        const processId = await this.Blockchain.exec("getProcessId", [organizerAddress, name]);
        return processId;
    }

    public async getProcessesIdsByOrganizer(organizerAddress: string): Promise<any> {
        return await this.Blockchain.exec("getProcessesIdByOrganizer", [organizerAddress]);
    }

    public async getMultipleMetadata(processesId) {
        const promises = [];
        for (const pid of processesId) {
            promises.push(this.getMetadata(pid));
        }

        return await Promise.all(promises);
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
