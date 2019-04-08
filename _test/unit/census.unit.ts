import * as sinon from "sinon";
import config from "../config";
import {Census} from "../../src";
import MerkleProof from "../../src/dvote/merkleProof";

describe("Census", () => {
    const censusServiceUrl: string = config.CENSUS_SERVICE_URL;
    let census: Census;

    beforeEach(() => {
        census = new Census();
        census.initCensusService(censusServiceUrl);
    });

    describe("getCensusProof()", () => {
        const eProof = "0x0000000000000000000000000000000000000000000000000000000000000007bfa73b7252009f76767ece75da9b5224014ee9c63b63262169e5b989f02930f252f3ca2aaf635ec2ae4452f6a65be7bca72678287a8bb08ad4babfcccd76c2fef1aac7675261bf6d12c746fb7907beea6d1f1635af93ba931eec0c6a747ecc37";
        const expectedProof: MerkleProof = new MerkleProof(eProof);

        it("Result is a String", async () => {
            const censusProofUrl: string = "http://vocdoni.io/getFranchiseProof";
            const votePublicKey: string = "123abcdeb";
            const censusId: string = "test";
            const getFranchiseProof = sinon.stub(Census, "getProof")
                                           .resolves(expectedProof);

            const proof: object = await Census.getProof(votePublicKey, censusId, censusProofUrl);

            getFranchiseProof.restore();
            sinon.assert.match(proof, expectedProof);
        });
    });

});
