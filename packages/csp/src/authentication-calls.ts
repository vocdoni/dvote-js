import { ICsp, ICspRequestParameters, ICspResponseBody, CspAuthenticationType } from "@vocdoni/client"
import { strip0x } from "@vocdoni/common"


export namespace CspAuthentication {
    /**
    * Asks the CSP for the autentication steps information
    * @param processId The process ID
    * @param csp A CSP instance
    * @returns Promise with response containing process info and authentication steps
    */
    export async function getAuthenticationInfo(processId: string, csp: ICsp): Promise<ICspResponseBody> {
        if (!processId) return Promise.reject(new Error("Invalid process ID"))
        processId = strip0x(processId)
        if (processId.length != 64) return Promise.reject(new Error("Invalid process ID"))
        else if (!csp) return Promise.reject(new Error("Invalid CSP object"))

        return csp.sendRequest(
            `/auth/elections/${processId}/info`,
            {}, {})
            .then((response) => {
                return response
            })
            .catch((error) => {
                const message = (error.message) ? "The process info could not be retrieved: " + error.message : "The process info could not be retrieved"
                throw new Error(message)
            })
    }

    /**
    * Asks the CSP to validate the data of a step of the authentication process
    * @param authType Indicates the kind of signature is provided by the CSP
    * @param authData The data of the challenge required by the CSP to authenticate
    * @param authToken Is provided by the CSP in order to identify the client
    * in the following steps
    * @param authStep The current authentication step
    * @param processId The process ID
    * @param csp A CSP instance
    * @returns Promise with response containing possible an authToken, a `response`
    * if a next authentication step is needed, or the result of a succesfull authentication.
    * For more info see: https://github.com/vocdoni/blind-csp/blob/master/README.md
    */
    export async function authenticate(authType: CspAuthenticationType, authData: string[], authToken: string, authStep: number, processId: string, csp: ICsp): Promise<ICspResponseBody> {
        if (!processId) return Promise.reject(new Error("Invalid process ID"))
        processId = strip0x(processId)
        if (processId.length != 64) return Promise.reject(new Error("Invalid process ID"))
        else if (!csp) return Promise.reject(new Error("Invalid CSP object"))
        authData = authData.map(d => strip0x(d))

        const requestBody: ICspRequestParameters = {
            authData
        }
        if (authStep > 0 && authToken == null) return Promise.reject(new Error("Invalid authentication token"))
        if (authToken) {
            requestBody['authToken'] = authToken
        }
        let endpoint = `/auth/elections/${processId}`
        if (authType == "blind")
            endpoint = `${endpoint}/blind/auth/${String(authStep)}`
        else if (authType == "ecdsa")
            endpoint = `${endpoint}/ecdsa/auth/${String(authStep)}`
        else if (authType == "sharedkey")
            endpoint = `${endpoint}/sharedkey/${String(authStep)}`
        else
            Promise.reject(new Error("Invalid auth type"))

        return csp.sendRequest(
            endpoint,
            requestBody,
            {})
            .then((response) => {
                return response
            })
            .catch((error) => {
                console.log("Recibido en csp/authenticate", JSON.stringify(error, null, 2))

                let message: string
                if ("response" in error) {
                    message = "Authentication error: " + JSON.stringify(error["response"], null, 2)
                } else if ("message" in error) {
                    message = "Authentication error: " + error.message
                } else {
                    message = "Authentication error"
                }
                throw new Error(message)
            })
    }
}
