import Blockchain from "./blockchain";

export default class Process {
    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, votingProcessContractPath: string, votingProcessContractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, votingProcessContractPath, votingProcessContractAddress);
    }

    public async create(metadata: object, organizerAddress: string): Promise<string> {
        // TODO: Some input validation

        return await this.Blockchain.createProcess(metadata, organizerAddress);
    }

    public async getMetadata(id: string): Promise<any> {
        if (id.length === 0) {
            throw Error("ID can't be empty");
        }

        return await this.Blockchain.getProcessMetadata(id);
    }

    public async getId(name: string, organizerAddress: string): Promise<string> {
        return await this.Blockchain.getProcessId(name, organizerAddress);
    }

    public async getProcessesByOrganizer(organizerAddress: string): Promise<any> {
        const processesId = await this.Blockchain.getProcessesIdByOrganizer(organizerAddress);

        const promises = [];
        for (const pid of processesId) {
            promises.push(this.Blockchain.getProcessMetadata(pid));
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
