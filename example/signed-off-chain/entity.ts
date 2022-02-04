import * as assert from "assert"
import { Wallet } from "@ethersproject/wallet"
import { EntityApi } from "@vocdoni/voting"
import { IGatewayClient } from "@vocdoni/client"
import { EntityMetadata, EntityMetadataTemplate } from "@vocdoni/data-models"

export async function ensureEntityMetadata(entityWallet: Wallet, gwPool: IGatewayClient) {
    if ((await entityWallet.getBalance()).eq(0)) {
        throw new Error("The account has no ether")
    }

    const meta = await EntityApi.getMetadata(entityWallet.address, gwPool).catch(() => null)
    if (!!meta) return // already present

    console.log("Setting Metadata for entity", entityWallet.address)

    const metadata: EntityMetadata = JSON.parse(JSON.stringify(EntityMetadataTemplate))

    metadata.name = { default: "Test Organization Name" }
    metadata.description = { default: "Description of the test organization goes here" }
    metadata.media = {
        avatar: "0123",
        header: "1234",
        logo: "2345"
    }

    await EntityApi.setMetadata(entityWallet.address, metadata, entityWallet, gwPool)
    console.log("Metadata updated")

    // Read back
    const entityMetaPost = await EntityApi.getMetadata(entityWallet.address, gwPool)

    assert(entityMetaPost)
    assert.strictEqual(entityMetaPost.name.default, metadata.name.default)
    assert.strictEqual(entityMetaPost.description.default, metadata.description.default)

    return entityMetaPost
}
