import * as fs from "fs";
import Web3 = require("web3");
import Contract from "web3/eth/contract";

export default class Blockchain {
    private url: string;
    private web3: Web3;
    private votingProcessContractPath: string;
    private votingProcessContractAbi: any[];
    private votingProcessContractAddress: string;
    private votingProcessContract: Contract;

    constructor(url: string, votingProcessContractPath, votingProcessContractAddress) {
        this.url = url;
        this.web3 = new Web3(new Web3.providers.HttpProvider(url));
        this.votingProcessContractAddress = votingProcessContractAddress;

        this.votingProcessContractPath = votingProcessContractPath;
        this.votingProcessContractAbi = this.getVotingProcessContractAbi(votingProcessContractPath);

        this.votingProcessContract = new this.web3.eth.Contract(this.votingProcessContractAbi,
                                                                this.votingProcessContractAddress);
    }

    public async getProcessMetadata(processId: string): Promise<any> {
        processId = this.web3.utils.fromAscii(processId);
        return await this.votingProcessContract.methods.getProcessMetadata(processId).call();
    }

    public async createProcess(metadata: any, organizerAddress: string): Promise<any> {
        return await this.votingProcessContract.methods
            .createProcess( metadata.name,
                            metadata.startBlock,
                            metadata.endBlock,
                            metadata.censusMerkleRoot,
                            metadata.question,
                            metadata.votingOptions,
                            metadata.voteEncryptionPublicKey)
            .send({from: organizerAddress, gas: 999999});
    }

    public async getProcessId(name: string, organizerAddress: string): Promise<string> {
        const processId = await this.votingProcessContract.methods.getProcessId(organizerAddress, name)
                                                                  .call({from: organizerAddress});
        return this.web3.utils.toAscii(processId);
    }

    public getVotingProcessContractAbi(votingProcessContractPath: string): any[] {
        const parsed = JSON.parse(fs.readFileSync(__dirname + "/.." + votingProcessContractPath).toString());
        return parsed.abi;
    }
}
