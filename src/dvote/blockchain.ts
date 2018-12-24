import * as fs from "fs";
import Web3 = require("web3");
import Contract from "web3/eth/contract";

export default class Blockchain {
    private url: string;
    private web3: Web3;
    private contractPath: string;
    private contractAbi: any[];
    private contractAddress: string;
    private contract: Contract;

    constructor(url: string, contractPath, contractAddress) {
        this.url = url;
        this.web3 = new Web3(new Web3.providers.HttpProvider(url));
        this.contractAddress = contractAddress;

        this.contractPath = contractPath;
        this.contractAbi = this.getContractAbi(contractPath);

        this.contract = new this.web3.eth.Contract(this.contractAbi, this.contractAddress);
    }

    public async getProcessMetadata(processId: string): Promise<any> {
        processId = this.web3.utils.fromAscii(processId);
        return await this.contract.methods.getProcessMetadata(processId).call();
    }

    public async createProcess(metadata: any, organizerAddress: string): Promise<any> {
        return await this.contract.methods
            .createProcess( metadata.name,
                            metadata.startBlock,
                            metadata.endBlock,
                            metadata.censusMerkleRoot,
                            metadata.question,
                            metadata.votingOptions,
                            metadata.voteEncryptionPublicKey)
            .send({from: organizerAddress, gas: 999999});
    }

    public async getProcessId(name: string, organizerAddress: string): Promise<string> {
        const processId = await this.contract.methods.getProcessId(organizerAddress, name)
                                                                  .call({from: organizerAddress});
        return this.web3.utils.toAscii(processId);
    }

    public getContractAbi(contractPath: string): any[] {
        const parsed = JSON.parse(fs.readFileSync(__dirname + "/../.." + contractPath).toString());
        return parsed.abi;
    }

    public async getProcessesIdByOrganizer(organizerAddress: string): Promise<any> {
        const processes = await this.contract.methods.getProcessesIdByOrganizer(organizerAddress).call();
        const parsed = [];
        for (const p of processes) {
            parsed.push(this.web3.utils.toAscii(p));
        }

        return parsed;
    }

    public async createEntity(metadata: any, organizerAddress: string): Promise<any> {
        return await this.contract.methods
            .createEntity( metadata.name )
            .send({from: organizerAddress, gas: 999999});
    }

    public async getEntity(address: string): Promise<any> {
        return await this.contract.methods.getEntity(address).call();
    }
}
