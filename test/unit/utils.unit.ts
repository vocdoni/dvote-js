import { assert } from "chai";
import { Utils } from "../../src";

describe("Utils", () => {
    it("#String to Bytes32 convertion", () => {

        const strYes: string = "Yes";
        const bytes32Yes: string = "0x5965730000000000000000000000000000000000000000000000000000000000";

        const bytes32 = Utils.stringToBytes32(strYes)
        assert.equal(bytes32, bytes32Yes)
        assert.lengthOf(bytes32, 66)

        const str = Utils.bytes32ToString(bytes32Yes)
        assert.equal(str, strYes)

        const expectedPrefix = "0x"
        const prefix = bytes32.substring(0, 2)
        assert.equal(prefix, expectedPrefix)
    })

    it("#String fits into Bytes32 check", () => {

        const str32: string = "12345678901234567890123456789012";
        const fits32 = Utils.stringFitsInBytes32(str32)
        assert.isTrue(fits32)

        const str33: string = "123456789012345678901234567890123";
        const fits33 = Utils.stringFitsInBytes32(str33)
        assert.isFalse(fits33)
    })

});
