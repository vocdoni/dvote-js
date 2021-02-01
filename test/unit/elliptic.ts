import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { compressPublicKey, expandPublicKey } from "../../src/util/elliptic"

addCompletionHooks()

describe("Public key", () => {
    const items = [
        {
            compressed: '0x02ab1a7f0cb763c4a8b30a2b8e3d0324e8db5cf2d25e906cae400ae7265083e7e2',
            expanded: '0x04ab1a7f0cb763c4a8b30a2b8e3d0324e8db5cf2d25e906cae400ae7265083e7e20a7e6a0e1bf47f7d5280952b80b5fe9d380189243219518b7c62e57f68ed1c66'
        },
        {
            compressed: '0x02531645fa5df607f2016070c12dd559d4a72a1acf61f2d499eb470a9aa42ebd17',
            expanded: '0x04531645fa5df607f2016070c12dd559d4a72a1acf61f2d499eb470a9aa42ebd1765cae6e30245c4e742a158bc038dd93d90bb61298a4108219a41c74d24a90fc4'
        },
        {
            compressed: '0x024014610da034308afe245ff6a120e5e4c8f6f7a07a69b966e46d1e1ccf320d6b',
            expanded: '0x044014610da034308afe245ff6a120e5e4c8f6f7a07a69b966e46d1e1ccf320d6b6985c44c37468b587e1632aa12efab216992ffb2e577dbe50593c6cae07b02b2'
        },
        {
            compressed: '0x0260c8ffa4cf0d52a2069a4d47f59b8fe0b8dd469bed2cf98196c53b1f5327d071',
            expanded: '0x0460c8ffa4cf0d52a2069a4d47f59b8fe0b8dd469bed2cf98196c53b1f5327d071cb9495b461863a583fcda564e245e7504d8f304dbb10f62870cdd6ef8befc7fe'
        },
        {
            compressed: '0x02dd06d88f8777da2a250920456df44c7eca71f7b3d9f18c0101d06a3e6d09a382',
            expanded: '0x04dd06d88f8777da2a250920456df44c7eca71f7b3d9f18c0101d06a3e6d09a382b9e8c3fe821df14d6dddd77a49ed47d9b55f680323eb2e3b5a319cf14caddafe'
        },
        {
            compressed: '0x02ca8f91c36ac0a4a08f77849079584d5a3d35c6baafc92762c1e1cd8967b87967',
            expanded: '0x04ca8f91c36ac0a4a08f77849079584d5a3d35c6baafc92762c1e1cd8967b879674bd320cc2e6a4693f6297b8e5b2f00a1bdf5d4b4f392834f8dfe0dacc74f326a'
        },
        {
            compressed: '0x0363ebf3ac245f883bc392a6df47fef9058f6408dd67d2a5d51c307bb66f35945a',
            expanded: '0x0463ebf3ac245f883bc392a6df47fef9058f6408dd67d2a5d51c307bb66f35945a046f785eb9bf177eeff87ca57a559620fc995fd2f613326dab9dcb02618d768d'
        }
    ]

    it("Should compress publickeys", () => {
        items.forEach(item => {
            expect(compressPublicKey(item.expanded)).to.eq(item.compressed)
        })
    })

    it("Should compress publickeys", () => {
        items.forEach(item => {
            expect(expandPublicKey(item.compressed)).to.eq(item.expanded)
        })
    })
})
