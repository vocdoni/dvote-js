import DvoteContracts = require("dvote-smart-contracts");
import * as fs from "fs";
import Web3 = require("web3");
import Contract from "web3/eth/contract";

export default class Blockchain {
    private url: string;
    // private contractPath: string;
    private contractAbi: any[];
    private contractAddress: string;
    private contract: Contract;
    private web3: Web3;

    constructor(url: string, contractAddress) {
        this.url = url;
        this.web3 = new Web3(new Web3.providers.HttpProvider(url));
        this.contractAddress = contractAddress;
        this.contractAbi = DvoteContracts.VotingProcess.abi;

        this.contract = new this.web3.eth.Contract(this.contractAbi, this.contractAddress);
    }

    public getContractAbi(contractPath: string): any[] {
        const parsed = JSON.parse(fs.readFileSync(__dirname + "/../.." + contractPath).toString());
        return parsed.abi;
    }

    public async exec(method: string, params?: any[], options?: any) {
        let callOrSend = "call";
        if (options != null && options.type === "send") {
            callOrSend = "send";
        }

        return await this.contract.methods[method](...params)[callOrSend](options);
    }
}