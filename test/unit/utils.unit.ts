import { assert } from "chai"
import { Utils } from "../../src"

describe("Utils", () => {
    it("#String to Bytes32 convertion", () => {

        const strYes = "Yes"
        const expectedBytes32Yes = "0x5965730000000000000000000000000000000000000000000000000000000000"

        const actualBytes32 = Utils.stringToBytes32(strYes)
        assert.equal(actualBytes32, expectedBytes32Yes)
        assert.lengthOf(actualBytes32, 66)

        const actualStrYes = Utils.bytes32ToString(expectedBytes32Yes)
        assert.equal(actualStrYes, strYes)

        const expectedPrefix = "0x"
        const actualPrefix = actualBytes32.substring(0, 2)
        assert.equal(actualPrefix, expectedPrefix)

        /*
        const strEmoji = "😃"
        const expetedBytes32Emoji = "0xd83dde0300000000000000000000000000000000000000000000000000000000"
        const actualBytes32Emoji = Utils.stringToBytes32(strEmoji)
        assert.equal(actualBytes32Emoji, expetedBytes32Emoji)
        */
    })

    it("#Bytes32 to String convertion", () => {

        const bytes32Yes = "0x5965730000000000000000000000000000000000000000000000000000000000"
        const expectedStrYes = "Yes"
        const actualStrYes = Utils.bytes32ToString(bytes32Yes)
        assert.equal(actualStrYes, expectedStrYes)

        /*
        const bytes32Emoji = "0xd83dde0300000000000000000000000000000000000000000000000000000000"
        const expectedStrEmoji = "😃"
        const actualStrEmoji = Utils.bytes32ToString(bytes32Emoji)
        assert.equal(actualStrEmoji, expectedStrEmoji)
        */
    })

    it("#String fits into Bytes32 check", () => {

        const str32: string = "12345678901234567890123456789012"
        const fits32 = Utils.stringFitsInBytes32(str32)
        assert.isTrue(fits32)

        const str33: string = "123456789012345678901234567890123"
        const fits33 = Utils.stringFitsInBytes32(str33)
        assert.isFalse(fits33)
    })

})
