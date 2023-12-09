import { configDotenv } from "dotenv";

configDotenv();
if (["DISCORD_TOKEN", "DATABASE_SOCKET"].some((k) => !(k in process.env))) {
    process.exitCode = 1;
    throw new Error("Missing DISCORD_TOKEN or DATABASE_SOCKET");
}

/** @type {string} */
export const discordToken = process.env.DISCORD_TOKEN;

/** @type {string} */
export const databaseSocket = process.env.DATABASE_SOCKET;
