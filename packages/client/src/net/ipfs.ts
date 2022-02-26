import { Random } from "@vocdoni/common";
import * as fetchPonyfill from "fetch-ponyfill";

const { fetch } = fetchPonyfill();

export const IPFS_GATEWAY_LIST_URI =
  "https://ipfs.github.io/public-gateway-checker/gateways.json";

export namespace IPFS {
  /**
   * Attempt to fetch a file from the list of well-known IPFS gateways
   * @param hash IPFS raw hash (no leading protocol)
   */
  export function fetchHash(hash: string): Promise<Uint8Array> {
    return fetch(IPFS_GATEWAY_LIST_URI)
      .then((res) => res.json())
      .then((response) => {
        if (!Array.isArray(response)) {
          throw new Error("Could not fetch the IPFS gateway list");
        }
        const gwSelection = Random.shuffle(response).slice(0, 3);

        return Promise.race(gwSelection.map((gwUri) => {
          return fetch(gwUri.replace(/:hash$/g, hash))
            .then((res) => res.arrayBuffer())
            .then((res) => new Uint8Array(res));
        }));
      });
  }
}
