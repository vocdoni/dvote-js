import Web3 = require("web3");

export default class EntityResolver {

    // TODO
    // - get ABI from config
    // - figure out where to get fromAddress. Assume the first one of the provider?

    private contractAbi: any[];
    private contractAddress: string;
    private contract: Web3.eth.Contract;
    private web3: Web3;

    constructor(web3Provider: any, contractAddress: string, contractAbi: any[]) {
        this.web3 = new Web3(web3Provider);
        this.contractAddress = contractAddress;
        this.contractAbi = contractAbi;
        this.contract = this.web3.eth.Contract(this.contractAbi, this.contractAddress);
    }

    public setText(entityId: string, key: string, value: string, fromAddress: string) {

        return this.contract.methods.setText(entityId, key, value).send({ from: fromAddress });
    }

    public text(entityId: string, key: string) {

        return this.contract.methods.text(entityId, key).call();
    }

}