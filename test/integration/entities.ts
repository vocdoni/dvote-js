import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import DevServices, { TestAccount } from "../helpers/all-services"
import { EnsResolverContractMethods } from "../../src/net/contracts"

import { ensHashAddress } from "../../src/net/contracts"
import { Web3Gateway } from "../../src/net/gateway-web3"
import EntityResolverBuilder, { DEFAULT_NAME } from "../builders/ens-resolver"

let server: DevServices
let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let entityNode: string
let contractInstance: EnsResolverContractMethods & Contract

addCompletionHooks()

describe("Entity Resolver", () => {
    before(() => {
        server = new DevServices()
        return server.start()
    })
    after(() => server.stop())

    beforeEach(async () => {
        accounts = server.accounts
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]

        entityNode = ensHashAddress(entityAccount.address)

        contractInstance = await new EntityResolverBuilder(accounts).build()
    })

    describe("Resolver Smart Contract", () => {

        it("Should attach to a given instance", async () => {
            expect(contractInstance.address).to.be.ok

            await contractInstance.setText(entityNode, "custom-key", "custom value")
            expect(await contractInstance.text(entityNode, "custom-key")).to.equal("custom value")

            const gw = new Web3Gateway(entityAccount.provider)
            const newInstance = await gw.getEnsPublicResolverInstance(entityAccount.wallet, contractInstance.address)

            expect(newInstance.address).to.equal(contractInstance.address)
            expect(await newInstance.text(entityNode, "custom-key")).to.equal("custom value")
        })

        it("Should work for any creator account", async () => {
            entityNode = ensHashAddress(randomAccount.address)

            contractInstance = await new EntityResolverBuilder(accounts).withEntityAccount(randomAccount).build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq(DEFAULT_NAME)

            contractInstance = await new EntityResolverBuilder(accounts).withEntityAccount(randomAccount).withName("ENTITY NAME 3").build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq("ENTITY NAME 3")
        })

    })

    describe("Resolver Text Records", () => {

        it("Should set and retrieve the name of an entity", async () => {
            contractInstance = await new EntityResolverBuilder(accounts).build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq(DEFAULT_NAME)

            contractInstance = await new EntityResolverBuilder(accounts).withName("ENTITY NAME 2").build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq("ENTITY NAME 2")
        })

        it("Should allow to set any arbitrary key/value", async () => {
            contractInstance = await new EntityResolverBuilder(accounts).build()

            const data = [
                { key: "123", value: "hello" },
                { key: "234", value: "goodbye" },
                { key: "345", value: "you" },
                { key: "random", value: "say" },
                { key: "---", value: "hi" },
            ]
            for (let i = 0; i < 10; i++) {
                data.push({ key: `key-${Math.random()}`, value: String(Math.random()) })
            }

            for (let item of data) {
                await contractInstance.setText(entityNode, item.key, item.value)
                let value = await contractInstance.text(entityNode, item.key)
                expect(value).to.equal(item.value)
            }
        }).timeout(4000)

        it("Should support UTF8 strings", async () => {
            await contractInstance.setText(entityNode, "key-123", "àèìòùçäëïöü")
            expect(await contractInstance.text(entityNode, "key-123")).to.eq("àèìòùçäëïöü")

            await contractInstance.setText(entityNode, "key-234", "👍💛🔊🎉")
            expect(await contractInstance.text(entityNode, "key-234")).to.eq("👍💛🔊🎉")
        })

        it("Should support stringified JSON data", async () => {
            const data = {
                key1: "value",
                nested: {
                    key: "Value here",
                    val: null,
                    boolean: false
                },
                num: 0.123456789,
                items: [{ a: 1, b: 2 }],
                escapedString: "This is a \"string\" with double quotes"
            }
            const dataString = JSON.stringify(data)

            await contractInstance.setText(entityNode, "json-key", dataString)
            const receivedDataString = await contractInstance.text(entityNode, "json-key")

            expect(receivedDataString).to.eq(dataString)
            expect(JSON.parse(receivedDataString)).to.deep.equal(data)
        })

    })

    describe("Entity metadata", () => {
        it("Should allow to set the metadata of an entity")
        it("Should fetch the metadata of an entity")
    })

    describe("Official news feed", () => {
        it("Should allow to add JSON feed posts to an entity")
        it("Should fetch the JSON feed of an entity")
    })
})
