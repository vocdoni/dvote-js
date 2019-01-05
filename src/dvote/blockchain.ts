import * as fs from "fs";
import Web3 = require("web3");

export default class Blockchain {
    private url: string;
    private contractAbi: any[];
    private contractAddress: string;
    private contract: Web3.eth.Contract;
    private web3: Web3;

    constructor(url: string, contractAddress, contractAbi) {
        this.url = url;
        this.web3 = new Web3(new Web3.providers.HttpProvider(url));
        this.contractAddress = contractAddress;
        this.contractAbi = contractAbi;

        this.contract = new this.web3.eth.Contract(this.contractAbi, this.contractAddress);
    }

    public async exec(method: string, params?: any[], options?: any) {
        let callOrSend = "call";
        if (options != null && options.type === "send") {
            callOrSend = "send";
        }

        return await this.contract.methods[method](...params)[callOrSend](options);
    }
}
