import Web3 = require("web3");

export default class Blockchain {
    public static getContract(contractAbi: any[], contractAddress: string) {
        return new Web3.eth.Contract(contractAbi, contractAddress);
    }

    private url: string;
    private contractAbi: any[];
    private contractAddress: string;
    private contract: Web3.eth.Contract;
    private web3: Web3;

    constructor(url: string, contractAddress: string, contractAbi: any[]) {
        this.url = url;
        this.web3 = new Web3(new Web3.providers.HttpProvider(url));
        this.contractAddress = contractAddress;
        this.contractAbi = contractAbi;

        this.contract = Blockchain.getContract(this.contractAbi, this.contractAddress);
    }

    public exec(method: string, params?: any[], options?: any): Promise<any> {
        let callOrSend = "call";
        if (options != null && options.type === "send") {
            callOrSend = "send";
        }

        return this.contract.methods[method](...params)[callOrSend](options);
    }
}
