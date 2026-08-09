// Installs indexedDB, IDBKeyRange and friends on globalThis. The db/ layer is
// the same code in the test as in the browser — only the storage engine is a
// stand-in.
import 'fake-indexeddb/auto'
