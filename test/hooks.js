'use strict'

var should = require('should'),
  Post = require('./model/post'),
  HistoryPost = Post.historyModel()

require('./config/mongoose')

describe('History plugin', function () {
  var post = null

  async function createAndUpdatePostWithHistory(post) {
    await post.save()
    const foundPost = await Post.findOne()
    foundPost.updatedFor = 'another_user@test.com'
    foundPost.title = 'Title changed'
    await foundPost.save()
    const hpost = await HistoryPost.findOne({ 'd.title': 'Title changed' })
    return { post: foundPost, hpost }
  }

  async function updatePostWithHistory(post) {
    await post.save()

    const updateDoc = { title: 'Updated title' }

    await Post.updateOne({ title: 'Title test' }, { $set: updateDoc })
    const updatedPost = await Post.findOne({ title: 'Updated title' })
    const hpost = await HistoryPost.findOne({ 'd.title': 'Updated title' })
    return { post: updatedPost, hpost }
  }

  async function updateOnePostWithHistory(post) {
    await post.save()

    const updateDoc = { title: 'Updated title' }

    await Post.updateOne({ title: 'Title test' }, { $set: updateDoc })
    const updatedPost = await Post.findOne({ title: 'Updated title' })
    const hpost = await HistoryPost.findOne({ 'd.title': 'Updated title' })
    return { post: updatedPost, hpost }
  }

  async function findOneAndUpdatePostWithHistory(post) {
    const retryFetch = require('./helpers/retry-fetch')
    await post.save()

    const updateDoc = { title: 'Updated title' }

    // Use { new: true } to return the updated document
    await Post.findOneAndUpdate({ title: 'Title test' }, { $set: updateDoc }, { new: true })

    const updatedPost = await Post.findOne({ title: 'Updated title' })

    // Use retry fetch to handle potential timing issues
    const hpost = await retryFetch(() => HistoryPost.findOne({ 'd.title': 'Updated title' }))

    return { post: updatedPost, hpost }
  }

  var post = null

  beforeEach(function () {
    post = new Post({
      updatedFor: 'mail@test.com',
      title: 'Title test',
      message: 'message lorem ipsum test',
    })
  })

  afterEach(async function () {
    await Post.deleteMany({})
    await Post.clearHistory()
  })

  it('should keep insert in history', async function () {
    await post.save()
    const hpost = await HistoryPost.findOne({ 'd.title': 'Title test' })
    hpost.o.should.eql('i')
    post.should.have.property('updatedFor', hpost.d.updatedFor)
    post.title.should.be.equal(hpost.d.title)
    post.should.have.property('message', hpost.d.message)
  })

  it('should keep update in history', async function () {
    const { post: updatedPost, hpost } = await createAndUpdatePostWithHistory(post)
    hpost.o.should.eql('u')
    updatedPost.updatedFor.should.be.equal(hpost.d.updatedFor)
    updatedPost.title.should.be.equal(hpost.d.title)
    updatedPost.message.should.be.equal(hpost.d.message)
  })

  it('should keep update on Model in history', async function () {
    const { post: updatedPost, hpost } = await updatePostWithHistory(post)
    hpost.o.should.eql('u')
    updatedPost.updatedFor.should.be.equal(hpost.d.updatedFor)
    updatedPost.title.should.be.equal(hpost.d.title)
    updatedPost.message.should.be.equal(hpost.d.message)
  })

  it('should keep update on Model in history using updateOne()', async function () {
    const { post: updatedPost, hpost } = await updateOnePostWithHistory(post)
    hpost.o.should.eql('u')
    updatedPost.updatedFor.should.be.equal(hpost.d.updatedFor)
    updatedPost.title.should.be.equal(hpost.d.title)
    updatedPost.message.should.be.equal(hpost.d.message)
  })

  it('should keep update on Model in history using findOneAndUpdate()', async function () {
    const { post: updatedPost, hpost } = await findOneAndUpdatePostWithHistory(post)
    hpost.o.should.eql('u')
    updatedPost.updatedFor.should.be.equal(hpost.d.updatedFor)
    updatedPost.title.should.be.equal(hpost.d.title)
    updatedPost.message.should.be.equal(hpost.d.message)
  })

  it('should keep remove in history', async function () {
    const { post: updatedPost } = await createAndUpdatePostWithHistory(post)
    await updatedPost.deleteOne()
    const historyWithRemove = await HistoryPost.find({ o: 'd' }).select('d').exec()
    historyWithRemove.should.not.be.empty
  })

  it('should keep remove in history using findOneAndRemove()', async function () {
    const { post: updatedPost } = await createAndUpdatePostWithHistory(post)
    await Post.findOneAndDelete({ title: updatedPost.title })
    const historyWithRemove = await HistoryPost.find({ o: 'd' }).select('d').exec()
    historyWithRemove.should.not.be.empty
    historyWithRemove.should.be.instanceOf(Array).and.have.lengthOf(1)
  })
})
