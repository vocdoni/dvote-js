import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";

export default class Entity {
    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, contractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, contractAddress, DvoteContracts.VotingEntity.abi);
    }

    public async create(metadata: any, organizerAddress: string): Promise<string> {
        return await this.Blockchain.exec("createEntity",
                                            [metadata.name, metadata.censusRequestUrl],
                                            {type: "send", from: organizerAddress, gas: 999999});
    }

    public async get(address: string): Promise<any> {
        if (address.length === 0) {
            throw Error("Address can't be empty");
        }

        return await this.Blockchain.exec("getEntity", [address], {type: "call"});
    }

}
