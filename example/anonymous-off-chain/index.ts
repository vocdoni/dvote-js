import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import { ProcessMetadata } from "@vocdoni/data-models"
import { VotingApi } from "@vocdoni/voting"
import { Wallet } from "@ethersproject/wallet"
import { ProcessContractParameters } from "@vocdoni/contract-wrappers"
import { getConfig } from "./config"
import { connectGateways } from "./net"
import { ensureEntityMetadata } from "./entity"
import { createWallets, generatePublicCensusFromAccounts, TestAccount } from "./census"
import { waitUntilPresent, waitUntilStarted } from "./util"
import { checkVoteResults, launchNewVote, registerVoterKeys, submitVotes } from "./voting"

const config = getConfig()

async function main() {
    let processId: string
    let processParams: ProcessContractParameters
    let processMetadata: ProcessMetadata
    let accounts: TestAccount[]

    // Connect to a GW
    const gwPool = await connectGateways()
    const entityWallet = Wallet.fromMnemonic(config.mnemonic, config.ethPath).connect(gwPool.provider)
    console.log("Entity ID", entityWallet.address)

    if (config.readExistingAccounts) {
        console.log("Reading account list")
        accounts = JSON.parse(readFileSync(config.accountListFilePath).toString())

        await ensureEntityMetadata(entityWallet, gwPool)
    }
    else {
        console.log("Creating from scratch")

        accounts = createWallets(config.numAccounts)
        assert(accounts && accounts.length)

        await ensureEntityMetadata(entityWallet, gwPool)

        // Write them to a file
        writeFileSync(config.accountListFilePath, JSON.stringify(accounts, null, 2))
    }

    if (config.readExistingProcess) {
        console.log("Reading process metadata")
        const procInfo: { processId: string, processMetadata: ProcessMetadata } = JSON.parse(readFileSync(config.processInfoFilePath).toString())
        processId = procInfo.processId
        processMetadata = procInfo.processMetadata

        processParams = await VotingApi.getProcessContractParameters(processId, gwPool)

        assert(processId)
        assert(processMetadata)

        await waitUntilPresent(processId, gwPool)
    }
    else {
        // Generate and publish the census
        // Get the merkle root and IPFS origin of the Merkle Tree
        console.log("Publishing census")
        const { censusRoot, censusUri } = await generatePublicCensusFromAccounts(accounts, entityWallet, gwPool)

        // Create a new voting process
        const result = await launchNewVote(censusRoot, censusUri, entityWallet, gwPool)
        processId = result.processId
        processParams = result.processParams
        processMetadata = result.processMetadata
        assert(processId)
        assert(processParams)
        assert(processMetadata)
        writeFileSync(config.processInfoFilePath, JSON.stringify({ processId, processMetadata }, null, 2))

        await waitUntilPresent(processId, gwPool)

        await registerVoterKeys(processId, processParams, accounts, gwPool)
    }

    console.log("- Entity Addr", processParams.entityAddress)
    console.log("- Process ID", processId)
    console.log("- Process start block", processParams.startBlock)
    console.log("- Process end block", processParams.startBlock + processParams.blockCount)
    console.log("- Process merkle root", processParams.censusRoot)
    console.log("- Process merkle tree", processParams.censusUri)
    console.log("-", accounts.length, "accounts on the census")

    await waitUntilStarted(processId, processParams.startBlock, gwPool)

    const processState = await VotingApi.getProcessState(processId, gwPool)

    await submitVotes(processId, processState, processMetadata, accounts, gwPool)

    await checkVoteResults(processId, processParams, entityWallet, gwPool)
}

/////////////////////////////////////////////////////////////////////////////
// MAIN
/////////////////////////////////////////////////////////////////////////////

main()
    .then(() => {
        console.log("Done")
        process.exit(0)
    })
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
