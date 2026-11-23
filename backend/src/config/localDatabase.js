import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server-core";

const localUri = "mongodb://127.0.0.1:27017/";

// Reuse a MongoDB process on the default port only if it serves this project data directory.
async function existingLocalDatabase(dataPath) {
  const client = new MongoClient(localUri, { serverSelectionTimeoutMS: 1000 });
  try {
    const { parsed: options } = await client.db("admin").command({ getCmdLineOpts: 1 });
    const activePath = options.storage?.dbPath;
    return activePath && resolve(activePath) === dataPath;
  } catch {
    return false;
  } finally {
    await client.close();
  }
}

// Start or reuse a local database and return the connection details to server.js.
export async function connectLocalDatabase() {
  const dataPath = resolve(process.env.LOCAL_DATA_DIR || ".data/mongodb");
  console.log(`Starting StudyPass with local MongoDB in ${dataPath}`);
  if (await existingLocalDatabase(dataPath)) return { uri: localUri };

  await mkdir(dataPath, { recursive: true });
  // WiredTiger stores the workspace on disk at dataPath so it survives a restart.
  const mongo = await MongoMemoryServer.create({
    instance: { dbPath: dataPath, storageEngine: "wiredTiger" },
    binary: { downloadDir: process.env.MONGOMS_DOWNLOAD_DIR || undefined },
  });
  return { uri: mongo.getUri(), mongo };
}
