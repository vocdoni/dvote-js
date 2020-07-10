import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, TestAccount } from "../helpers/all-services"
import { EntityResolverContractMethods } from "dvote-solidity"

import { ensHashAddress } from "dvote-solidity"
import { deployEntityResolverContract, getEntityResolverInstance } from "../../src/net/contracts"
import EntityBuilder, { DEFAULT_NAME } from "../builders/entity-resolver"

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let entityNode: string
let contractInstance: EntityResolverContractMethods & Contract

addCompletionHooks()

describe("Entity Resolver", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]

        entityNode = ensHashAddress(entityAccount.address)

        contractInstance = await new EntityBuilder().build()
    })

    describe("Resolver Smart Contract", () => {

        it("Should deploy the smart contract", async () => {
            contractInstance = await deployEntityResolverContract({ provider: entityAccount.provider, wallet: entityAccount.wallet })

            expect(contractInstance).to.be.ok
            expect(contractInstance.address.match(/^0x[0-9a-fA-F]{40}$/)).to.be.ok
        })

        it("Should attach to a given instance", async () => {
            contractInstance = await deployEntityResolverContract({ provider: entityAccount.provider, wallet: entityAccount.wallet })

            expect(contractInstance.address).to.be.ok

            await contractInstance.setText(entityNode, "custom-key", "custom value")
            expect(await contractInstance.text(entityNode, "custom-key")).to.equal("custom value")

            const newInstance = await getEntityResolverInstance({ provider: entityAccount.provider }, contractInstance.address)

            expect(newInstance.address).to.equal(contractInstance.address)
            expect(await newInstance.text(entityNode, "custom-key")).to.equal("custom value")
        })

        it("Should work for any creator account", async () => {
            entityNode = ensHashAddress(randomAccount.address)

            contractInstance = await new EntityBuilder().withEntityAccount(randomAccount).build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq(DEFAULT_NAME)

            contractInstance = await new EntityBuilder().withEntityAccount(randomAccount).withName("ENTITY NAME 3").build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq("ENTITY NAME 3")
        })

    })

    describe("Resolver Text Records", () => {

        it("Should set and retrieve the name of an entity", async () => {
            contractInstance = await new EntityBuilder().build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq(DEFAULT_NAME)

            contractInstance = await new EntityBuilder().withName("ENTITY NAME 2").build()
            expect(await contractInstance.text(entityNode, "key-name")).to.eq("ENTITY NAME 2")
        })

        it("Should allow to set any arbitrary key/value", async () => {
            contractInstance = await new EntityBuilder().build()

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

    describe("Resolver Text List Records", () => {

        it("Should return an empty list for non-existing fields", async () => {
            const key = "list-1"

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([])
        })

        it("Should allow to push elements to a list", async () => {
            const key = "list-1"
            const text1 = "Some text here"
            const text2 = "Some more there"
            const text3 = ""
            const text4 = "The last one was empty"
            const text5 = "..."

            await contractInstance.pushListText(entityNode, key, text1)
            await contractInstance.pushListText(entityNode, key, text2)
            await contractInstance.pushListText(entityNode, key, text3)
            await contractInstance.pushListText(entityNode, key, text4)
            await contractInstance.pushListText(entityNode, key, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)
        })

        it("Should allow to update elements from a list", async () => {
            const key = "list-2"
            let text1 = "Some text here"
            let text2 = "Some more there"
            let text3 = ""
            let text4 = "The last one was empty"
            let text5 = "..."

            await contractInstance.pushListText(entityNode, key, text1)
            await contractInstance.pushListText(entityNode, key, text2)
            await contractInstance.pushListText(entityNode, key, text3)
            await contractInstance.pushListText(entityNode, key, text4)
            await contractInstance.pushListText(entityNode, key, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)

            text1 = "A new value here"
            text2 = "changing things"
            text3 = "changing more things"
            text4 = "still, a new string"
            text5 = "finally, some more text"

            await contractInstance.setListText(entityNode, key, 0, text1)
            await contractInstance.setListText(entityNode, key, 1, text2)
            await contractInstance.setListText(entityNode, key, 2, text3)
            await contractInstance.setListText(entityNode, key, 3, text4)
            await contractInstance.setListText(entityNode, key, 4, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)
        })

        it("Should allow to remove elements from a list", async () => {
            const key = "list-1"
            let text1 = "string 1"
            let text2 = "string 2"
            let text3 = "str 3"
            let text4 = "text 4"
            let text5 = "and 5"

            await contractInstance.pushListText(entityNode, key, text1)
            await contractInstance.pushListText(entityNode, key, text2)
            await contractInstance.pushListText(entityNode, key, text3)
            await contractInstance.pushListText(entityNode, key, text4)
            await contractInstance.pushListText(entityNode, key, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])

            // await contractInstance

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)

            text1 = "A new value here"
            text2 = "changing things"
            text3 = "changing more things"
            text4 = "still, a new string"
            text5 = "finally, some more text"

            await contractInstance.setListText(entityNode, key, 0, text1)
            await contractInstance.setListText(entityNode, key, 1, text2)
            await contractInstance.setListText(entityNode, key, 2, text3)
            await contractInstance.setListText(entityNode, key, 3, text4)
            await contractInstance.setListText(entityNode, key, 4, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)
        })

        it("Should allow to use any arbitrary key", async () => {
            let key = "list-1"
            const text1 = "string 1"
            const text2 = "string 2"
            const text3 = "str 3"
            const text4 = "text 4"
            const text5 = "and 5"

            await contractInstance.pushListText(entityNode, key, text1)
            await contractInstance.pushListText(entityNode, key, text2)
            await contractInstance.pushListText(entityNode, key, text3)
            await contractInstance.pushListText(entityNode, key, text4)
            await contractInstance.pushListText(entityNode, key, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])

            key = "a-totally-random-long-key-here"

            await contractInstance.pushListText(entityNode, key, text1)
            await contractInstance.pushListText(entityNode, key, text2)
            await contractInstance.pushListText(entityNode, key, text3)
            await contractInstance.pushListText(entityNode, key, text4)
            await contractInstance.pushListText(entityNode, key, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)
        })

        it("Should support UTF8 string lists", async () => {
            const key = "list-1"
            const text1 = "àèìòùçäëïöü"
            const text2 = "👍💛🔊🎉"
            const text3 = "🐱🐶🐭🦊🐼"
            const text4 = "法院的十六名法官吃了被绞死的肝脏"
            const text5 = "أكل ستة عشر قاضيا محكمة معلقة الكبد"

            await contractInstance.pushListText(entityNode, key, text1)
            await contractInstance.pushListText(entityNode, key, text2)
            await contractInstance.pushListText(entityNode, key, text3)
            await contractInstance.pushListText(entityNode, key, text4)
            await contractInstance.pushListText(entityNode, key, text5)

            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)
        })

        it("Should support stringified JSON lists", async () => {
            const key = "list-1"
            const value1 = { object: "value" }
            const value2 = [1, "2", null, 3.3]
            const value3 = null
            const value4 = "some text \"escaped\" here. And **markdown** stuff\n## TITLE <!-- COMMENT -->"
            const value5 = 1.234
            const text1 = JSON.stringify(value1)
            const text2 = JSON.stringify(value2)
            const text3 = JSON.stringify(value3)
            const text4 = JSON.stringify(value4)
            const text5 = JSON.stringify(value5)

            await contractInstance.pushListText(entityNode, key, text1)
            await contractInstance.pushListText(entityNode, key, text2)
            await contractInstance.pushListText(entityNode, key, text3)
            await contractInstance.pushListText(entityNode, key, text4)
            await contractInstance.pushListText(entityNode, key, text5)

            // string comparison
            expect(await contractInstance.list(entityNode, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityNode, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityNode, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityNode, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityNode, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityNode, key, 4)).to.equal(text5)

            // JSON comparison
            const val = (await contractInstance.list(entityNode, key)).map(v => JSON.parse(v))
            expect(val).to.deep.equal([value1, value2, value3, value4, value5])
            expect(JSON.parse(await contractInstance.listText(entityNode, key, 0))).to.deep.equal(value1)
            expect(JSON.parse(await contractInstance.listText(entityNode, key, 1))).to.deep.equal(value2)
            expect(JSON.parse(await contractInstance.listText(entityNode, key, 2))).to.deep.equal(value3)
            expect(JSON.parse(await contractInstance.listText(entityNode, key, 3))).to.deep.equal(value4)
            expect(JSON.parse(await contractInstance.listText(entityNode, key, 4))).to.deep.equal(value5)
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
