// NOTE: This code is borrowed from dvote-solidity

import {
    GenesisContractMethods,
    GenesisContractDefinition
} from "../../src/net/contracts"
import { Contract, ContractFactory } from "ethers"
import { TestAccount } from "../helpers/all-services"

export const DEFAULT_CHAIN_ID = 0
export const DEFAULT_GENESIS = "{genesis-goes-here}"
export const DEFAULT_VALIDATORS = ["0x03e3e79624fe1b1da829946b2269dfa01ef8ea3d99dc5032d8590ab71f8bd1b399", "0x031d04a26c158223550251366c2440601c3b297488e29dd4271610957b7394b66e", "0x023a91c59a377a0721a7afe044dbdd270b3df32ef70c8bf483db934f0170c5c8ae"]
export const DEFAULT_ORACLES = ["0x16EBAAe4EEBC77662aF386cE0Cb0C9b53ACb8689", "0x6B902080Bea78A6dDB7025c6F5F8FD634fA2a3A8", "0xaD9b7B66bD14787a02285514c410627DAb5F6c14"]

// BUILDER
export default class GenesisBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    genesis: string = DEFAULT_GENESIS
    validators: string[] = DEFAULT_VALIDATORS
    oracles: string[] = DEFAULT_ORACLES

    constructor(devAccounts: TestAccount[]) {
        this.accounts = devAccounts
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<Contract & GenesisContractMethods> {
        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(GenesisContractDefinition.abi, GenesisContractDefinition.bytecode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy() as Contract & GenesisContractMethods

        const tx = await contractInstance.newChain(this.genesis, this.validators, this.oracles)
        await tx.wait()

        return contractInstance.connect(this.entityAccount.wallet) as Contract & GenesisContractMethods
    }

    withGenesis(genesis: string) {
        if (typeof genesis != "string") throw new Error("Invalid string")

        this.genesis = genesis
        return this
    }
    withValidators(validators: string[]) {
        if (!Array.isArray(validators)) throw new Error("Invalid validators array")

        this.validators = validators
        return this
    }
    withOracles(oracles: string[]) {
        if (!Array.isArray(oracles)) throw new Error("Invalid oracles array")

        this.oracles = oracles
        return this
    }
}
