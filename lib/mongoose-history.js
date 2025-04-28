/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
const hm = require("./history-model");

module.exports = function (schema, options) {

  // Allow plugin to run in test environment
  const mongooseConnection = options?.historyConnection;
  const customCollectionName = options?.customCollectionName;
  const suffix = options?.suffix || "_history";

  // Clear all history collection from Schema
  schema.statics.historyModel = function () {
    const collectionName = customCollectionName || `${this.collection.name}${suffix}`;
    return hm.HistoryModel(collectionName, options);
  };

  // Clear all history documents from history collection
  schema.statics.clearHistory = async function () {
    const collectionName = customCollectionName || `${this.collection.name}${suffix}`;
    const History = hm.HistoryModel(
      collectionName,
      options
    );
    await History.deleteMany({});
    return;
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
  
  // Add document method for deleteOne - replacement for old remove()
  schema.methods.deleteOne = async function () {
    const doc = this;
    const historyDoc = createHistoryDoc(doc.toObject(), "d");
    await saveHistoryModel(historyDoc, doc.collection.name);
    return this.constructor.deleteOne({ _id: doc._id });
  };

  // Listen on findOneAndDelete, findOneAndRemove
  schema.post(
    [
      "findOneAndDelete",
      "findByIdAndDelete",
      "findOneAndRemove",
      "findByIdAndRemove",
    ],
    async function (doc, next) {
      // Make sure we don't proceed if there's no document
      if (!doc) {
        
        return next();
      }
      
      try {
        await processDoc.call(this, doc, "d");
        next();
      } catch (err) {
        
        next(err);
      }
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
      
      if (this._oldDoc) {
        
      }
      next();
    }
  );

  // Listen on post-findOneAndUpdate
  schema.post(
    [
      "findOneAndUpdate",
      "findByIdAndUpdate",
      "findOneAndReplace",
    ],
    async function (doc, next) {
      
      if (this._oldDoc) {
        
      }
      
      try {
        // For these methods, mongoose returns the updated document
        if (doc) {
          // For methods that return the updated document, use it
          
          await processDoc.call(this, doc, "u");
        } else if (this._oldDoc) {
          // Fallback to old doc if no doc returned
          await processDoc.call(this, this._oldDoc, "u");
        }
        next();
      } catch (err) {
        
        next(err);
      }
    }
  );
  
  // For methods that don't return the document
  schema.post(
    [
      "updateOne",
      "replaceOne",
    ],
    async function (result, next) {
      
      
      try {
        if (this._oldDoc) {
          
          // Need to find the updated document
          const filter = { _id: this._oldDoc._id };
          try {
            const updatedDoc = await this.model.findOne(filter);
            if (updatedDoc) {
              
              await processDoc.call(this, updatedDoc, "u");
            } else {
              await processDoc.call(this, this._oldDoc, "u"); 
            }
          } catch (err) {
            
            await processDoc.call(this, this._oldDoc, "u");
          }
        }
        next();
      } catch (err) {
        
        next(err);
      }
    }
  );

  // Create a copy when insert or update
  schema.pre("save", async function (next) {
    if(!this) return next();
    
    const d = this.toObject();
    const operation = this.isNew ? "i" : "u";
    
    let historyDoc;
    

    if (options && options.diffOnly && !this.isNew) {
      // Find the old document to get the differences
      try {
        const oldDoc = await this.constructor.findById(this._id).lean();
        if (oldDoc) {
          historyDoc = createDiffHistoryDoc(oldDoc, d, operation);
        } else {
          historyDoc = createHistoryDoc(d, operation);
        }
      } catch (err) {

        historyDoc = createHistoryDoc(d, operation);
      }
    } else {
      historyDoc = createHistoryDoc(d, operation);
    }
    
    try {
      await saveHistoryModel(historyDoc, this.collection.name);
      next();
    } catch (err) {
      next(err);
    }
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

  // Create a copy on remove - deprecated in Mongoose 8, use deleteOne instead
  schema.pre("deleteOne", { document: true }, async function (next) {
    const d = this.toObject();
    const historyDoc = createHistoryDoc(d, "d");
    try {
      await saveHistoryModel(
        historyDoc,
        this.collection.name
      );
      next();
    } catch (err) {
      next(err);
    }
  });

  function createHistoryDoc(d, operation) {
    return {
      t: new Date(),
      o: operation,
      d,
    };
  }
  
  function createDiffHistoryDoc(oldDoc, newDoc, operation) {
    // For insert and delete operations, just use the regular history doc
    if (operation === 'i' || operation === 'd') {
      return createHistoryDoc(newDoc, operation);
    }
    
    // For updates, only include changed fields
    const diffDoc = { _id: newDoc._id };
    
    // Using custom diff algorithm if provided
    const customDiffAlgo = options && options.customDiffAlgo;
    
    // Compare all keys in newDoc and only add changed ones
    Object.keys(newDoc).forEach(key => {
      // Skip if it's the same value or internal mongoose fields
      if (key === '_v' || key === '__v') return;
      
      // If there's a custom diff algorithm, use it
      if (typeof customDiffAlgo === 'function') {
        const result = customDiffAlgo(key, newDoc[key], oldDoc[key]);
        if (result !== null && result.diff !== undefined) {
          diffDoc[key] = result.diff;
        }
      } else {
        // Default comparison
        if (JSON.stringify(oldDoc[key]) !== JSON.stringify(newDoc[key])) {
          diffDoc[key] = newDoc[key];
        }
      }
    });
    
    return {
      t: new Date(),
      o: operation,
      d: diffDoc
    };
  }

  async function processDoc(doc, op, next) {
    if(!doc) {

      return;
    }
    
    try {
      const d = doc.toObject();
      
      let historyDoc;
      
      // Check if we're using diffOnly mode and in an update operation
      if (options && options.diffOnly && op === 'u' && this._oldDoc) {
        // Use the diff functionality
        const oldDocObj = this._oldDoc.toObject();
        historyDoc = createDiffHistoryDoc(oldDocObj, d, op);
      } else {
        // Use the regular history document creation
        historyDoc = createHistoryDoc(d, op);
      }
      

      await saveHistoryModel(historyDoc, this.mongooseCollection.collectionName);
      if (next) next();
    } catch (err) {

      if (next) next(err);
      return;
    }
  }

  async function saveHistoryModel(historyDoc, collectionName, next) {
    try {

      const historyCollectionName = customCollectionName || `${collectionName}${suffix}`;
      const HistoryModel = hm.HistoryModel(historyCollectionName, {
        historyConnection: mongooseConnection,
        metadata: options?.metadata,
        indexes: options?.indexes,
        customDiffAlgo: options?.customDiffAlgo
      });
      
      const doc = new HistoryModel(historyDoc);
      
      await doc.save();
      

      if (next) next();
      return doc;
    } catch (err) {
    
      if (next) next(err);
      throw err; // Re-throw to allow proper handling by callers
    }
  }

  async function saveManyHistoryModel(historyDocs, collectionName, next) {
    try {

      const historyCollectionName = customCollectionName || `${collectionName}${suffix}`;
      await hm.HistoryModel(historyCollectionName, {
        historyConnection: mongooseConnection,
        metadata: options?.metadata,
        indexes: options?.indexes,
        customDiffAlgo: options?.customDiffAlgo
      }).insertMany(historyDocs);
      next && next();
      return true;
    } catch (err) {

      next && next(err);
      throw err; // Re-throw to allow proper handling by callers
    }
  }
};
