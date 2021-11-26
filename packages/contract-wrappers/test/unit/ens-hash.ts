import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { ensHashAddress } from "../../src"

addCompletionHooks()

describe("Entity Resolver", () => {
    it("Should allow to hash the entity's address", async () => {
        const data = [
            { address: "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1", node: "0xe7fb8f3e702fd22bf02391cc16c6b4bc465084468f1627747e6e21e2005f880e" },
            { address: "0xffcf8fdee72ac11b5c542428b35eef5769c409f0", node: "0x92eba8bf099a58b316e6c8743101585f4a71b45d87c571440553b6e74671ac5a" },
            { address: "0x22d491bde2303f2f43325b2108d26f1eaba1e32b", node: "0x9f225659836e74be7309b140ad0fee340ce09db633a8d42b85540955c987123b" },
            { address: "0xe11ba2b4d45eaed5996cd0823791e0c93114882d", node: "0xd6604a251934bff7fe961c233a6f8dbd5fb55e6e98cf893237c9608e746e2807" },
            { address: "0xd03ea8624c8c5987235048901fb614fdca89b117", node: "0xa6e02fa9ce046b7970daab05320d7355d28f9e9bc7889121b0d9d90b441f360c" },
            { address: "0x95ced938f7991cd0dfcb48f0a06a40fa1af46ebc", node: "0xee97003d4805070a87a8bd486f4894fbfce48844710a9b46df867f7f64f9a174" },
            { address: "0x3e5e9111ae8eb78fe1cc3bb8915d5d461f3ef9a9", node: "0xaca9367e5113a27f3873ddf78ada8a6af283849bb14cc313cadf63ae03ea52b3" },
            { address: "0x28a8746e75304c0780e011bed21c72cd78cd535e", node: "0xa17b99060235fa80368a12707574ab6381d0fc9aa7cb3a6a116d0f04564980fe" },
            { address: "0xaca94ef8bd5ffee41947b4585a84bda5a3d3da6e", node: "0xb1ec3484f6bdfce3b18264a4e83a5e99fc43641f8e15a3079a9e6872b5d6cace" },
            { address: "0x1df62f291b2e969fb0849d99d9ce41e2f137006e", node: "0x0c3a882b5cad48337e5a74659c514c6e0d5490bdc7ec8898d7d2a924da96c720" },
        ]

        for (let item of data) {
            expect(ensHashAddress(item.address)).to.equal(item.node)
        }
    })
})
