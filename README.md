# Mongoose History Plugin

[![Build Status](https://travis-ci.org/nassor/mongoose-history.svg?branch=master)](https://travis-ci.org/nassor/mongoose-history)

Keeps a history of all changes of a document.

## Installation

```bash
npm install mongoose-history
```

Or add it to your package.json

## Usage

For starting history of your collection, you need to simply add the mongoose-history plugin:

```javascript
var mongoose        = require('mongoose')
  , mongooseHistory = require('mongoose-history')
  , Schema          = mongoose.Schema

var Post = new Schema({
    title:       String
  , message:     String
  , updated_for: String
})

Post.plugin(mongooseHistory)
```
This will generate a log from al your changes on this schema.

The plugin will create a new collection with format: originalCollectionName +  **_history**, in example: __posts_history__. You can also change the name of the collection by setting the configuration customCollectionName:

```javascript
var options = {customCollectionName: "post_hst"}
Post.plugin(mongooseHistory, options)
```

The history documents have the format:

```javascript
{
    _id:  ObjectId,
    t: Date // when history was made
    o: "i" (insert) | "u" (update) | "r" (remove) // what happens with document
    d: {  // changed document data
        _id:         ObjectId
      , title:       String
      , message:     String
      , updated_for: String
    }
}
```

### Indexes
To improve queries perfomance in history collection you can define indexes, for example:

```javascript
var options = {indexes: [{'t': -1, 'd._id': 1}]};
Post.plugin(mongooseHistory, options)
```

### Send history to another database
You can keep your history collection far away from your primary database or replica set. This can be useful for improve the architecture of your system.

Just create another connection to the new database and link the reference in __historyConnection__:

```javascript
var secondConn = mongoose.createConnection('mongodb://localhost/another_conn');
var options = {historyConnection: secondConn}
Post.plugin(mongooseHistory, options)
```

### Store metadata
If you need to store aditionnal data, use the ```metadata``` option
It accepts a collection of objects. The parameters ```key``` and ```value``` are required. 
You can specify mongoose options using the parameter ```schema``` (defaults to ```{type: mongoose.Schema.Types.Mixed}```)
```value``` can be either a String (resolved from the updated object), or a function, sync or async

```javascript
var options = {
  metadata: [
    {key: 'title', value: 'title'},
    {key: 'titleFunc', value: function(original, newObject){return newObject.title}},
    {key: 'titleAsync', value: function(original, newObject, cb){cb(null, newObject.title)}}
  ]
};
PostSchema.plugin(history,options);
module.exports = mongoose.model('Post_meta', PostSchema);
```

### Statics
All modules with history plugin have following methods:

#### Model.historyModel()
Get History Model of Model;

#### Model.clearHistory()
Clear all History collection;

## Development

### Testing

The tests run against a local mongodb installation and use the following databases: `mongoose-history-test` and `mongoose-history-test-second`.

Custom connection uris can be provided via environment variables for e.g. using a username and password:
```
CONNECTION_URI='mongodb://username:password@localhost/mongoose-history-test' SECONDARY_CONNECTION_URI='mongodb://username:password@localhost/mongoose-history-test-second' mocha
```

### Mongoose Compatibility

This plugin is compatible with Mongoose 8.x. For older versions of Mongoose, please use earlier versions of this plugin.

### DiffOnly - Track Only Changed Fields

By default, the plugin stores the entire document for each change. If you want to save storage space, you can enable the `diffOnly` option, which only stores the fields that were actually changed during an update:

```javascript
var options = {diffOnly: true};
PostSchema.plugin(history, options);
```

With `diffOnly` enabled, update operations will only store the changed fields and the document's `_id` in the history collection, which can significantly reduce storage requirements for large documents with small changes.

### Custom Diff Algorithm

You can provide your own custom algorithm to determine what differences are stored in the history by setting the `customDiffAlgo` option.

This function receives the key, new value, and old value for each field and should return an object with a `diff` property if the values are considered different:

```javascript
var options = {
  diffOnly: true,
  customDiffAlgo: function(key, newValue, oldValue) {
    // Simple comparison example
    if (key === 'tags' && Array.isArray(newValue) && Array.isArray(oldValue)) {
      // Sort arrays to ensure order doesn't matter
      const newTags = [...newValue].sort();
      const oldTags = [...oldValue].sort();
      if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
        return { diff: newValue }; // Return the new value as the diff
      }
      return { diff: undefined }; // No difference
    }
    
    // Default comparison for other fields
    if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
      return { diff: newValue };
    }
    return { diff: undefined };
  }
};
PostSchema.plugin(history, options);
```

The custom diff algorithm is useful for special fields like arrays where you might want to consider them equal regardless of order.

## TODO
* **TTL documents**

## LICENSE

Copyright (c) 2013-2025, Nassor Paulino da Silva <nassor@gmail.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
