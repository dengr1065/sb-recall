import postgres from "postgres";

if (!Object.hasOwn(process.env, "DISCORD_TOKEN")) {
    throw new Error("Missing DISCORD_TOKEN environment variable");
}

/** @type {string} */
export const discordToken = process.env.DISCORD_TOKEN;

/** @type {string[]} */
export const allowedGuilds = process.env.ALLOWED_GUILDS?.split(",") ?? [];

export function setupPostgres() {
    if (typeof process.env["DATABASE_URL"] === "string") {
        return postgres(process.env.DATABASE_URL);
    }

    if (typeof process.env["DATABASE_SOCKET"] === "string") {
        return postgres({
            path: process.env.DATABASE_SOCKET,
            database: "shapebot-recall",
        });
    }

    throw new Error("Missing DATABASE_URL or DATABASE_SOCKET");
}
