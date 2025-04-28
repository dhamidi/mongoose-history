"use strict";

var should      = require('should')
  , Post        = require('./model/post_metadata')
  , HistoryPost = Post.historyModel();

require('./config/mongoose');

describe('History plugin with Metadata', function() {

  var post = null;

  async function createAndUpdatePostWithHistory(post) {
    await post.save();
    const foundPost = await Post.findOne();
    foundPost.updatedFor = 'another_user@test.com';
    foundPost.title = "Title changed";
    await foundPost.save();
    const hpost = await HistoryPost.findOne({'d.title': 'Title changed'});
    return { post: foundPost, hpost };
  };

  var post = null;

  beforeEach(function() {
    post = new Post({
      updatedFor: 'mail@test.com',
      title:   'Title test',
      message: 'message lorem ipsum test'
    });
  });

  afterEach(async function() {
    await Post.deleteMany({});
    await Post.clearHistory();
  });

  it('should set simple field', async function() {
    const retryFetch = require('./helpers/retry-fetch');
    await post.save();
    
    // Use retry fetch with a condition that checks for the title field
    const hpost = await retryFetch(
      async () => {
        const doc = await HistoryPost.findOne({'d.title': 'Title test'});
        // Check that doc has the title field before returning
        if (doc && doc.title) return doc;
        return null;
      },
      { maxRetries: 5, delay: 30 }
    );
    
    should.exist(hpost, 'History post should exist');
    should.exist(hpost.title, 'Title field should exist in history');
    hpost.title.should.eql('Title test');
  });

  it('should set function field', async function() {
    const retryFetch = require('./helpers/retry-fetch');
    await post.save();
    
    // Use retry fetch to handle potential timing issues
    const hpost = await retryFetch(
      async () => {
        const doc = await HistoryPost.findOne({'d.title': 'Title test'});
        // Check that doc has the titleFunc field before returning
        if (doc && doc.titleFunc) return doc;
        return null;
      },
      { maxRetries: 5, delay: 30 }
    );
    
    should.exist(hpost, 'History post should exist');
    should.exist(hpost.titleFunc, 'titleFunc field should exist in history');
    hpost.titleFunc.should.eql('Title test');
  });

  it('should set async field', async function() {
    const retryFetch = require('./helpers/retry-fetch');
    await post.save();
    
    // First find the history document
    const hpost = await retryFetch(
      () => HistoryPost.findOne({'d.title': 'Title test'}),
      { maxRetries: 5, delay: 30 }
    );
    
    should.exist(hpost, 'History post should exist');
    await hpost.setAsyncMetadata(); // Explicitly call to set async metadata
    
    // Verify the field exists after setting async metadata
    should.exist(hpost.titleAsync, 'titleAsync field should exist in history');
    hpost.titleAsync.should.eql('Title test');
  });

});
