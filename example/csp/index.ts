import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import { type } from "os"

import { getConfig } from "./config"
import { CspAuthentication, CspIndexer } from "@vocdoni/csp"
import { CSP, CspAuthenticationType } from "@vocdoni/client"
import { ProcessMetadata } from "@vocdoni/data-models"
import { Wallet } from "@ethersproject/wallet"
import { ProcessContractParameters } from "@vocdoni/contract-wrappers"
import { connectGateways } from "./net"
import { ensureEntityMetadata } from "./entity"
import { waitUntilPresent, waitUntilStarted } from "./util"
import { checkVoteResults, launchNewVote, submitVotes } from "./voting"
import { ensure0x, strip0x } from "@vocdoni/common"
import * as axios from "axios"


import * as  readline from "readline"
import { VotingApi } from "@vocdoni/voting"
import { use } from "chai"
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})
const question = (query: string) => new Promise((resolve) => rl.question(query, resolve))


type smsUser = {
    userID: string
    elections?: [
        {
            electionId: string
            remainingAttempts: number
            consumed: boolean
        }
    ]
    extraData: string
    phone: object
}

const config = getConfig()

async function main() {

    // Connect to a GW
    const gwPool = await connectGateways()
    // // const entityWallet = Wallet.fromMnemonic(config.mnemonic, config.ethPath).connect(gwPool.provider)
    const entityWallet = (new Wallet(config.privateKey)).connect(gwPool.provider)


    console.log("Entity ID", entityWallet.address)


    // let electionId = "41a4331ada2399b41664314ec5ab1047f16510bd74f208d59d3fa01315751f83"
    // let processParams = await VotingApi.getProcessContractParameters("0x"+electionId, gwPool)
    // let processMetadata = await VotingApi.getProcessMetadata("0x"+electionId, gwPool)

    await ensureEntityMetadata(entityWallet, gwPool)


    let electionId: string
    let processParams: ProcessContractParameters
    let processMetadata: ProcessMetadata





    // if (config.readExistingProcess) {
    //     console.log("Reading process metadata")
    //     const procInfo: { processId: string, processMetadata: ProcessMetadata } = JSON.parse(readFileSync(config.processInfoFilePath).toString())
    //     processId = procInfo.processId
    //     processMetadata = procInfo.processMetadata

    // processParams = await VotingApi.getProcessContractParameters(processId, gwPool)

    //     assert(processId)
    //     assert(processMetadata)
    // }
    // else {
    // Create a new voting process
    const result = await launchNewVote(config.cspPublicKey, config.cspUri, entityWallet, gwPool)
    electionId = result.processId
    processParams = result.processParams
    processMetadata = result.processMetadata
    assert(electionId)
    assert(processParams)
    assert(processMetadata)
    writeFileSync(config.processInfoFilePath, JSON.stringify({ electionId, processMetadata }, null, 2))
    // }

    await waitUntilPresent(electionId, gwPool)

    console.log("- Entity Addr", processParams.entityAddress)
    console.log("- Process ID", electionId)
    console.log("- Process start block", processParams.startBlock)
    console.log("- Process end block", processParams.startBlock + processParams.blockCount)
    console.log("- Process merkle root", processParams.censusRoot)
    console.log("- Process merkle tree", processParams.censusUri)

    await waitUntilStarted(electionId, processParams.startBlock, gwPool)


    const userId = "23e4851990b1bdb313c3bae2e37e1a4c19f8519550561de30b38a413e45c22d8"
    let smsApiToken = String(await question('SMS API Bearer Token?\n'))
    const userInfo: smsUser = (await axios.default.get(config.cspUri + '/smsapi/user/' + userId, { headers: { "Authorization": "Bearer " + smsApiToken, responseType: "json" } })).data
    let userElectionInfo = userInfo.elections?.find(x => x.electionId == strip0x(electionId))
    if (!userElectionInfo) {
        console.log(`Adding election ${electionId} to user ${userId}`)
        const response = (await axios.default.get(config.cspUri + '/smsapi/addElection/' + userId + '/' + strip0x(electionId), { headers: { "Authorization": "Bearer " + smsApiToken, responseType: "json" } })).data
        console.log(response)
        if (response['ok'] != "true") {
            console.error("Could not add Election to user")
            process.exit(1)
        }
        console.log(`Remaining SMS attempts: 5`)
    } else {
        console.log(`Remaining SMS attempts: ${userElectionInfo.remainingAttempts}`)
    }



    const authType: CspAuthenticationType = "blind"
    let csp = new CSP(config.cspUri, config.cspPublicKey, config.cspApiVersion)
    console.log("asking indexer")
    console.log("Starting autentication")
    const authResp1 = await CspAuthentication.authenticate(authType, [userId], "", 0, electionId, csp)
    console.log(JSON.stringify(authResp1, null, 2))
    assert(authResp1.authToken)
    let otp = String(await question('SMS OTP?\n'))
    const authResp2 = await CspAuthentication.authenticate(authType, [otp], authResp1.authToken as string, 1, electionId, csp)
    console.log(JSON.stringify(authResp2, null, 2))
    assert(authResp2.token)

    await submitVotes(authResp2.token, electionId, processParams, processMetadata, gwPool, csp)

    await checkVoteResults(ensure0x(electionId), processParams, entityWallet, gwPool)



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




    // let smsApiToken = String(await question('SMS API Bearer Token?\n'))
    // const response = (await axios.default.post(config.cspUri+'/smsapi/newUser/293e73c9b9f3d12a0296b6b437a7db46e435bd64bf2543691159c85afd6e778d',
    //     {"phone":"+34632858121","extra":"Fake Manos"},
    //     {headers: {"Authorization": "Bearer "+smsApiToken, responseType:"json" }})).data
    // if (response['ok'] != true) {
    //     console.error("Could not add user")
    //     process.exit(1)
    // }
    // const userInfo: smsUser = (await axios.default.get(config.cspUri+'/smsapi/user/293e73c9b9f3d12a0296b6b437a7db46e435bd64bf2543691159c85afd6e778d', {headers: {"Authorization": "Bearer "+smsApiToken, responseType:"json" }})).data
    // console.log(userInfo)


    // indexer

// sms, si has votado


// auth/blind/0

// req
// userid = hash(clauSoci + pin), processid


// resp
// authToken


// auth/blind/1

// req
// authToken

// polling



// auth/blind/2

// resp
// OTP,

// signature
