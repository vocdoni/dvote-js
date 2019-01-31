import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";

export default class Process {
    private Blockchain: Blockchain;

    constructor(web3: any, votingProcessContractAddress: string) {
        this.Blockchain = new Blockchain(web3, votingProcessContractAddress, DvoteContracts.VotingProcess.abi);
    }

    public async create(metadata: any, organizerAddress: string): Promise<string> {
        // TODO: Some input validation
        return await this.Blockchain.exec("createProcess",
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

    public async getMetadata(id: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (id.length === 0) {
                reject("ID can't be empty");
            }
            this.Blockchain.exec("getProcessMetadata", [id])
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
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
