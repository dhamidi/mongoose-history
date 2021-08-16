const mongoose = require("mongoose");

const historyModels = {};

/**
 * Create and cache a history mongoose model
 * @param {string} collectionName Name of history collection
 * @return {mongoose.Model} History Model
 */
// eslint-disable-next-line func-names
module.exports.HistoryModel = function (collectionName, options) {
  const indexes = options?.indexes;
  const mongooseConnection = options?.mongooseConnection;
  const metadata = options?.metadata;
  // const suffix = options?.suffix || "_history";

  const schemaObject = {
    t: { type: Date, required: true },
    o: { type: String, required: true },
    d: { type: mongoose.Schema.Types.Mixed, required: true },
  };

  if (metadata){
    metadata.forEach((m) =>{
      schemaObject[m.key] = m.schema || {type: mongoose.Schema.Types.Mixed}
    })
  }

  if (!(collectionName in historyModels)) {
    const schema = new mongoose.Schema(schemaObject, {
      id: true,
      versionKey: false,
    });

    if (indexes) {
      indexes.forEach((idx) => {
        schema.index(idx);
      });
    }

    if (mongooseConnection) {
      historyModels[collectionName] = mongooseConnection.model(
          collectionName,
          schema,
          collectionName
        );
    } else {
      historyModels[collectionName] = mongoose.model(
        collectionName,
        schema,
        collectionName
      );
    }
  }

  return historyModels[collectionName];
};

