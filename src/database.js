import postgres from "postgres";

export const sql = postgres({
    path: process.env.DATABASE_SOCKET,
    user: "shapez",
    database: "shapebot-recall",
});

await sql`
    CREATE TABLE IF NOT EXISTS messages (
        id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        user_id NUMERIC,
        created TIMESTAMP NOT NULL DEFAULT current_timestamp,
        UNIQUE (name, user_id)
    );
`;

/**
 * @param {string} name Name of the message
 * @param {string} userId Discord ID of the requesting user
 * @returns {Promise<RecallMessage | null>}
 */
export async function getMessage(name, userId) {
    /** @type {RecallMessage[]} */
    const rows = await sql`
        SELECT * FROM messages
        WHERE name = ${name} AND (user_id = ${userId} OR user_id IS NULL)
        ORDER BY user_id ASC
        LIMIT 1;
    `;

    return rows[0] ?? null;
}

/**
 * @param {string} userId Discord ID of the requesting user
 * @returns {Promise<RecallMessage[]>}
 */
export async function getAvailableMessages(userId) {
    return await sql`
        SELECT * FROM messages
        WHERE user_id = ${userId} OR user_id IS NULL
        ORDER BY name ASC;
    `;
}
