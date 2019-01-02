import * as nodeassert from "assert";
import { assert } from "chai";
import * as sinon from "sinon";

import * as dvote from "../../src";
import MerkleProof from "../../src/dvote/merkleProof";

describe("Census", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const votingProcessContractAddress: string = "0xd8c3d0B72DFbE3adbe0fd9295c9fe083ff896684";
    let census: dvote.Census;

    beforeEach(() => {
        census = new dvote.Census(blockchainUrl, votingProcessContractAddress);
    });

    describe("#getCensus()", () => {
        it("");
    }),

    describe("#getFranchiseProofUrl()", () => {
        it("");
    });

    describe("#getCensusProof()", () => {

        it("Result is a String", async () => {
                const franchiseProofUrl: string = "http://vocdoni.io/getFranchiseProof";
                const votePublicKey: string = "123abcdeb";
                const censusProof: MerkleProof = await census.getProof(votePublicKey, franchiseProofUrl);
                assert.isNotEmpty(censusProof.root, "Merkle proof needs a root");
                assert.isAtLeast(censusProof.siblings.length, 1, "Merkle proof needs at least one sibling");
                assert.isNotEmpty(censusProof.siblings, "Merkle proof needs siblings");
                assert.isNotEmpty(censusProof.leaf, "Merkle proof needs leaf");
        });
    });

    describe("#VerifiyCensusProof()", () => {
        it("");
    });

});
