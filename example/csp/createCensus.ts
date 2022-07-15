import { keccak256 } from '@ethersproject/keccak256'
import { strip0x } from "@vocdoni/common"
import { getConfig } from "./config"
import * as axios from "axios"
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import { ElectionO } from './createProcesses'
import * as Bluebird from "bluebird"
import { assert } from 'console'


type userI = {
    ID: string
    hash: string
    agrupacio: string
    telefon: string
    soci22: string
    soci21: string
    dataNaix: string

}

const inelectionsFileName = "zonasProcesses.csv"
const inCensusFileName = "cens.csv"

function importInput(fileName): {}[] {
    const data = fs.readFileSync(__dirname + '/' + fileName,
        { encoding: 'utf8', flag: 'r' })
    const records = parse(data, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ":",
        encoding: "utf-8"

    })
    return records
}


const config = getConfig()
const smsApiToken = config.cspBearer




async function main() {

    const elections = importInput(inelectionsFileName)
    // console.log(elections)
    const subUs = importInput(inCensusFileName) as userI[]
    // console.log(subUs.length);

    // console.log(users)
    // const subUs = [users[18],users[19],users[20]]

    // const subUs = users.filter(x => Number(x.ID) <=886 )
    async function asyncForEach(array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }

    let errorIDs : string[] = []


    // create
    await asyncForEach(subUs, async (user: userI) => {
        // await new Promise(r => setTimeout(r, 1000 * Number(user.ID) % 10))
        try {

            console.log("Uploading user " + (user.ID) + " " + user.hash)
            // console.log(config.cspUri + '/smsapi/delUser/' + strip0x(user.hash))

            let responseDel = (await axios.default.get(config.cspUri + '/smsapi/delUser/' + strip0x(user.hash),
                { "headers": { "Authorization": "Bearer " + smsApiToken, responseType: "json" }, timeout: 3000 })).data
            if (responseDel['ok'] != "true") {
                console.error("Could not delete user")
                console.error("userID " + user.ID)
                process.exit(1)
            }

            // console.log(config.cspUri + '/smsapi/newUser/' + strip0x(user.hash))
            // console.log({
            //     "phone": user.telefon,
            //     "extra": `${user.soci21} ${user.soci22} ${user.telefon} ${user.dataNaix.split('/').reduceRight((a, b) => a + b)}`
            // })
            try {
                let response = (await axios.default.post(config.cspUri + '/smsapi/newUser/' + strip0x(user.hash),
                {
                    "phone": user.telefon,
                    "extra": `${user.soci21} ${user.soci22} ${user.telefon} ${user.dataNaix.split('/').reduceRight((a, b) => a + b)}`
                },
                { "headers": { "Authorization": "Bearer " + smsApiToken, responseType: "json" }, timeout: 3000 })).data

            } catch (error) {
                console.error("Could not add user:", JSON.stringify(user))
                console.error("userID " + user.ID)
                errorIDs.push(user.ID)
                let responseError = (await axios.default.post(config.cspUri + '/smsapi/newUser/' + strip0x(user.hash),
                {
                    "phone": "+34000000000",
                    "extra": `${user.soci21} ${user.soci22} ${user.telefon} ${user.dataNaix.split('/').reduceRight((a, b) => a + b)}`
                },
                { "headers": { "Authorization": "Bearer " + smsApiToken, responseType: "json" }, timeout: 3000 })).data
                console.log(responseError)
            }

            // if (response['ok'] != "true") {


            // }

            // console.log(config.cspUri + '/smsapi/user/' + strip0x(user.hash))

            // const userInfo = (await axios.default.get(config.cspUri + '/smsapi/user/' + strip0x(user.hash), { headers: { "Authorization": "Bearer " + smsApiToken, responseType: "json" } })).data
            // console.log(userInfo)
            const election = elections.find((x) => x['zona'] === user.agrupacio) as ElectionO
            if (!election) {
                console.error("ERROR: Couldn not find process")
                console.error("userID " + user.ID)
                process.exit(1)
            }

            // console.log(config.cspUri + '/smsapi/addElection/' + strip0x(user.hash) + '/' + strip0x(election.ID))

            let response1 = (await axios.default.get(config.cspUri + '/smsapi/addElection/' + strip0x(user.hash) + '/' + strip0x(election.ID), { headers: { "Authorization": "Bearer " + smsApiToken, responseType: "json" } })).data

            if (response1['ok'] != "true") {
                console.error("Could not add Election to user")
                console.error("userID " + user.ID)
                console.error("electionID " + election.ID)
                process.exit(1)
            }
            console.log("Done user " + (user.ID) + " " + user.hash)


        } catch (error) {
            console.error(error)
            process.exit(1)
        }
        // },{concurrency:6})
    })


    //verfiy
    for (const user of subUs) {
        try {
            console.log("check user ", user.ID)
            const userInfo = (await axios.default.get(config.cspUri + '/smsapi/user/' + strip0x(user["hash"]), { headers: { "Authorization": "Bearer " + smsApiToken, responseType: "json" } })).data
            const election = elections.find((x) => x['zona'] === user["agrupacio"]) as ElectionO
            assert(strip0x(election.ID) == Object.keys(userInfo["elections"])[0])
        } catch (error) {
            console.error(error)
            process.exit(1)
        }

    }

    console.log("Erroneous IDs: ", errorIDs);


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
