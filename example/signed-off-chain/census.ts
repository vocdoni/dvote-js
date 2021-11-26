import { utils, Wallet } from "ethers"
import * as assert from "assert"
import { CensusOffChain, CensusOffChainApi } from "@vocdoni/census"
import { getConfig } from "./config"
import { IGatewayClient } from "@vocdoni/client"

const config = getConfig()

export type TestAccount = {
    idx: number,
    mnemonic: string
    privateKey: string
    publicKey: string
    publicKeyEncoded: string
}

export function createWallets(amount: number) {
    console.log("Creating", amount, "wallets")
    const accounts = []
    for (let i = 0; i < amount; i++) {
        if (i % 50 == 0) process.stdout.write("Wallet " + i + " ; ")
        const wallet = Wallet.createRandom()
        accounts.push({
            idx: i,
            mnemonic: wallet.mnemonic.phrase,
            privateKey: wallet.privateKey,
            publicKey: utils.computePublicKey(wallet.publicKey, true),
            publicKeyEncoded: CensusOffChain.Public.encodePublicKey(wallet.publicKey)
            // address: wallet.address
        })
    }

    console.log()
    return accounts
}

export async function generatePublicCensusFromAccounts(accounts: TestAccount[], entityWallet: Wallet, gwPool: IGatewayClient) {
    // Create new census
    console.log("Creating a new census")

    const censusIdSuffix = require("crypto").createHash('sha256').update("" + Date.now()).digest().toString("hex")
    const claimList: { key: string, value?: string }[] = accounts.map(account => ({ key: account.publicKeyEncoded, value: "" }))
    const managerPublicKeys = [utils.computePublicKey(entityWallet.publicKey, true)]

    if (config.stopOnError) {
        assert(censusIdSuffix.length == 64)
        assert(Array.isArray(claimList))
        assert(claimList.length == config.numAccounts)
        assert(Array.isArray(managerPublicKeys))
        assert(managerPublicKeys.length == 1)
    }

    // Adding claims
    console.log("Registering the new census to the Census Service")

    const { censusId } = await CensusOffChainApi.addCensus(censusIdSuffix, managerPublicKeys, entityWallet, gwPool)

    console.log("Adding", claimList.length, "claims")
    const { invalidClaims, censusRoot } = await CensusOffChainApi.addClaimBulk(censusId, claimList, false, entityWallet, gwPool)

    if (invalidClaims.length > 0) throw new Error("Census Service invalid claims count is " + invalidClaims.length)

    // Publish the census
    console.log("Publishing the new census")
    const censusUri = await CensusOffChainApi.publishCensus(censusId, entityWallet, gwPool)

    // Check that the census is published
    const exportedMerkleTree = await CensusOffChainApi.dumpPlain(censusId, entityWallet, gwPool)
    if (config.stopOnError) {
        assert(Array.isArray(exportedMerkleTree))
        assert(exportedMerkleTree.length == config.numAccounts)
    }

    // Return the census ID / Merkle Root
    return {
        censusUri,
        censusRoot
    }
}
