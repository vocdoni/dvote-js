import { ICsp } from "@vocdoni/client"

export namespace CspIndexer {

    export type IndexerResponse =  [{
            electionId: string
            remainingAttempts: number
            consumed: boolean
        }]

    /**
    * Asks the CSP to which elections a user ID participates to create a new census and set the given public key as the ones who can manage it
    * @param userId  The user identifier
    * @param csp A CSP instance
    * @returns Promise with list of the correspondign election IDs
    */
     export async function getUserProcesses(userId: string, csp: ICsp): Promise<IndexerResponse> {
        if (!userId) return Promise.reject(new Error("Invalid user Id"))
        else if (!csp) return Promise.reject(new Error("Invalid CSP object"))

        return CspIndexer.getUserInfo(userId, csp)
            .then(userInfo => {
                if (!('elections' in userInfo)) throw new Error('Invalid csp response')
                return userInfo.elections as IndexerResponse
            });
    }

    /**
    * Asks the CSP a user ID information
    * @param userId  The user identifier
    * @param csp A CSP instance
    * @returns Promise with info of the user
    */
     export async function getUserInfo(userId: string, csp: ICsp) {
        if (!userId) return Promise.reject(new Error("Invalid user Id"))
        else if (!csp) return Promise.reject(new Error("Invalid CSP object"))

        return csp.sendRequest(
            `/auth/elections/indexer/${userId}`,
            {},{})
            .then((response) => response)
            .catch((error) => {
                const message = (error.message) ? "Error retrieving user info: " + error.message : "Error retrieving user info"
                throw new Error(message)
            })
    }
}
