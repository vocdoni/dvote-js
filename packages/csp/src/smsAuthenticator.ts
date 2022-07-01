import { CspAuthenticationStep, CspAuthenticationType, ICsp } from "@vocdoni/client"
import { CspAuthentication } from "./authentication-calls"
import { Keccak256 } from "@vocdoni/hashing"
import { CspIndexer } from "./indexer-calls"
import { strip0x } from "@vocdoni/common"
import { CspSignatures } from "@vocdoni/csp"
import { Wallet } from "@ethersproject/wallet"
import { IProofCA } from "@vocdoni/data-models";



export namespace CspSMSAuthenticator {

    export enum CspSmsAuthenticatorSteps {
        GET_PROCESS = "gotProcess",
        GET_AUTH_TOKEN = "gotAuthToken",
        GET_TOKENR = "gotTokenr",
        GET_PROOF = "gotProof"
    }

    const authType: CspAuthenticationType = "blind"

    export type CSPAuthGeneratorStepValue =
        { key: CspSmsAuthenticatorSteps.GET_PROCESS, electionId: string, remainingAttemps: number, consumed: boolean } |
        { key: CspSmsAuthenticatorSteps.GET_AUTH_TOKEN, authToken: string, phoneSuffix: string } |
        { key: CspSmsAuthenticatorSteps.GET_TOKENR, token: string } |
        { key: CspSmsAuthenticatorSteps.GET_PROOF, proof: IProofCA }


    export async function* authenticate(userId: string, csp: ICsp, wallet: Wallet ): AsyncGenerator<CSPAuthGeneratorStepValue> {
        if (!csp) return Promise.reject(new Error("Invalid CSP object"))
        let electionId: string
        try {
            if (!userId) return Promise.reject(new Error("Invalid User ID"))
            let processes = await CspIndexer.getUserProcesses(strip0x(userId), csp)
            if (processes.length != 1) return Promise.reject(new Error("No process found for user"))
            electionId = processes[0]["electionId"]
            console.log(electionId)
            yield { key: CspSmsAuthenticatorSteps.GET_PROCESS,
                    electionId,
                    remainingAttemps: processes[0]["remainingAttempts"],
                    consumed: processes[0]["consumed"] }

            const authResp1 = await CspAuthentication.authenticate(authType, [userId], "", 0, electionId, csp)
            if (!("authToken" in authResp1) || !("response" in authResp1)) {
                let err =  ("error" in authResp1) ? authResp1.error :"Could not authenticate user"
                return Promise.reject(new Error(err))
            }
            let authOTP = (yield { key: CspSmsAuthenticatorSteps.GET_AUTH_TOKEN, authToken: authResp1.authToken, phoneSuffix: authResp1.response[0] }) as string

            const authResp2 = await CspAuthentication.authenticate(authType, [authOTP], authResp1.authToken , 1, electionId, csp)
            if (!authResp2.token) {
                return Promise.reject(new Error("Could not authenticate with OTP"))
            }
            yield { key: CspSmsAuthenticatorSteps.GET_TOKENR, token: authResp2.token }
            const { hexBlinded: blindedPayload, userSecretData } = CspSignatures.getBlindedPayload(electionId, authResp2.token, wallet)

            const blindSignature = await CspSignatures.getSignature("blind", blindedPayload, authResp2.token, electionId, csp)
            const proof = CspSignatures.getProofFromBlindSignature(blindSignature, userSecretData, wallet)
            yield { key: CspSmsAuthenticatorSteps.GET_PROOF, proof }
            return

        } catch (error) {
            return Promise.reject(error)
        }

    }

}
