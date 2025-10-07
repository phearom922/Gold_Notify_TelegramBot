import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "goldbot";
const collName = process.env.MONGODB_COLL || "subscribers";

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


export async function removeSubscriber(chat_id) {
    const c = await getSubscribersCollection();
    // รองรับทั้งกรณีที่เคยเก็บเป็น string หรือ number
    const r = await c.deleteOne({
        $or: [{ chat_id: String(chat_id) }, { chat_id: Number(chat_id) }]
    });
    return r.deletedCount > 0; // true = มีการลบจริง
}

// ✅ ปิด client เพื่อให้ Cron job จบโปรเซสได้
export async function closeDb() {
    try { await client?.close(); } catch { }
    client = undefined;
    coll = undefined;
}
