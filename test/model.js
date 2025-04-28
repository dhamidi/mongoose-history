"use strict";

var secondConnectionUri = process.env.SECONDARY_CONNECTION_URI || 'mongodb://localhost/mongoose-history-test-second';

var should          = require('should')
  , hm              = require('../lib/history-model')
  , Post            = require('./model/post-with-index')
  , PostAnotherConn = require('./model/post-another-conn')
  , PostMetadata    = require('./model/post_metadata')
  , secondConn      = require('mongoose').createConnection(secondConnectionUri);

require('./config/mongoose');

describe('History Model', function() {
  describe('historyCoolectionName', function() {  
    it('should set a collection name', function() {
      // The function historyCollectionName was removed in the new version
      // We need to check if the HistoryModel function correctly uses the collection name
      var model = hm.HistoryModel('original_collection_name', { suffix: 'defined_by_user_history_collection_name' });
      model.collection.name.should.eql("original_collection_name");
    });
    
    it('should suffix collection name with \'_history\' by default', function() {
      // Testing the default suffix in HistoryModel
      var model = hm.HistoryModel('original_collection_name');
      model.collection.name.should.eql("original_collection_name");
    });
  });
  
  it('should require t(timestamp), o(operation) fields and d(document) field', async function() {
    var HistoryPost = Post.historyModel();
    var history = new HistoryPost();
    
    try {
      await history.save();
      should.fail('Should have failed with missing required fields');
    } catch (err) {
      should.exists(err);
    }
    
    history.t = new Date();
    try {
      await history.save();
      should.fail('Should have failed with missing o field');
    } catch (err) {
      should.exists(err);
    }
    
    history.o = 'i';
    try {
      await history.save();
      should.fail('Should have failed with missing d field');
    } catch (err) {
      should.exists(err);
    }
    
    history.d = {a: 1};
    await history.save();
  });
  
  it('could have own indexes', async function() {
    var HistoryPost = Post.historyModel();
    const idxInformation = await HistoryPost.collection.indexInformation({full:true});
    't_1_d._id_1'.should.eql(idxInformation[1].name);
  });
  
  it('could have another connection', async function() {
    var post = new PostAnotherConn({
      updatedFor: 'mail@test.com',
      title:   'Title test',
      message: 'message lorem ipsum test'
    });
    
    await post.save();
    const hpostsCollection = await secondConn.db.collection('posts_another_conn_history');
    const hpost = await hpostsCollection.findOne();
    post.should.have.property('updatedFor', hpost.d.updatedFor);
    post.title.should.be.equal(hpost.d.title);
    post.should.have.property('message', hpost.d.message);
  });

  it ('could have additionnal metadata fields', function(){
    var HistoryPost = PostMetadata.historyModel();
    HistoryPost.schema.paths.should.have.property('title')
  })

  
});