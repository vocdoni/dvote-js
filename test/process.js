var assert = require('assert');
var expect = require('chai').expect;
var should = require('chai').should();
var sinon = require('sinon');

const Process = require('../lib/process');
const Blockchain = require('../lib/blockchain');

describe('Process', function(){
  describe('Get Process Metadata', function(){
    it('Should return a valid process Metadata', function(){
      var expectedProcessMetadata = {
        censusUrl: "",
        censusRoot: "",
        votingOptions: "",
        startBlock: "",
        endBlock: "",
        voteEncryptionKeys: "",
        status: "",
        trustedGateways: ""
      };

      var getProcessMetadataStub = sinon.stub(Blockchain, 'getProcessMetadata').returns(expectedProcessMetadata);
      
      var metadata = Process.getMetadata(1);
      
      getProcessMetadataStub.restore();
      sinon.assert.match(metadata, expectedProcessMetadata);
    });
  });
});