/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
const hm = require("./history-model");

module.exports = function (schema, options) {

  if (process.env.NODE_ENV === 'test') return;

  const suffix = options?.suffix || "_history";

  // Clear all history collection from Schema
  schema.statics.historyModel = function () {
    return hm.HistoryModel(`${this.collection.name}${suffix}`, options);
  };

  // Clear all history documents from history collection
  schema.statics.clearHistory = function (callback) {
    const History = hm.HistoryModel(
      `${this.collection.name}${suffix}`,
      options
    );
    History.deleteMany({}, function (err) {
      callback(err);
    });
  };

  // Pre delete - pass results to post Delete
  schema.pre("deleteMany", async function (next) {
    this._deletedDocs = await this.model.find(this.getFilter()).lean();
    next();
  });

  // Post deleteMany - receives deleted docs and adds to history
  schema.post("deleteMany", function (result, next) {
    if (result?.deletedCount && this._deletedDocs?.length) {
      const historyDocs = this._deletedDocs.map((doc) =>
        createHistoryDoc(doc, "d")
      );
      saveManyHistoryModel(
        historyDocs,
        this.mongooseCollection.collectionName,
        next
      );
    }
    next();
  });

  // Pre deleteOne - pass results to post DeleteOne
  schema.pre("deleteOne", async function (next) {
    this._deletedDoc = await this.model.findOne(this.getFilter());
    next();
  });

  // Post deleteOne - receives deleted docs and adds to history
  schema.post("deleteOne", function (result, next) {
    if (result?.deletedCount === 1 && this._deletedDoc) {
      processDoc.call(this, this._deletedDoc, "d", next);
    }
    next();
  });

  // Listen on findOneAndDelete, findOneAndRemove
  schema.post(
    [
      "findOneAndDelete",
      "findByIdAndDelete",
      "findOneAndRemove",
      "findByIdAndRemove",
    ],
    function (doc, next) {
      processDoc.call(this, doc, "d", next);
      next();
    }
  );

  // Listen on pre-findOneAndUpdate
  schema.pre(
    [
      "findOneAndUpdate",
      "findByIdAndUpdate",
      "findOneAndReplace",
      "updateOne",
      "replaceOne",
    ],
    async function (next) {
      this._oldDoc = await this.model.findOne(this.getFilter());
      next();
    }
  );

  // Listen on post-findOneAndUpdate
  schema.post(
    [
      "findOneAndUpdate",
      "findByIdAndUpdate",
      "findOneAndReplace",
      "updateOne",
      "replaceOne",
    ],
    function (doc, next) {
      processDoc.call(this, this._oldDoc, "u", next);
      next();
    }
  );

  // Create a copy when insert or update
  schema.pre("save", function (next) {
    let historyDoc = {};
    
    if(!this) return next();
    
    const d = this.toObject();
    const operation = this.isNew ? "i" : "u";
    historyDoc = createHistoryDoc(d, operation);
    saveHistoryModel(historyDoc, this.collection.name, next);
    next();
  });

  // Pre updateMany - pass results to post updateMany
  schema.pre(["updateMany", "update"], async function (next) {
    this._oldDocs = await this.model.find(this.getFilter()).lean();
    next();
  });

  // Post updateMany - receives old docs and adds to history
  schema.post(["updateMany", "update"], function (result, next) {
    if (result?.nModified && this._oldDocs?.length) {
      const historyDocs = this._oldDocs.map((doc) =>
        createHistoryDoc(doc, "u")
      );
      saveManyHistoryModel(
        historyDocs,
        this.mongooseCollection.collectionName,
        next
      );
    }
    next();
  });

  // Create a copy on remove
  schema.pre("remove", function (next) {
    const d = this.toObject();
    const historyDoc = createHistoryDoc(d, "d");
    saveHistoryModel(
      this.toObject(),
      d,
      historyDoc,
      this.collection.name,
      next
    );
    next();
  });

  function createHistoryDoc(d, operation) {
    return {
      t: new Date(),
      o: operation,
      d,
    };
  }

  function processDoc(doc, op, next) {
    if(!doc) return next();
    
    const d = doc.toObject();
    const historyDoc = createHistoryDoc(d, op);
    saveHistoryModel(historyDoc, this.mongooseCollection.collectionName, next);
    next();
  }

  function saveHistoryModel(historyDoc, collectionName, next) {
    const doc = new hm.HistoryModel(`${collectionName}${suffix}`, options)(historyDoc);
    doc.save(next);
  }

  function saveManyHistoryModel(historyDocs, collectionName, next) {
    hm.HistoryModel(`${collectionName}${suffix}`, options).insertMany(
      historyDocs
    );
    next();
  }
};
