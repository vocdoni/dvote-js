import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";
import Utils from "./utils";

interface IProcessMetadata {
    id: string
    name: string
    startBlock: number
    endBlock: number
    question: string
    votingOptions: string[]
    voteEncryptionPublicKey: string
}

interface ICreateProcessMetadata {
    name: string
    startBlock: number
    endBlock: number
    censusMerkleRoot: string
    censusProofUrl: string
    censusRequestUrl: string
    question: string
    votingOptions: string[]
    voteEncryptionPublicKey: string
}

interface IGetProcessMetadata {

    name: string,
    startBlock: number,
    endBlock: number,
    question: string,
    votingOptions: string[],
    voteEncryptionPublicKey: string
}

export default class Process {
    private ProcessInstance: Blockchain;

    constructor(web3Provider: any, votingProcessContractAddress: string) {
        this.ProcessInstance = new Blockchain(
            web3Provider, votingProcessContractAddress, DvoteContracts.VotingProcess.abi);
    }

    public create(metadata: ICreateProcessMetadata, organizerAddress: string): Promise<string> {
        if (!metadata.name) {
            return Promise.reject(new Error("Invalid process name"))
        }

        if (!metadata.question) {
            return Promise.reject(new Error("Invalid process question"))
        }

        if (typeof metadata.startBlock !== "number") {
            return Promise.reject(new Error("Invalid process startBlock"))
        }

        if (typeof metadata.endBlock !== "number") {
            return Promise.reject(new Error("Invalid process endBlock"))
        }

        if (metadata.startBlock >= metadata.endBlock) {
            return Promise.reject(new Error("The process endBlock must be greater than the startBlock"))
        }

        if (!metadata.censusMerkleRoot) {
            return Promise.reject(new Error("Invalid process censusMerkleRoot"))
        }

        if (!metadata.censusProofUrl) {
            return Promise.reject(new Error("Invalid process censusProofUrl"))
        }

        if (!metadata.votingOptions || metadata.votingOptions.length < 1) {
            return Promise.reject(new Error("Invalid votingOptions"))
        }

        for (const votingOption of metadata.votingOptions) {
            if (!Utils.stringToBytes32(votingOption)) {
                return Promise.reject(new Error("VotingOption is too long. Should fit into a Bytes32"))
            }
        }

        if (!metadata.voteEncryptionPublicKey) {
            return Promise.reject(new Error("Invalid process voteEncryptionPublicKey"))
        }

        return this.ProcessInstance.exec("createProcess",
            [metadata.name,
            metadata.startBlock,
            metadata.endBlock,
            metadata.censusMerkleRoot,
            metadata.censusProofUrl,
            metadata.censusRequestUrl,
            metadata.question,
            metadata.votingOptions.map((votingOption) => Utils.stringToBytes32(votingOption)),
            metadata.voteEncryptionPublicKey],
            { type: "send", from: organizerAddress, gas: 999999 });
    }

    public getMetadata(processId: string): Promise<IProcessMetadata> {
        if (!processId) {
            return Promise.reject("processId is required");
        }

        return this.ProcessInstance.exec("getProcessMetadata", [processId]).then((meta: IGetProcessMetadata) => {
            const stringVotingOptions = meta.votingOptions.map((bytes32VotingOption) =>
                Utils.bytes32ToString(bytes32VotingOption))

            const newMeta: IProcessMetadata = {
                endBlock: meta.endBlock,
                id: processId,
                name: meta.name,
                question: meta.question,
                startBlock: meta.startBlock,
                voteEncryptionPublicKey: meta.voteEncryptionPublicKey,
                votingOptions: stringVotingOptions,
            }

            return newMeta;
        });
    }

    public getId(name: string, organizerAddress: string): Promise<string> {
        return this.ProcessInstance.exec("getProcessId", [organizerAddress, name]);
    }

    public getProcessesIdsByOrganizer(organizerAddress: string): Promise<string[]> {
        return this.ProcessInstance.exec("getProcessesIdByOrganizer", [organizerAddress]);
    }

    public getMultipleMetadata(processesId: string[]): Promise<IProcessMetadata[]> {
        const promises: Array<Promise<IProcessMetadata>> = [];
        for (const pid of processesId) {
            promises.push(this.getMetadata(pid));
        }

        return Promise.all(promises);
    }

    public encryptVote(vote: string, votePublicKey: string): string {
        if (!vote) {
            throw Error("Vote is required");
        }
        if (!votePublicKey) {
            throw Error("VotePublicKey is required");
        }

        // TODO:
        return "";
    }
}
