import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";

export default class Entity {
    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, contractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, contractAddress, DvoteContracts.VotingEntity.abi);
    }

    public create(metadata: any, organizerAddress: string): Promise<string> {
        return this.Blockchain.exec("createEntity",
            [metadata.name, metadata.censusRequestUrl],
            { type: "send", from: organizerAddress, gas: 999999 });
    }

    public get(address: string): Promise<any> {
        if (address.length === 0) {
            throw Error("Address can't be empty");
        }

        return this.Blockchain.exec("getEntity", [address], { type: "call" });
    }

    public async getAll(): Promise<any[]> {
        const addresses = await this.Blockchain.exec("entitiesIndex", [], { type: "call" });

        // Warning: this can become inefficient with many entities
        return Promise.all(addresses.map((address: string) => {
            return this.Blockchain.exec("getEntity", [address], { type: "call" });
        }));
    }
}
