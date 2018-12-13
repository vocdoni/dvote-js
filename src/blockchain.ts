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
        processId = this.web3.utils.asciiToHex(processId);
        const processIdBytes: number[] = this.web3.utils.hexToBytes(processId);
        return await this.votingProcessContract.methods.getProcessMetadata(processIdBytes).call();
    }

    public async createProcess(metadata: object, organizerAddress: string): Promise<string> {
        return await this.votingProcessContract.methods.create(metadata).call({from: organizerAddress});
    }

    public getVotingProcessContractAbi(votingProcessContractPath: string): any[] {
        const parsed = JSON.parse(fs.readFileSync(__dirname + "/.." + votingProcessContractPath).toString());
        return parsed.abi;
    }
}
