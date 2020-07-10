// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
//
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import DevServices, { getAccounts, TestAccount } from "../helpers/all-services"
import { NamespaceContractMethods } from "dvote-solidity"

// import { deployNamespaceContract, getNamespaceInstance } from "../../src/net/contracts"
import { BigNumber } from "ethers/utils"
import NamespaceBuilder, { DEFAULT_NAMESPACE } from "../builders/namespace"
import { ContractReceipt } from "ethers/contract"

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let contractInstance: NamespaceContractMethods & Contract
let tx: ContractReceipt

const nullAddress = "0x0000000000000000000000000000000000000000"

addCompletionHooks()

describe("Namespaces", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]

        contractInstance = await new NamespaceBuilder().build()
    })

    it("Should deploy the contract")

    describe("Genesis info", () => {
        it("Should allow to set the genesis Content Hashed URI", async () => {
            const genesis = "ipfs://12341234!56785678"

            const tx = await contractInstance.setGenesis(DEFAULT_NAMESPACE, genesis)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const data = await contractInstance.getGenesis()
            expect(data).to.equal(genesis)
        })

        it("Should notify the event", async () => {
            const genesis = "ipfs://12341234!56785678"

            const result: { genesis: string } = await new Promise((resolve, reject) => {
                contractInstance.on("GenesisChanged", (genesis: string) => {
                    resolve({ genesis })
                })
                contractInstance.setGenesis(DEFAULT_NAMESPACE, genesis).catch(reject)
            })

            expect(result.genesis).to.equal(genesis)
        }).timeout(8000)
    })

    describe("Chain ID", () => {
        it("Should allow to set the Chain ID", async () => {
            const chainId = "chain-id-name"

            let tx = await contractInstance.setChainId(DEFAULT_NAMESPACE, chainId)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            let data = await contractInstance.getChainId()
            expect(data.toNumber()).to.equal(chainId)
        })

        it("Should notify the event", async () => {
            const chainId = "chain-id-name"

            const result: { chainId: BigNumber } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainIdChanged", (chainId: BigNumber) => {
                    resolve({ chainId })
                })
                contractInstance.setChainId(DEFAULT_NAMESPACE, chainId).catch(reject)
            })

            expect(result.chainId.toNumber()).to.equal(chainId)
        }).timeout(8000)
    })

    describe("Validator addition", () => {

        it("Should allow to add validators", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            // add one
            const tx = await contractInstance.addValidator(DEFAULT_NAMESPACE, publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getValidators()
            expect(result1).to.deep.equal([publicKey1])

            // add another one
            const tx2 = await contractInstance.addValidator(DEFAULT_NAMESPACE, publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result3 = await contractInstance.getValidators()
            expect(result3).to.deep.equal([publicKey1, publicKey2])
        })

        it("Should notify about validators added to a Namespace", async () => {
            const publicKey1 = "0x123456"

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorAdded", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.addValidator(DEFAULT_NAMESPACE, publicKey1).catch(reject)
            })

            expect(result.validatorPublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })

    describe("Removing validators", () => {
        it("Should allow to remove a Validator", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            contractInstance = await new NamespaceBuilder().build()

            // add some
            await contractInstance.addValidator(DEFAULT_NAMESPACE, publicKey1)
            await contractInstance.addValidator(DEFAULT_NAMESPACE, publicKey2)

            // remove one
            const tx = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getValidators()
            expect(result1).to.deep.equal([publicKey2])

            // remove the other one
            const tx2 = await contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result2 = await contractInstance.getValidators()
            expect(result2).to.deep.equal([])
        })

        it("Should notify about Validators removed", async () => {
            const publicKey1 = "0x123456"

            contractInstance = await new NamespaceBuilder().build()

            await contractInstance.addValidator(DEFAULT_NAMESPACE, publicKey1)

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(DEFAULT_NAMESPACE, 0, publicKey1).catch(reject)
            })

            expect(result.validatorPublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })

    describe("Oracle addition", () => {

        it("Should allow to add oracles", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            // add one
            const tx = await contractInstance.addOracle(DEFAULT_NAMESPACE, publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getOracles()
            expect(result1).to.deep.equal([publicKey1])

            // add another one
            const tx2 = await contractInstance.addOracle(DEFAULT_NAMESPACE, publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result3 = await contractInstance.getOracles()
            expect(result3).to.deep.equal([publicKey1, publicKey2])
        })

        it("Should notify about oracles added to a Namespace", async () => {
            const publicKey1 = "0x123456"

            const result: { oraclePublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (oraclePublicKey: string) => {
                    resolve({ oraclePublicKey })
                })
                contractInstance.addOracle(DEFAULT_NAMESPACE, publicKey1).catch(reject)
            })

            expect(result.oraclePublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })

    describe("Removing oracles", () => {
        it("Should allow to remove an Oracle", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            contractInstance = await new NamespaceBuilder().build()

            // add some
            await contractInstance.addOracle(DEFAULT_NAMESPACE, publicKey1)
            await contractInstance.addOracle(DEFAULT_NAMESPACE, publicKey2)

            // remove one
            const tx = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getOracles()
            expect(result1).to.deep.equal([publicKey2])

            // remove the other one
            const tx2 = await contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result2 = await contractInstance.getOracles()
            expect(result2).to.deep.equal([])
        })

        it("Should notify about oracles removed on a Namespace", async () => {
            const publicKey1 = "0x123456"

            contractInstance = await new NamespaceBuilder().build()

            await contractInstance.addOracle(DEFAULT_NAMESPACE, publicKey1)

            const result: { oraclePublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oraclePublicKey: string) => {
                    resolve({ oraclePublicKey })
                })
                contractInstance.removeOracle(DEFAULT_NAMESPACE, 0, publicKey1).catch(reject)
            })

            expect(result.oraclePublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })
})
