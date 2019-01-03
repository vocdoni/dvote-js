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

        const expectedProof: MerkleProof = new MerkleProof(["0xroot", "0xsibling1", "0xsibling2", "0xleaf"]);

        it("Result is a String", async () => {
            const franchiseProofUrl: string = "http://vocdoni.io/getFranchiseProof";
            const votePublicKey: string = "123abcdeb";
            const getFranchiseProof = sinon.stub(dvote.Census.prototype, "getProof")
                .resolves(expectedProof);

            const proof: object = await census.getProof(votePublicKey, franchiseProofUrl);

            getFranchiseProof.restore();
            sinon.assert.match(proof, expectedProof);
        });
    });

    describe("#VerifiyCensusProof()", () => {
        it("");
    });

});
