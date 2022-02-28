import { Buffer } from "buffer/";
import { promiseWithTimeout } from "@vocdoni/common";
import { ContentUri } from "../wrappers/content-uri";
import { ContentHashedUri } from "../wrappers/content-hashed-uri";
import { IPFS } from "../net/ipfs";
import * as fetchPonyfill from "fetch-ponyfill";

const { fetch } = fetchPonyfill();

const MAX_FETCH_TIMEOUT = 8000;

export namespace FileApi {
  /**
   * Fetch the contents of a file and return them as a string
   *
   * See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api
   *
   * @param contentUri
   */
  export function fetchStringFallback(
    contentUri: ContentUri | ContentHashedUri | string,
  ): Promise<string> {
    let cUri: ContentUri | ContentHashedUri;
    if (typeof contentUri == "string") cUri = new ContentUri(contentUri);
    else cUri = contentUri;

    return FileApi.fetchBytesFallback(cUri).then((bytes: Buffer) => {
      return bytes.toString();
    });
  }

  /**
   * Fetch the contents of a file and return them as a byte array
   *
   * See https://vocdoni.io/docs/#/architecture/components/gateway?id=file-api
   *
   * @param contentUri
   */
  export async function fetchBytesFallback(
    contentUri: ContentUri | ContentHashedUri | string,
  ): Promise<Buffer> {
    if (!contentUri) throw new Error("Invalid contentUri");

    const cUri = ContentHashedUri.resolve(contentUri);

    // Attempt 2: fetch fallback from IPFS public gateways
    if (cUri.ipfsHash) {
      try {
        const response = await promiseWithTimeout(
          IPFS.fetchHash(cUri.ipfsHash),
          MAX_FETCH_TIMEOUT,
        );
        if (response) {
          if (cUri.hash && !cUri.verify(response)) {
            throw new Error(
              "The fetched artifact doesn't match the expected hash",
            );
          }

          return Buffer.from(response);
        }
      } catch (err) {
        // continue
      }
    }

    // Attempt 3: fetch from fallback https endpoints
    for (let uri of cUri.httpsItems) {
      try {
        const res = await promiseWithTimeout(
          fetch(uri).then((res) => {
            if (res.status < 200 || res.status >= 300) return null;
            return res.arrayBuffer();
          }),
          MAX_FETCH_TIMEOUT,
        );
        if (!res) continue;

        const result = Buffer.from(res);
        if (cUri.hash && !cUri.verify(result)) {
          throw new Error(
            "The fetched artifact doesn't match the expected hash",
          );
        }
        return result;
      } catch (err) {
        // keep trying
        continue;
      }
    }

    throw new Error("Unable to connect to the network");
  }
}
