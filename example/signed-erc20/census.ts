import { utils, Wallet } from "ethers"
import { getConfig } from "./config"

const config = getConfig()

export type TestAccount = {
    idx: number,
    privateKey: string
    publicKey: string
}

export function getAccounts() {
    const accounts = config.privKeys.map((key, i) => {
        const wallet = new Wallet(key)
        return {
            idx: i,
            privateKey: key,
            publicKey: utils.computePublicKey(wallet.publicKey, true)
        }
    })

    console.log()
    return accounts
}
