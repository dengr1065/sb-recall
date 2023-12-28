import { PermissionFlagsBits } from "discord.js";
import { getAvailableMessages, getMessage, sql } from "./database.js";

/** @type {BotCommand} */
export async function storeMessage(msg, data) {
    if (!canModify(msg.member)) {
        return;
    }

    const isUser = data.startsWith("user ");
    const messageName = isUser ? data.slice(5).trim() : data;

    const referencedMessage = await msg.fetchReference();

    await sql`
        INSERT INTO messages (name, content, user_id)
        VALUES(
            ${messageName},
            ${referencedMessage.content},
            ${isUser ? msg.author.id : null}
        );
    `;

    await msg.react("✅");
}

/** @type {BotCommand} */
export async function deleteMessage(msg, data) {
    if (!canModify(msg.member)) {
        return;
    }

    const isUser = data.startsWith("user ");
    const messageName = isUser ? data.slice(5).trim() : data;

    const result = await sql`
        DELETE FROM messages
        WHERE name = ${messageName}
        ${isUser ? sql`AND user_id = ${msg.author.id}` : sql`AND user_id IS NULL`};
    `;

    if (result.count === 0) {
        await msg.reply({
            content: `No ${
                isUser ? "user" : "global"
            } message for \`${messageName}\` found.`,
            allowedMentions: {
                repliedUser: false,
            },
        });
        return;
    }

    await msg.react("✅");
}

/** @type {BotCommand} */
export async function listMessages(msg, data) {
    if (data !== null && !["global", "user"].includes(data)) {
        return;
    }

    /** @type {RecallMessage[]} */
    const globalMessages = [];

    /** @type {RecallMessage[]} */
    const userMessages = [];

    const allMessages = await getAvailableMessages(msg.author.id);
    for (const message of allMessages) {
        const group = message.user_id === msg.author.id ? userMessages : globalMessages;
        group.push(message);
    }

    let content = `**Available messages for \`${msg.member.displayName}\`**`;

    if (data !== "user" && globalMessages.length > 0) {
        content += formatMessageList("Global messages", globalMessages);
    }

    if (data !== "global" && userMessages.length > 0) {
        content += formatMessageList("User messages", userMessages);
    }

    await msg.reply({
        content,
        allowedMentions: {
            repliedUser: false,
        },
    });
}

/** @type {BotCommand} */
export async function recallMessage(msg, data) {
    const message = await getMessage(data, msg.author.id);
    if (message === null) {
        return;
    }

    /** @type {import("discord.js").Message | null} */
    let reference = null;
    try {
        reference = await msg.fetchReference();
    } catch {
        // Send the message without replying
    }

    if (msg.deletable) {
        await msg.delete();
    }

    if (reference) {
        await reference.reply({
            content: message.content,
        });
    } else {
        await msg.channel.send({
            content: message.content,
        });
    }
}

/**
 * @param {import("discord.js").GuildMember} member
 */
function canModify(member) {
    return member.permissions.has(PermissionFlagsBits.ManageMessages, true);
}

/**
 * @param {string} title Title of the list
 * @param {RecallMessage[]} messages Messages to include
 */
function formatMessageList(title, messages) {
    return `\n${title}: ${messages.map((m) => `\`${m.name}\``).join(", ")}`;
}
