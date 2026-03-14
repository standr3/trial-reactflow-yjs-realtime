import {
  Server,
  type onLoadDocumentPayload,
  type onStoreDocumentPayload,
} from "@hocuspocus/server";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import * as Y from "yjs";

const db = await open({
  filename: "./hocuspocus.db",
  driver: sqlite3.Database,
});


// save yjs documents as binary blobs in the database
await db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    name TEXT PRIMARY KEY,
    data BLOB,
    updated_at INTEGER
  )
`);


// triggers when a user enters a room
const onLoadDocument = async ({
  documentName,
  document,
}: onLoadDocumentPayload): Promise<void> => {
  // fetch the data from db ...
  const row = await db.get(
    "SELECT data FROM documents WHERE name = ?",
    documentName
  );

  if (!row) return;

  const update = new Uint8Array(row.data);
  // ... and apply it to the in-memory document to sync it with the client
  Y.applyUpdate(document, update);
};


// triggers automatically when changes are detected
const onStoreDocument = async ({
  documentName,
  document,
}: onStoreDocumentPayload): Promise<void> => {

  // pack the document's state into a buffer using encodeStateAsUpdate...
  const update = Y.encodeStateAsUpdate(document);


  // ...and perform an upsert operation in the db; update existing entry or create a new one if it doesn't exist
  await db.run(
    `
      INSERT INTO documents (name, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(name)
      DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
      `,
    documentName,
    Buffer.from(update),
    Date.now()
  );
};



// Persistance:
// the diagram state is saved and after a reload the same state is retrieved

const server = new Server({
  port: 5000,
  onLoadDocument,
  onStoreDocument,
});
server.listen();