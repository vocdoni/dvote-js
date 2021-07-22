import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { ContentUri } from "../../src/wrappers/content-uri"
import { ContentHashedUri } from "../../src/wrappers/content-hashed-uri"
import { GatewayInfo } from "../../src/wrappers/gateway-info"

addCompletionHooks()

describe("Wrappers", () => {
    describe("Content URI", () => {
        it("Should create a Content URI from a String", () => {
            const curi = new ContentUri("ipfs://1234,https://server/file,http://server/file")

            expect(curi.items.length).to.equal(3)
            expect(curi.items[0]).to.eq("ipfs://1234")
            expect(curi.items[1]).to.eq("https://server/file")
            expect(curi.items[2]).to.eq("http://server/file")
            expect(curi.ipfsHash).to.equal("1234")
            expect(curi.httpsItems).to.deep.equal(["https://server/file"])
            expect(curi.httpItems).to.deep.equal(["http://server/file"])
        })

        it("Should fail if the URL is empty", () => {
            expect(() => {
                new ContentUri("")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw
        })
    })

    describe("Content Hashed URI", () => {
        it("Should extend the functionality of a Content URI", () => {
            const curi = new ContentHashedUri("ipfs://1234,https://server/file,http://server/file")

            expect(curi.items.length).to.equal(3)
            expect(curi.items[0]).to.eq("ipfs://1234")
            expect(curi.items[1]).to.eq("https://server/file")
            expect(curi.items[2]).to.eq("http://server/file")
            expect(curi.ipfsHash).to.equal("1234")
            expect(curi.httpsItems).to.deep.equal(["https://server/file"])
            expect(curi.httpItems).to.deep.equal(["http://server/file"])
        })

        it("Should fail if more than one ! symbol is present", () => {
            expect(() => {
                new ContentUri("ipfs://1234,https://server/file,http://server/file!1234!5678")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw
        })

        it("Should provide the hash of a hashed Uri", () => {
            const curi = new ContentHashedUri("ipfs://1234,https://server/file,http://server/file!12345678")

            expect(curi.items.length).to.equal(3)
            expect(curi.items[0]).to.eq("ipfs://1234")
            expect(curi.items[1]).to.eq("https://server/file")
            expect(curi.items[2]).to.eq("http://server/file")
            expect(curi.ipfsHash).to.equal("1234")
            expect(curi.httpsItems).to.deep.equal(["https://server/file"])
            expect(curi.httpItems).to.deep.equal(["http://server/file"])
            expect(curi.hash).to.equal("12345678")
        })

        it("Should allow to hash properly", () => {
            const str1 = "Hello world"
            const str2 = "I am a string to be hashed"
            let hash1, hash2

            // no hash yet
            const curi = new ContentHashedUri("ipfs://1234,https://server/file,http://server/file")
            expect(curi.hash).to.equal(null)

            hash1 = ContentHashedUri.hashFrom(str1)
            hash2 = ContentHashedUri.hashFrom(str2)
            expect(hash1).to.equal("369183d3786773cef4e56c7b849e7ef5f742867510b676d6b38f8e38a222d8a2")
            expect(hash2).to.equal("9fa024c30ba0daaad55a84b75f48379c4751d191a7e8c5817d3aa8712eb37470")
            expect(hash1).to.not.equal(hash2)

            curi.setHashFrom(str1)
            expect(curi.hash).to.equal(hash1)

            curi.setHashFrom(str2)
            expect(curi.hash).to.equal(hash2)

            // Buffer
            expect(ContentHashedUri.hashFrom(Buffer.from(str1))).to.equal(hash1)
            expect(ContentHashedUri.hashFrom(Buffer.from(str2))).to.equal(hash2)
        })
    })

    describe("Gateway Info", () => {
        it("Should create a Gateway Info from the URI's", () => {
            const curi = new GatewayInfo("wss://server/dvote", ["census", "file", "vote"], "https://server/web3")

            expect(curi.dvote).to.equal("wss://server/dvote")
            expect(curi.supportedApis).to.deep.equal(["census", "file", "vote"])
            expect(curi.web3).to.equal("https://server/web3")

            const curi2 = new GatewayInfo("wss://server2/dvote", ["vote"], "https://server2/web3")

            expect(curi2.dvote).to.equal("wss://server2/dvote")
            expect(curi2.supportedApis).to.deep.equal(["vote"])
            expect(curi2.web3).to.equal("https://server2/web3")
        })

        it("Should fail if a parameter is invalid", () => {
            expect(() => {
                new GatewayInfo("", ["census", "file", "vote"], "")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw

            expect(() => {
                new GatewayInfo("wss://server/dvote", null, "https://server/web3")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw

            expect(() => {
                let random: any = 1234
                new GatewayInfo(random, ["census", "file", "vote"], "")
                throw new Error("The function should have thrown an error but didn't")
            }).to.throw
        })
    })
})
