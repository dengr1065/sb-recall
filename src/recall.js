import { PermissionFlagsBits } from "discord.js";
import { getAvailableMessages, getMessage, sql } from "./database.js";

const forwardPrefix = " ";

/** @type {BotCommand} */
export async function storeMessage(msg, data) {
    if (!canModify(msg.member)) {
        return;
    }

    const isUser = data.startsWith("user ");
    data = isUser ? data.slice(5).trim() : data;

    const asForwarded = data.startsWith("fwd ");
    data = asForwarded ? data.slice(4).trim() : data;

    // Hack: use a special format to denote messages that should be forwarded
    const referencedMessage = await msg.fetchReference();
    const content = asForwarded
        ? `${forwardPrefix}${referencedMessage.channelId}:${referencedMessage.id}`
        : referencedMessage.content;

    await sql`
        INSERT INTO messages (name, content, user_id)
        VALUES(
            ${data},
            ${content},
            ${isUser ? msg.author.id : null}
        );
    `;

    await msg.react("✅");
}

/** @type {BotCommand} */
export async function deleteMessage(msg, data) {
    // All users can save messages for their own usage
    const isUser = data.startsWith("user ");
    if (!canModify(msg.member) && !isUser) {
        return;
    }

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
    if (!msg.channel.isSendable()) {
        return;
    }

    const message = await getMessage(data, msg.author.id);
    if (message === null) {
        return;
    }

    // Forwarded messages cannot be sent as replies to other messages
    const forwarded = isForwardedMessage(message.content);

    /** @type {import("discord.js").Message | null} */
    const reference = forwarded ? null : await msg.fetchReference().catch(() => null);

    if (msg.deletable) {
        await msg.delete();
    }

    if (reference) {
        await reference.reply({
            content: message.content,
        });
    } else {
        const options = getMessageCreateOptions(message.content);
        await msg.channel.send(options);
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

/**
 * @param {string} recallText
 * @returns {import("discord.js").MessageCreateOptions}
 */
function getMessageCreateOptions(recallText) {
    if (isForwardedMessage(recallText)) {
        const [channelId, messageId] = recallText.slice(forwardPrefix.length).split(":");
        return {
            forward: {
                channel: channelId,
                message: messageId,
            },
        };
    }

    return { content: recallText };
}

/**
 * Checks if a message should be forwarded
 * @param {string} recallText
 */
function isForwardedMessage(recallText) {
    return recallText.startsWith(forwardPrefix);
}
