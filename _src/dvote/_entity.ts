import DvoteContracts = require("dvote-smart-contracts");
import Blockchain from "./blockchain";

interface IEntity {
    address?: string;
    name: string;
    exists: boolean;
    censusRequestUrl: string;
}

export default class Entity {
    private EntityInstance: Blockchain;

    constructor(web3: any, contractAddress: string) {
        this.EntityInstance = new Blockchain(web3, contractAddress, DvoteContracts.VotingEntity.abi);
    }

    public create(metadata: any, organizerAddress: string): Promise<string> {
        return this.EntityInstance.exec("createEntity",
            [metadata.name, metadata.censusRequestUrl],
            { type: "send", from: organizerAddress, gas: 999999 });
    }

    public async get(address: string): Promise<IEntity> {
        if (address.length === 0) {
            throw Error("Address can't be empty");
        }

        const entity: IEntity = await this.EntityInstance.exec("getEntity", [address], { type: "call" });
        entity.address = address;
        return entity;
    }

    public async getAll(): Promise<IEntity[]> {
        const addresses: string[] = await this.EntityInstance.exec("getEntityIds", [], { type: "call" });

        // Warning: this can become inefficient with many entities
        return Promise.all(addresses.map((addr: string) => this.get(addr)));
    }
}
