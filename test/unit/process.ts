import {assert} from "chai";
import * as sinon from "sinon";

import Blockchain from "../../src/blockchain";
import Process from "../../src/process";

describe("Process", () => {
  describe("#GetById", () => {
    it("Should return a valid process Metadata", () => {
      const expectedProcessMetadata: object = {
        censusRoot: "",
        censusUrl: "",
        endBlock: "",
        startBlock: "",
        status: "",
        trustedGateways: "",
        voteEncryptionKeys: "",
        votingOptions: "",
      };

      const getProcessMetadataStub = sinon.stub(Blockchain, "getProcessMetadata")
                                        .returns(expectedProcessMetadata);

      const metadata: object = Process.getMetadata(1);

      getProcessMetadataStub.restore();
      sinon.assert.match(metadata, expectedProcessMetadata);
    });
  }),

  describe("#getOpen", () => {
    it("");
  }),

  describe("#getRelays", () => {
    it("");
  }),

  describe("#batchExists", () => {
    it("");
  }),

  describe("#getVotingOptions", () => {
    it("");
  }),

  describe("#encryptVote", () => {
    it("Fails on empty vote", () => {
      const vote: string = "";
      const votePublicKey: string = "123abcdeb";
      assert.throws(() => { Process.encryptVote(vote, votePublicKey); }, Error, "Vote can't be empty");
    }),

    it("Fails on empty votePublicKey", () => {
      const vote: string = "1";
      const votePublicKey: string = "";
      assert.throws(() => { Process.encryptVote(vote, votePublicKey); }, Error, "VotePublicKey can't be empty");
    }),

    it("Result is a String", () => {
      const vote: string = "1";
      const votePublicKey: string = "123abcdeb";
      const encryptedVote: string = Process.encryptVote(vote, votePublicKey);
      assert.isString(encryptedVote);
    });
  }),

  describe("#hashEncryptedVote", () => {
    it("");
  }),

  describe("#getVotingPackage", () => {
    it("");
  });

});
