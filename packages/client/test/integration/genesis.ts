// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
//
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, providers } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import DevServices, { TestAccount } from "../../../../shared/test/helpers/all-services"
import { GenesisContractMethods } from "@vocdoni/contract-wrappers"

import GenesisBuilder, { DEFAULT_GENESIS, DEFAULT_ORACLES, DEFAULT_VALIDATORS, DEFAULT_CHAIN_ID } from "../../../../shared/test/builders/genesis"

let server: DevServices
let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let contractInstance: GenesisContractMethods & Contract
// let tx: ContractReceipt

const nullAddress = "0x0000000000000000000000000000000000000000"

addCompletionHooks()

describe("Genesis", () => {
    before(() => {
        server = new DevServices({ port: 9020 }, { port: 9021 })
        return server.start()
    })
    after(() => server.stop())

    beforeEach(async () => {
        accounts = server.accounts
        baseAccount = accounts[0] // deploy account
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]

        contractInstance = (await new GenesisBuilder(accounts).build()).connect(baseAccount.wallet) as GenesisContractMethods & Contract
    })
    // Stop polling
    afterEach(() => (contractInstance.provider as providers.BaseProvider).polling = false)

    describe("New chain", () => {
        it("Should register a new chain", async () => {
            const genesis = "ipfs://12341234!56785678"

            expect(await contractInstance.getChainCount()).to.eq(1)

            const tx = await contractInstance.newChain(genesis, ["0x01", "0x02"], [randomAccount1.address, randomAccount2.address])
            await tx.wait()

            expect(await contractInstance.getChainCount()).to.eq(2)

            const { genesis: actualGenesis, validators, oracles } = await contractInstance.get(1)
            expect(actualGenesis).to.equal(genesis)
            expect(validators).to.deep.equal(["0x01", "0x02"])
            expect(oracles).to.deep.equal([randomAccount1.address, randomAccount2.address])
        })

        it("Should notify the event", async () => {
            const genesis = "ipfs://12341234!56785678"

            const result: { chainId: number } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainRegistered", (chainId: number) => {
                    resolve({ chainId })
                })
                // No need to create another one, the builder already did

                // contractInstance.newChain(genesis, ["0x01", "0x02"], [randomAccount1.address, randomAccount2.address]).catch(reject)
            })

            expect(result.chainId).to.equal(0)
        }).timeout(8000)
    })

    describe("Genesis update", () => {
        it("Should allow to set the genesis of a chain", async () => {
            const genesis1 = "ipfs://12341234!56785678"
            const genesis2 = "ipfs://56785678!12341234"

            // 1
            let tx = await contractInstance.setGenesis(DEFAULT_CHAIN_ID, genesis1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            let { genesis } = await contractInstance.get(DEFAULT_CHAIN_ID)
            expect(genesis).to.equal(genesis1)

            // 2
            tx = await contractInstance.setGenesis(DEFAULT_CHAIN_ID, genesis2)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            genesis = (await contractInstance.get(DEFAULT_CHAIN_ID)).genesis
            expect(genesis).to.equal(genesis2)
        })

        it("Should notify the event", async () => {
            const genesis = "ipfs://56785678!12341234"

            const result: { chainId: number } = await new Promise((resolve, reject) => {
                contractInstance.on("GenesisUpdated", (chainId: number) => {
                    resolve({ chainId })
                })
                contractInstance.setGenesis(DEFAULT_CHAIN_ID, genesis).catch(reject)
            })

            expect(result.chainId).to.equal(DEFAULT_CHAIN_ID)
        }).timeout(8000)
    })

    describe("Validator addition", () => {

        beforeEach(async () => {
            contractInstance = (await new GenesisBuilder(accounts).withValidators([]).build()).connect(baseAccount.wallet) as GenesisContractMethods & Contract
        })

        it("Should allow to add validators", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"
            const pubKey2 = "0x2345678901234567890123456789012345678901"

            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey1)).to.deep.equal(false)
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey2)).to.deep.equal(false)

            // add one
            const tx = await contractInstance.addValidator(DEFAULT_CHAIN_ID, pubKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey1)).to.deep.equal(true)

            // add another one
            const tx2 = await contractInstance.addValidator(DEFAULT_CHAIN_ID, pubKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey2)).to.deep.equal(true)
        })

        it("Should notify about validators added to a Chain", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"

            const result: { chainId: number, validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorAdded", (chainId: number, validatorPublicKey: string) => {
                    resolve({ chainId, validatorPublicKey })
                })
                contractInstance.addValidator(DEFAULT_CHAIN_ID, pubKey1).catch(reject)
            })

            expect(result.chainId).to.equal(DEFAULT_CHAIN_ID)
            expect(result.validatorPublicKey).to.equal(pubKey1)
        }).timeout(8000)
    })

    describe("Removing validators", () => {
        beforeEach(async () => {
            contractInstance = (await new GenesisBuilder(accounts).withValidators([]).build()).connect(baseAccount.wallet) as GenesisContractMethods & Contract
        })

        it("Should allow to remove a Validator", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"
            const pubKey2 = "0x2345678901234567890123456789012345678901"

            // add some
            await contractInstance.addValidator(DEFAULT_CHAIN_ID, pubKey1)
            await contractInstance.addValidator(DEFAULT_CHAIN_ID, pubKey2)

            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey1)).to.deep.equal(true)
            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey2)).to.deep.equal(true)

            // remove one
            const tx = await contractInstance.removeValidator(DEFAULT_CHAIN_ID, 0, pubKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey1)).to.deep.equal(false)

            // remove the other one
            const tx2 = await contractInstance.removeValidator(DEFAULT_CHAIN_ID, 0, pubKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_CHAIN_ID, pubKey2)).to.deep.equal(false)
        })

        it("Should notify about Validators removed", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"

            await contractInstance.addValidator(DEFAULT_CHAIN_ID, pubKey1)

            const result: { chainId: number, validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (chainId: number, validatorPublicKey: string) => {
                    resolve({ chainId, validatorPublicKey })
                })
                contractInstance.removeValidator(DEFAULT_CHAIN_ID, 0, pubKey1).catch(reject)
            })

            expect(result.chainId).to.equal(DEFAULT_CHAIN_ID)
            expect(result.validatorPublicKey).to.equal(pubKey1)
        }).timeout(8000)
    })

    describe("Oracle addition", () => {

        beforeEach(async () => {
            contractInstance = (await new GenesisBuilder(accounts).withOracles([]).build()).connect(baseAccount.wallet) as GenesisContractMethods & Contract
        })

        it("Should allow to add oracles", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"
            const address2 = "0x2345678901234567890123456789012345678901"

            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address1)).to.eq(false)
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address2)).to.eq(false)

            // add one
            const tx = await contractInstance.addOracle(DEFAULT_CHAIN_ID, address1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            const { genesis, validators, oracles } = await contractInstance.get(DEFAULT_CHAIN_ID)
            expect(genesis).to.equal(DEFAULT_GENESIS)
            expect(validators).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles).to.deep.equal([address1])

            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address1)).to.eq(true)

            // add another one
            const tx2 = await contractInstance.addOracle(DEFAULT_CHAIN_ID, address2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            const { genesis: genesis2, validators: validators2, oracles: oracles2 } = await contractInstance.get(DEFAULT_CHAIN_ID)
            expect(genesis2).to.equal(DEFAULT_GENESIS)
            expect(validators2).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles2).to.deep.equal([address1, address2])

            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address2)).to.eq(true)
        })

        it("Should notify about oracles added to a Namespace", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"

            const result: { chainId: number, oracleAddr: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (chainId: number, oracleAddr: string) => {
                    resolve({ chainId, oracleAddr })
                })
                contractInstance.addOracle(DEFAULT_CHAIN_ID, address1).catch(reject)
            })

            expect(result.chainId).to.equal(DEFAULT_CHAIN_ID)
            expect(result.oracleAddr).to.equal(address1)
        }).timeout(8000)
    })

    describe("Removing oracles", () => {
        beforeEach(async () => {
            contractInstance = (await new GenesisBuilder(accounts).withOracles([]).build()).connect(baseAccount.wallet) as GenesisContractMethods & Contract
        })

        it("Should allow to remove an Oracle", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"
            const address2 = "0x2345678901234567890123456789012345678901"

            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address1)).to.eq(false)
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address2)).to.eq(false)

            // add some
            await contractInstance.addOracle(DEFAULT_CHAIN_ID, address1)
            await contractInstance.addOracle(DEFAULT_CHAIN_ID, address2)

            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address1)).to.eq(true)
            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address2)).to.eq(true)

            // remove one
            const tx = await contractInstance.removeOracle(DEFAULT_CHAIN_ID, 0, address1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            const { genesis, validators, oracles } = await contractInstance.get(DEFAULT_CHAIN_ID)
            expect(genesis).to.equal(DEFAULT_GENESIS)
            expect(validators).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles).to.deep.equal([address2])

            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address1)).to.eq(false)

            // remove the other one
            const tx2 = await contractInstance.removeOracle(DEFAULT_CHAIN_ID, 0, address2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            const { genesis: genesis2, validators: validators2, oracles: oracles2 } = await contractInstance.get(DEFAULT_CHAIN_ID)
            expect(genesis2).to.equal(DEFAULT_GENESIS)
            expect(validators2).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles2).to.deep.equal([])

            expect(await contractInstance.isOracle(DEFAULT_CHAIN_ID, address2)).to.eq(false)
        })

        it("Should notify about oracles removed on a Chain", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"

            await contractInstance.addOracle(DEFAULT_CHAIN_ID, address1)

            const result: { chainId: number, oracleAddr: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (chainId: number, oracleAddr: string) => {
                    resolve({ chainId, oracleAddr })
                })
                contractInstance.removeOracle(DEFAULT_CHAIN_ID, 0, address1).catch(reject)
            })

            expect(result.chainId).to.equal(DEFAULT_CHAIN_ID)
            expect(result.oracleAddr).to.equal(address1)
        }).timeout(8000)
    })
})
