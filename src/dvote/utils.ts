import Web3 = require("web3");

export default class Utils {

    public static stringToBytes32 = (str: string): string => {
        const hex = Web3.utils.asciiToHex(str)
        const bytes32 = Web3.utils.padRight(hex, 64)
        return bytes32
    }

    public static bytes32ToString = (bytes32: string): string => {
        const str = Web3.utils.hexToUtf8(bytes32)
        return str
    }

    public static stringFitsInBytes32 = (str: string): boolean => {

        const hex = Web3.utils.asciiToHex(str)
        return Utils.hexFitsInBytes32(hex)
    }

    public static hexFitsInBytes32 = (hex: string): boolean => {
        // Assumes presiding "0x"
        const size = hex.length
        const fits = size <= 66
        return fits
    }
}
