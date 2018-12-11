import * as fs from "fs";
import Web3 = require("web3");

export default class Blockchain {
    private url: string;
    private web3: Web3;
    private votingProcessContractAbiPath: string;
    private votingProcessContractAbi: any[];
    private votingProcessContractAddress: string;

    constructor(url: string, votingProcessContractAbiPath, votingProcessContractAddress) {
        this.url = url;
        this.web3 = new Web3(new Web3.providers.HttpProvider(url));
        this.votingProcessContractAddress = votingProcessContractAddress;

        this.votingProcessContractAbiPath = votingProcessContractAbiPath;
        const parsed = JSON.parse(fs.readFileSync(__dirname + "/.." + votingProcessContractAbiPath).toString());
        this.votingProcessContractAbi = parsed.abi;
    }

    public async getProcessMetadata(id: string): Promise<any> {
        const votingProcessContract = new this.web3.eth.Contract(this.votingProcessContractAbi,
                                                                this.votingProcessContractAddress);
        id = this.web3.utils.asciiToHex(id);
        return await votingProcessContract.methods.getProcessMetadata(this.web3.utils.hexToBytes(id)).call();
    }
}
