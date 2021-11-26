import * as React from 'react'
import { useState } from 'react'
import { VotingApi, EntityApi, ProcessDetails } from "@vocdoni/voting"
import { EntityMetadata } from "@vocdoni/data-models"
import { getClient } from "../lib/net"

const ENTITY_ID = "0x6047d71960cefbe27239a202e48dc7a76094fd6d"
const PROCESS_IDS = [
  "0x732493935542b276402ad380e905d5363df798e19342a4d59c057f02060de313",
  "0xb499d66d6262e76d35a596d05a8b2a5c53a04431d71be767ab0d39b71c1d7ceb",
  "0xc0f019b3497412e49107b7eb8e01e72a29e54643aa1e109971c0db7495426539",
  "0x29a4637797076a0620ecf1f4c6565616bbdbb80ed12df36f4125efe9e12706ad"
]

const Page = () => {
  const [loading, setLoading] = useState(false)
  const [entity, setEntity] = useState<EntityMetadata>(null as any)
  const [processDetails, setProcessDetails] = useState<ProcessDetails>(null as any)

  const loadMetadata = () => {
    setLoading(true)
    getClient()
      .then(gwPool => {
        return Promise.all([
          EntityApi.getMetadata(ENTITY_ID, gwPool),
          VotingApi.getProcess(PROCESS_IDS[0], gwPool)
        ])
      })
      .then(results => {
        setLoading(false)

        setEntity(results[0])
        setProcessDetails(results[1])
      })
      .catch(err => {
        setLoading(false)

        alert("Could not connect to the network nodes: " + err.message)
      })
  }

  return <div>
    <h2>Metadata and details</h2>
    <p>Status: ({loading ? "loading" : "ready"})</p>
    <h3>Entity</h3>
    <p><code>{ENTITY_ID}</code></p>
    <pre>{JSON.stringify(entity, null, 2)}</pre>
    <h3>Process</h3>
    <p><code>{PROCESS_IDS[0]}</code></p>
    <pre>{JSON.stringify(processDetails, null, 2)}</pre>
    {!loading ? <p><button onClick={loadMetadata}>Fetch data</button></p> : null}
  </div>
}

export default Page
