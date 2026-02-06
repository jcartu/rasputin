import { QdrantStore } from './qdrant.js';
import { PineconeStore } from './pinecone.js';
import { WeaviateStore } from './weaviate.js';
import { VectorStoreType } from '../types.js';

const storeClasses = {
  [VectorStoreType.QDRANT]: QdrantStore,
  [VectorStoreType.PINECONE]: PineconeStore,
  [VectorStoreType.WEAVIATE]: WeaviateStore,
};

export function createVectorStore(type, config = {}) {
  const StoreClass = storeClasses[type];
  if (!StoreClass) {
    throw new Error(`Unsupported vector store type: ${type}. Supported: ${Object.keys(storeClasses).join(', ')}`);
  }
  return new StoreClass(config);
}

export async function testVectorStoreConnection(type, config = {}) {
  const store = createVectorStore(type, config);
  return store.healthCheck();
}

export { QdrantStore, PineconeStore, WeaviateStore };
export default { createVectorStore, testVectorStoreConnection, QdrantStore, PineconeStore, WeaviateStore };
