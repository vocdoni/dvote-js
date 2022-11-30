import { ICsp } from "@vocdoni/client"

export namespace CspIndexer {

    export type IndexerResponse =  [{
            electionId: string
            remainingAttempts: number
            consumed: boolean
            extra: [string]
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

            return csp.sendRequest(
                `/auth/elections/indexer/${userId}`,
                {},{})
                .then((response) => {
                    if (!('elections' in response)) throw new Error('Invalid csp response')
                    return response.elections as IndexerResponse
                })
                .catch((error) => {
                    const message = (error.message) ? "Error retrieving user's process: " + error.message : "Error retrieving user's process:"
                    throw new Error(message)
                })
        }
}
