import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, increaseTimestamp, TestAccount } from "../testing-eth-utils"
import { EntityResolver, EntityResolverContractMethods } from "dvote-solidity"
const fs = require("fs")

import { getEntityId } from "../../src/api/entity"
import { deployEntityResolverContract, getEntityResolverContractInstance } from "../../src/net/contracts"
import { checkValidEntityMetadata } from "../../src/models/entity"
import EntityBuilder, { DEFAULT_NAME } from "../builders/entity-resolver"

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let entityId: string
let contractInstance: EntityResolverContractMethods & Contract

addCompletionHooks()

describe("Entity Resolver", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]

        entityId = getEntityId(entityAccount.address)

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

            await contractInstance.setText(entityId, "custom-key", "custom value")
            expect(await contractInstance.text(entityId, "custom-key")).to.equal("custom value")

            const newInstance = getEntityResolverContractInstance({ provider: entityAccount.provider }, contractInstance.address)

            expect(newInstance.address).to.equal(contractInstance.address)
            expect(await newInstance.text(entityId, "custom-key")).to.equal("custom value")
        })

        it("Should compute the id of an entity address", async () => {
            const data = [
                { address: "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1", id: "0xe7fb8f3e702fd22bf02391cc16c6b4bc465084468f1627747e6e21e2005f880e" },
                { address: "0xffcf8fdee72ac11b5c542428b35eef5769c409f0", id: "0x92eba8bf099a58b316e6c8743101585f4a71b45d87c571440553b6e74671ac5a" },
                { address: "0x22d491bde2303f2f43325b2108d26f1eaba1e32b", id: "0x9f225659836e74be7309b140ad0fee340ce09db633a8d42b85540955c987123b" },
                { address: "0xe11ba2b4d45eaed5996cd0823791e0c93114882d", id: "0xd6604a251934bff7fe961c233a6f8dbd5fb55e6e98cf893237c9608e746e2807" },
                { address: "0xd03ea8624c8c5987235048901fb614fdca89b117", id: "0xa6e02fa9ce046b7970daab05320d7355d28f9e9bc7889121b0d9d90b441f360c" },
                { address: "0x95ced938f7991cd0dfcb48f0a06a40fa1af46ebc", id: "0xee97003d4805070a87a8bd486f4894fbfce48844710a9b46df867f7f64f9a174" },
                { address: "0x3e5e9111ae8eb78fe1cc3bb8915d5d461f3ef9a9", id: "0xaca9367e5113a27f3873ddf78ada8a6af283849bb14cc313cadf63ae03ea52b3" },
                { address: "0x28a8746e75304c0780e011bed21c72cd78cd535e", id: "0xa17b99060235fa80368a12707574ab6381d0fc9aa7cb3a6a116d0f04564980fe" },
                { address: "0xaca94ef8bd5ffee41947b4585a84bda5a3d3da6e", id: "0xb1ec3484f6bdfce3b18264a4e83a5e99fc43641f8e15a3079a9e6872b5d6cace" },
                { address: "0x1df62f291b2e969fb0849d99d9ce41e2f137006e", id: "0x0c3a882b5cad48337e5a74659c514c6e0d5490bdc7ec8898d7d2a924da96c720" },
            ]

            for (let item of data) {
                expect(getEntityId(item.address)).to.equal(item.id)

                expect(await contractInstance.getEntityId(item.address)).to.equal(item.id, "Solidity and JS entity Id's should match")
            }
        })

        it("Should work for any creator account", async () => {
            entityId = getEntityId(randomAccount.address)

            contractInstance = await new EntityBuilder().withEntityAccount(randomAccount).build()
            expect(await contractInstance.text(entityId, "key-name")).to.eq(DEFAULT_NAME)

            contractInstance = await new EntityBuilder().withEntityAccount(randomAccount).withName("ENTITY NAME 3").build()
            expect(await contractInstance.text(entityId, "key-name")).to.eq("ENTITY NAME 3")
        })

    })

    describe("Resolver Text Records", () => {

        it("Should set and retrieve the name of an entity", async () => {
            contractInstance = await new EntityBuilder().build()
            expect(await contractInstance.text(entityId, "key-name")).to.eq(DEFAULT_NAME)

            contractInstance = await new EntityBuilder().withName("ENTITY NAME 2").build()
            expect(await contractInstance.text(entityId, "key-name")).to.eq("ENTITY NAME 2")
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
                await contractInstance.setText(entityId, item.key, item.value)
                let value = await contractInstance.text(entityId, item.key)
                expect(value).to.equal(item.value)
            }
        })

        it("Should support UTF8 strings", async () => {
            await contractInstance.setText(entityId, "key-123", "àèìòùçäëïöü")
            expect(await contractInstance.text(entityId, "key-123")).to.eq("àèìòùçäëïöü")

            await contractInstance.setText(entityId, "key-234", "👍💛🔊🎉")
            expect(await contractInstance.text(entityId, "key-234")).to.eq("👍💛🔊🎉")
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

            await contractInstance.setText(entityId, "json-key", dataString)
            const receivedDataString = await contractInstance.text(entityId, "json-key")

            expect(receivedDataString).to.eq(dataString)
            expect(JSON.parse(receivedDataString)).to.deep.equal(data)
        })

    })

    describe("Resolver Text List Records", () => {

        it("Should return an empty list for non-existing fields", async () => {
            const key = "list-1"

            expect(await contractInstance.list(entityId, key)).to.deep.equal([])
        })

        it("Should allow to push elements to a list", async () => {
            const key = "list-1"
            const text1 = "Some text here"
            const text2 = "Some more there"
            const text3 = ""
            const text4 = "The last one was empty"
            const text5 = "..."

            await contractInstance.pushListText(entityId, key, text1)
            await contractInstance.pushListText(entityId, key, text2)
            await contractInstance.pushListText(entityId, key, text3)
            await contractInstance.pushListText(entityId, key, text4)
            await contractInstance.pushListText(entityId, key, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)
        })

        it("Should allow to update elements from a list", async () => {
            const key = "list-2"
            let text1 = "Some text here"
            let text2 = "Some more there"
            let text3 = ""
            let text4 = "The last one was empty"
            let text5 = "..."

            await contractInstance.pushListText(entityId, key, text1)
            await contractInstance.pushListText(entityId, key, text2)
            await contractInstance.pushListText(entityId, key, text3)
            await contractInstance.pushListText(entityId, key, text4)
            await contractInstance.pushListText(entityId, key, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)

            text1 = "A new value here"
            text2 = "changing things"
            text3 = "changing more things"
            text4 = "still, a new string"
            text5 = "finally, some more text"

            await contractInstance.setListText(entityId, key, 0, text1)
            await contractInstance.setListText(entityId, key, 1, text2)
            await contractInstance.setListText(entityId, key, 2, text3)
            await contractInstance.setListText(entityId, key, 3, text4)
            await contractInstance.setListText(entityId, key, 4, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)
        })

        it("Should allow to remove elements from a list", async () => {
            const key = "list-1"
            let text1 = "string 1"
            let text2 = "string 2"
            let text3 = "str 3"
            let text4 = "text 4"
            let text5 = "and 5"

            await contractInstance.pushListText(entityId, key, text1)
            await contractInstance.pushListText(entityId, key, text2)
            await contractInstance.pushListText(entityId, key, text3)
            await contractInstance.pushListText(entityId, key, text4)
            await contractInstance.pushListText(entityId, key, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])

            // await contractInstance

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)

            text1 = "A new value here"
            text2 = "changing things"
            text3 = "changing more things"
            text4 = "still, a new string"
            text5 = "finally, some more text"

            await contractInstance.setListText(entityId, key, 0, text1)
            await contractInstance.setListText(entityId, key, 1, text2)
            await contractInstance.setListText(entityId, key, 2, text3)
            await contractInstance.setListText(entityId, key, 3, text4)
            await contractInstance.setListText(entityId, key, 4, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)
        })

        it("Should allow to use any arbitrary key", async () => {
            let key = "list-1"
            const text1 = "string 1"
            const text2 = "string 2"
            const text3 = "str 3"
            const text4 = "text 4"
            const text5 = "and 5"

            await contractInstance.pushListText(entityId, key, text1)
            await contractInstance.pushListText(entityId, key, text2)
            await contractInstance.pushListText(entityId, key, text3)
            await contractInstance.pushListText(entityId, key, text4)
            await contractInstance.pushListText(entityId, key, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])

            key = "a-totally-random-long-key-here"

            await contractInstance.pushListText(entityId, key, text1)
            await contractInstance.pushListText(entityId, key, text2)
            await contractInstance.pushListText(entityId, key, text3)
            await contractInstance.pushListText(entityId, key, text4)
            await contractInstance.pushListText(entityId, key, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)
        })

        it("Should support UTF8 string lists", async () => {
            const key = "list-1"
            const text1 = "àèìòùçäëïöü"
            const text2 = "👍💛🔊🎉"
            const text3 = "🐱🐶🐭🦊🐼"
            const text4 = "法院的十六名法官吃了被绞死的肝脏"
            const text5 = "أكل ستة عشر قاضيا محكمة معلقة الكبد"

            await contractInstance.pushListText(entityId, key, text1)
            await contractInstance.pushListText(entityId, key, text2)
            await contractInstance.pushListText(entityId, key, text3)
            await contractInstance.pushListText(entityId, key, text4)
            await contractInstance.pushListText(entityId, key, text5)

            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)
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

            await contractInstance.pushListText(entityId, key, text1)
            await contractInstance.pushListText(entityId, key, text2)
            await contractInstance.pushListText(entityId, key, text3)
            await contractInstance.pushListText(entityId, key, text4)
            await contractInstance.pushListText(entityId, key, text5)

            // string comparison
            expect(await contractInstance.list(entityId, key)).to.deep.equal([text1, text2, text3, text4, text5])
            expect(await contractInstance.listText(entityId, key, 0)).to.equal(text1)
            expect(await contractInstance.listText(entityId, key, 1)).to.equal(text2)
            expect(await contractInstance.listText(entityId, key, 2)).to.equal(text3)
            expect(await contractInstance.listText(entityId, key, 3)).to.equal(text4)
            expect(await contractInstance.listText(entityId, key, 4)).to.equal(text5)

            // JSON comparison
            const val = (await contractInstance.list(entityId, key)).map(v => JSON.parse(v))
            expect(val).to.deep.equal([value1, value2, value3, value4, value5])
            expect(JSON.parse(await contractInstance.listText(entityId, key, 0))).to.deep.equal(value1)
            expect(JSON.parse(await contractInstance.listText(entityId, key, 1))).to.deep.equal(value2)
            expect(JSON.parse(await contractInstance.listText(entityId, key, 2))).to.deep.equal(value3)
            expect(JSON.parse(await contractInstance.listText(entityId, key, 3))).to.deep.equal(value4)
            expect(JSON.parse(await contractInstance.listText(entityId, key, 4))).to.deep.equal(value5)
        })

    })

    describe("Metadata validator", () => {
        it("Should accept a valid Entity Metadata JSON", () => {
            const entityMetadata = fs.readFileSync(__dirname + "/../../example/entity-metadata.json")

            expect(() => {
                checkValidEntityMetadata(JSON.parse(entityMetadata))
            }).to.not.throw
        })

        it("Should reject invalid Entity Metadata JSON payloads", () => {
            // Totally invalid
            expect(() => {
                const payload = JSON.parse('{"test": 123}')
                checkValidEntityMetadata(payload)
            }).to.throw

            expect(() => {
                const payload = JSON.parse('{"name": {"default": "hello", "fr": "Alô"}}')
                checkValidEntityMetadata(payload)
            }).to.throw

            // Incomplete fields
            const entityMetadata = fs.readFileSync(__dirname + "/../../example/entity-metadata.json")

            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { version: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { languages: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { name: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { description: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { votingContract: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { votingProcesses: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { newsFeed: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { avatar: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { actions: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { gatewayBootNodes: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { gatewayUpdate: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { bootEntities: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { fallbackBootNodeEntities: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { trustedEntities: null })) }).to.throw
            expect(() => { checkValidEntityMetadata(Object.assign({}, entityMetadata, { censusServiceManagedEntities: null })) }).to.throw

        })
    })
})
