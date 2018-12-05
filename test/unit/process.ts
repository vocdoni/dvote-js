import {assert, expect} from 'chai';
import * as sinon from 'sinon';

import Process from '../../lib/process';
import Blockchain from '../../lib/blockchain';

describe('Process', function(){
  describe('#GetById', function(){
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

      var getProcessMetadataStub = sinon.stub(Blockchain, 'getProcessMetadata')
                                        .returns(expectedProcessMetadata);
      
      var metadata = Process.getMetadata(1);
      
      getProcessMetadataStub.restore();
      sinon.assert.match(metadata, expectedProcessMetadata);
    });
  }),

  describe('#getOpen', function(){
    it(''); 
  }),

  describe('#getRelays', function(){
    it('');
  }),

  describe('#batchExists', function(){
    it('');
  }),

  describe('#getVotingOptions', function(){
    it('');
  }),

  describe('#encryptVote', function(){
    it('Fails on empty vote', function(){
      var vote = '';
      var votePublicKey = '123abcdeb';
      assert.throws(function(){ Process.encryptVote(vote, votePublicKey)}, Error, 'Vote can\'t be empty');
    }),

    it('Fails on empty votePublicKey', function(){
      var vote = 1;
      var votePublicKey = '';
      assert.throws(function(){ Process.encryptVote(vote, votePublicKey)}, Error, 'VotePublicKey can\'t be empty');
    }),

    it('Result is a String', function(){
      var vote = 1;
      var votePublicKey = '123abcdeb';
      var encryptedVote = Process.encryptVote(vote, votePublicKey);
      assert.isString(encryptedVote);
    });
  }),
  
  describe('#hashEncryptedVote', function(){
    it('');
  }),

  describe('#getVotingPackage', function(){
    it('');
  });

});