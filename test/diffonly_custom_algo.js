'use strict'

var should = require('should'),
  Post = require('./model/post_custom_diff'),
  HistoryPost = Post.historyModel()

require('./config/mongoose')

describe('History plugin custom diff algo', function () {
  var post = null

  async function createAndUpdatePostWithHistory(post, newTags) {
    const retryFetch = require('./helpers/retry-fetch')
    await post.save()
    const foundPost = await Post.findOne()
    foundPost.updatedFor = 'another_user@test.com'
    foundPost.title = 'Title changed'
    foundPost.tags = newTags
    await foundPost.save()

    // Use retry fetch to handle potential timing issues
    const hpost = await retryFetch(() => HistoryPost.findOne({ 'd.title': 'Title changed' }))
    should.exists(hpost)
    return { post: foundPost, hpost }
  }

  let postInstance = null
  const defaultTags = ['Brazil', 'France']

  beforeEach(function () {
    postInstance = new Post({
      updatedFor: 'mail@test.com',
      title: 'Title test',
      message: 'message lorem ipsum test',
      tags: defaultTags,
    })
  })

  afterEach(async function () {
    await Post.deleteMany({})
    await Post.clearHistory()
  })

  it('should keep insert in history', async function () {
    await postInstance.save()
    const hpost = await HistoryPost.findOne({ 'd.title': 'Title test' })
    should.exists(hpost)
    hpost.o.should.eql('i')
    postInstance.should.have.property('updatedFor', hpost.d.updatedFor)
    postInstance.title.should.be.equal(hpost.d.title)
    postInstance.should.have.property('message', hpost.d.message)
  })

  it('should not care about order of tags', async function () {
    should.exists(postInstance)
    var newTags = ['France', 'Brazil']
    const { post, hpost } = await createAndUpdatePostWithHistory(postInstance, newTags)
    should.exists(hpost)
    hpost.o.should.eql('u')
    should.not.exists(hpost.d.message)
    should.not.exists(hpost.d._v)
    should.not.exists(hpost.d.tags)
  })

  it('should detect null tags', async function () {
    const retryFetch = require('./helpers/retry-fetch')
    should.exists(postInstance)
    var newTags = null
    await postInstance.save()
    const foundPost = await Post.findOne()
    foundPost.updatedFor = 'another_user@test.com'
    foundPost.title = 'Title changed'
    foundPost.tags = newTags
    await foundPost.save()

    // Use retry fetch to handle potential timing issues
    const hpost = await retryFetch(() => HistoryPost.findOne({ 'd.title': 'Title changed' }))
    should.exists(hpost)
    hpost.o.should.eql('u')
    should.not.exists(hpost.d.message)
    should.not.exists(hpost.d._v)
    should(hpost.d.tags).be.null()
  })

  it('should detect new tags', async function () {
    should.exists(postInstance)
    var newTags = ['Brazil', 'France', 'Australia']
    const { post, hpost } = await createAndUpdatePostWithHistory(postInstance, newTags)
    should.exists(hpost)
    hpost.o.should.eql('u')
    should.not.exists(hpost.d.message)
    should.not.exists(hpost.d._v)
    should.exists(hpost.d.tags)
    hpost.d.tags.should.be.instanceof(Array).and.have.lengthOf(3)
    hpost.d.tags.should.containEql('Brazil')
    hpost.d.tags.should.containEql('France')
    hpost.d.tags.should.containEql('Australia')
  })

  it('should detect removed tags', async function () {
    should.exists(postInstance)
    var newTags = ['Brazil']
    const { post, hpost } = await createAndUpdatePostWithHistory(postInstance, newTags)
    should.exists(hpost)
    hpost.o.should.eql('u')
    should.not.exists(hpost.d.message)
    should.not.exists(hpost.d._v)
    should.exists(hpost.d.tags)
    hpost.d.tags.should.be.instanceof(Array).and.have.lengthOf(1)
    hpost.d.tags.should.containEql('Brazil')
  })

  it('should keep just what changed in update', async function () {
    should.exists(postInstance)
    const { post, hpost } = await createAndUpdatePostWithHistory(postInstance, defaultTags)
    should.exists(hpost)
    hpost.o.should.eql('u')
    should.not.exists(hpost.d.message)
    should.not.exists(hpost.d.tags)
    should.not.exists(hpost.d._v)
  })

  it('should keep remove in history', async function () {
    should.exists(postInstance)
    const { post } = await createAndUpdatePostWithHistory(postInstance, defaultTags)
    should.exists(post)
    await post.deleteOne()
    const historyWithRemove = await HistoryPost.find({ o: 'd' }).select('d').exec()
    historyWithRemove.should.not.be.empty
  })
})
