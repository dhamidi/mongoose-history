"use strict";

var should      = require('should')
  , Post        = require('./model/post_diff')
  , HistoryPost = Post.historyModel();

require('./config/mongoose');

describe('History plugin', function() {

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

  let postInstance = null;

  beforeEach(function() {
    postInstance = new Post({
      updatedFor: 'mail@test.com',
      title:   'Title test',
      message: 'message lorem ipsum test'
    });
  });

  afterEach(async function() {
    await Post.deleteMany({});
    await Post.clearHistory();
  });

  it('should keep insert in history', async function() {
    await postInstance.save();
    
    const hpost = await HistoryPost.findOne({'d.title': 'Title test'});
    should.exist(hpost, 'History post should exist');
    hpost.o.should.eql('i');
    postInstance.should.have.property('updatedFor', hpost.d.updatedFor);
    postInstance.title.should.be.equal(hpost.d.title);
    postInstance.should.have.property('message', hpost.d.message);
  });

  it('should keep just wath changed in update', async function() {
    const { post, hpost } = await createAndUpdatePostWithHistory(postInstance);
    hpost.o.should.eql('u');
    //post.updatedFor.should.be.equal(hpost.d.updatedFor);
    //post.title.should.be.equal(hpost.d.title);
    //post.message.should.be.equal(hpost.d.message);
    should.not.exists(hpost.d.message);
    should.not.exists(hpost.d._v);
    //hpost.d.should.not.exist(post.message);
    //hpost.d.should.not.exist(post._v);
  });

  it('should keep remove in history', async function() {
    const { post } = await createAndUpdatePostWithHistory(postInstance);
    await post.deleteOne();
    const historyWithRemove = await HistoryPost.find({o: 'd'}).select('d').exec();
    historyWithRemove.should.not.be.empty;
  });
});
