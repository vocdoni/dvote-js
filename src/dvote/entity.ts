import Blockchain from "./blockchain";

export default class Entity {
    private Blockchain: Blockchain;

    constructor(blockchainUrl: string, contractPath: string, contractAddress: string) {
        this.Blockchain = new Blockchain(blockchainUrl, contractPath, contractAddress);
    }

    public async create(metadata: object, organizerAddress: string): Promise<string> {
        // TODO: Some input validation

        return await this.Blockchain.createEntity(metadata, organizerAddress);
    }

    public async get(address: string): Promise<any> {
        if (address.length === 0) {
            throw Error("Address can't be empty");
        }

        return await this.Blockchain.getEntity(address);
    }

}
