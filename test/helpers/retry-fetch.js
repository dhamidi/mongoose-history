"use strict";

/**
 * Helper to fetch a document with retries if not found
 * @param {Function} fetchFn - Function that returns a promise resolving to the document
 * @param {Object} options - Options for retries
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.delay - Delay between retries in ms (default: 25)
 * @returns {Promise<any>} - The fetched document
 */
async function retryFetch(fetchFn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const delay = options.delay || 25;
  
  let retries = 0;
  let result = await fetchFn();
  
  while (!result && retries < maxRetries) {
    // Wait for the specified delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Try fetching again
    result = await fetchFn();
    retries++;
  }
  
  return result;
}

module.exports = retryFetch;