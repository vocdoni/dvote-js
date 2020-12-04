// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
//
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import DevServices, { TestAccount } from "../helpers/all-services"
import { NamespaceContractMethods } from "../../src/net/contracts"

import { BigNumber, ContractReceipt } from "ethers"
import NamespaceBuilder, { DEFAULT_GENESIS, DEFAULT_NAMESPACE, DEFAULT_ORACLES, DEFAULT_VALIDATORS, DEFAULT_CHAIN_ID } from "../builders/namespace"

let server: DevServices
let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let contractInstance: NamespaceContractMethods & Contract
// let tx: ContractReceipt

const nullAddress = "0x0000000000000000000000000000000000000000"

addCompletionHooks()

describe("Namespaces", () => {
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

        contractInstance = (await new NamespaceBuilder(accounts).build()).connect(baseAccount.wallet) as NamespaceContractMethods & Contract
    })

    describe("Genesis info", () => {
        it("Should allow to set the genesis Content Hashed URI", async () => {
            const genesis = "ipfs://12341234!56785678"

            const tx = await contractInstance.setGenesis(DEFAULT_NAMESPACE, genesis)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            const [chainId, genesis2, validators, oracles] = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(chainId).to.equal(DEFAULT_CHAIN_ID)
            expect(genesis2).to.equal(genesis)
            expect(validators).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles).to.deep.equal(DEFAULT_ORACLES)
        })

        it("Should notify the event", async () => {
            const genesis = "ipfs://12341234!56785678"

            const result: { genesis: string } = await new Promise((resolve, reject) => {
                contractInstance.on("GenesisUpdated", (genesis: string) => {
                    resolve({ genesis })
                })
                contractInstance.setGenesis(DEFAULT_NAMESPACE, genesis).catch(reject)
            })

            expect(result.genesis).to.equal(genesis)
        }).timeout(8000)
    })

    describe("Chain ID", () => {
        it("Should allow to set the Chain ID", async () => {
            const srcChainId = "chain-id-name"

            let tx = await contractInstance.setChainId(DEFAULT_NAMESPACE, srcChainId)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            const [chainId, genesis2, validators, oracles] = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(chainId).to.equal(srcChainId)
            expect(genesis2).to.equal(DEFAULT_GENESIS)
            expect(validators).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles).to.deep.equal(DEFAULT_ORACLES)
        })

        it("Should notify the event", async () => {
            const srcChainId = "chain-id-name"

            const result: { chainId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainIdUpdated", (chainId: string) => {
                    resolve({ chainId })
                })
                contractInstance.setChainId(DEFAULT_NAMESPACE, srcChainId).catch(reject)
            })

            expect(result.chainId).to.equal(srcChainId)
        }).timeout(8000)
    })

    describe("Validator addition", () => {

        beforeEach(async () => {
            contractInstance = (await new NamespaceBuilder(accounts).withValidators([]).build()).connect(baseAccount.wallet) as NamespaceContractMethods & Contract
        })

        it("Should allow to add validators", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"
            const pubKey2 = "0x2345678901234567890123456789012345678901"

            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey1)).to.deep.equal(false)
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey2)).to.deep.equal(false)

            // add one
            const tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, pubKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey1)).to.deep.equal(true)

            // add another one
            const tx2 = await contractInstance.addValidator(DEFAULT_NAMESPACE, pubKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey2)).to.deep.equal(true)
        })

        it("Should notify about validators added to a Namespace", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorAdded", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.addValidator(DEFAULT_NAMESPACE, pubKey1).catch(reject)
            })

            expect(result.validatorPublicKey).to.equal(pubKey1)
        }).timeout(8000)
    })

    describe("Removing validators", () => {
        beforeEach(async () => {
            contractInstance = (await new NamespaceBuilder(accounts).withValidators([]).build()).connect(baseAccount.wallet) as NamespaceContractMethods & Contract
        })

        it("Should allow to remove a Validator", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"
            const pubKey2 = "0x2345678901234567890123456789012345678901"

            // add some
            await contractInstance.addValidator(DEFAULT_NAMESPACE, pubKey1)
            await contractInstance.addValidator(DEFAULT_NAMESPACE, pubKey2)

            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey1)).to.deep.equal(true)
            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey2)).to.deep.equal(true)

            // remove one
            const tx = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, pubKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey1)).to.deep.equal(false)

            // remove the other one
            const tx2 = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, pubKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            expect(await contractInstance.isValidator(DEFAULT_NAMESPACE, pubKey2)).to.deep.equal(false)
        })

        it("Should notify about Validators removed", async () => {
            const pubKey1 = "0x1234567890123456789012345678901234567890"

            await contractInstance.addValidator(DEFAULT_NAMESPACE, pubKey1)

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, pubKey1).catch(reject)
            })

            expect(result.validatorPublicKey).to.equal(pubKey1)
        }).timeout(8000)
    })

    describe("Oracle addition", () => {

        beforeEach(async () => {
            contractInstance = (await new NamespaceBuilder(accounts).withOracles([]).build()).connect(baseAccount.wallet) as NamespaceContractMethods & Contract
        })

        it("Should allow to add oracles", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"
            const address2 = "0x2345678901234567890123456789012345678901"

            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address1)).to.eq(false)
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address2)).to.eq(false)

            // add one
            const tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, address1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            const [chainId, genesis, validators, oracles] = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(chainId).to.equal(DEFAULT_CHAIN_ID)
            expect(genesis).to.equal(DEFAULT_GENESIS)
            expect(validators).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles).to.deep.equal([address1])

            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address1)).to.eq(true)

            // add another one
            const tx2 = await contractInstance.addOracle(DEFAULT_NAMESPACE, address2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            const [chainId2, genesis2, validators2, oracles2] = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(chainId2).to.equal(DEFAULT_CHAIN_ID)
            expect(genesis2).to.equal(DEFAULT_GENESIS)
            expect(validators2).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles2).to.deep.equal([address1, address2])

            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address2)).to.eq(true)
        })

        it("Should notify about oracles added to a Namespace", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"

            const result: { oraclePublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (oraclePublicKey: string) => {
                    resolve({ oraclePublicKey })
                })
                contractInstance.addOracle(DEFAULT_NAMESPACE, address1).catch(reject)
            })

            expect(result.oraclePublicKey).to.equal(address1)
        }).timeout(8000)
    })

    describe("Removing oracles", () => {
        beforeEach(async () => {
            contractInstance = (await new NamespaceBuilder(accounts).withOracles([]).build()).connect(baseAccount.wallet) as NamespaceContractMethods & Contract
        })

        it("Should allow to remove an Oracle", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"
            const address2 = "0x2345678901234567890123456789012345678901"

            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address1)).to.eq(false)
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address2)).to.eq(false)

            // add some
            await contractInstance.addOracle(DEFAULT_NAMESPACE, address1)
            await contractInstance.addOracle(DEFAULT_NAMESPACE, address2)

            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address1)).to.eq(true)
            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address2)).to.eq(true)

            // remove one
            const tx = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, address1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)
            await tx.wait()

            const [chainId, genesis, validators, oracles] = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(chainId).to.equal(DEFAULT_CHAIN_ID)
            expect(genesis).to.equal(DEFAULT_GENESIS)
            expect(validators).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles).to.deep.equal([address2])

            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address1)).to.eq(false)

            // remove the other one
            const tx2 = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, address2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx.wait()

            const [chainId2, genesis2, validators2, oracles2] = await contractInstance.getNamespace(DEFAULT_NAMESPACE)
            expect(chainId2).to.equal(DEFAULT_CHAIN_ID)
            expect(genesis2).to.equal(DEFAULT_GENESIS)
            expect(validators2).to.deep.equal(DEFAULT_VALIDATORS)
            expect(oracles2).to.deep.equal([])

            expect(await contractInstance.isOracle(DEFAULT_NAMESPACE, address2)).to.eq(false)
        })

        it("Should notify about oracles removed on a Namespace", async () => {
            const address1 = "0x1234567890123456789012345678901234567890"

            await contractInstance.addOracle(DEFAULT_NAMESPACE, address1)

            const result: { oraclePublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oraclePublicKey: string) => {
                    resolve({ oraclePublicKey })
                })
                contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, address1).catch(reject)
            })

            expect(result.oraclePublicKey).to.equal(address1)
        }).timeout(8000)
    })
})
