'use strict';

const Blockchain = require('./blockchain');

var process = {
    getMetadata: function(id){
        return Blockchain.getProcessMetadata(id);
    },

    encryptVote: function(vote, votePublicKey){
        return false;
    }
};

module.exports = process;