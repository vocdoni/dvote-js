// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
//
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, ContractTransaction, providers } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import DevServices, { TestAccount } from "../helpers/all-services"
import { NamespacesContractMethods } from "../../packages/net/src" // TODO: Import from the new NPM package

// import { BigNumber, ContractReceipt } from "ethers"
import NamespaceBuilder, { DEFAULT_NAMESPACE } from "../builders/namespace"

let server: DevServices
let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let contractInstance: NamespacesContractMethods & Contract
// let tx: ContractReceipt

const nullAddress = "0x0000000000000000000000000000000000000000"

addCompletionHooks()

describe("Namespaces", () => {
    before(() => {
        server = new DevServices({ port: 9025 }, { port: 9026 })
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

        contractInstance = (await new NamespaceBuilder(accounts).build()).connect(baseAccount.wallet) as NamespacesContractMethods & Contract
    })

    // Stop polling
    afterEach(() => (contractInstance.provider as providers.BaseProvider).polling = false)

    it("Should allow to register an address", async () => {
        contractInstance = contractInstance.connect(randomAccount1.wallet) as NamespacesContractMethods & Contract

        expect(await contractInstance.namespaceCount()).to.eq(0)

        const tx = await contractInstance.register() as any as ContractTransaction
        expect(tx).to.be.ok
        expect(tx.to).to.equal(contractInstance.address)
        await tx.wait()

        expect(await contractInstance.namespaceCount()).to.eq(1)
        expect(await contractInstance.processContractAt(1)).to.eq(randomAccount1.address)
    })

    it("Should notify the event", async () => {
        const result: { namespaceCount: number } = await new Promise((resolve, reject) => {
            contractInstance.on("NamespaceRegistered", (namespaceCount: number) => {
                resolve({ namespaceCount })
            })
            contractInstance.register().catch(reject)
        })

        expect(result.namespaceCount).to.equal(1)
    }).timeout(8000)
})
