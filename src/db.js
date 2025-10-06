import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "goldbot";
const collName = process.env.MONGODB_COLL || "subscribers";

// แชร์ client ข้ามไฟล์/รัน เพื่อประหยัด connection
let client, coll;

export async function getSubscribersCollection() {
    if (!uri) throw new Error("MONGODB_URI is required");
    if (coll) return coll;

    if (!client) {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
        await client.connect();
    }
    const db = client.db(dbName);
    coll = db.collection(collName);
    // index ป้องกันซ้ำ
    await coll.createIndex({ chat_id: 1 }, { unique: true });
    return coll;
}

export async function upsertSubscriber({ chat_id, first_name, username, language_code }) {
    const c = await getSubscribersCollection();
    await c.updateOne(
        { chat_id },
        {
            $setOnInsert: { added_at: new Date().toISOString() },
            $set: { first_name, username, language_code }
        },
        { upsert: true }
    );
}

export async function listChatIds() {
    const c = await getSubscribersCollection();
    const docs = await c.find({}, { projection: { chat_id: 1, _id: 0 } }).toArray();
    return docs.map(d => String(d.chat_id));
}
