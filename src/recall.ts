import {
    GuildMember,
    Message,
    PermissionFlagsBits,
    type MessageCreateOptions,
} from "discord.js";
import { allowedGuilds } from "./config.js";
import { getAvailableMessages, getMessage, sql } from "./database.js";

const forwardPrefix = " ";

export async function storeMessage(msg: Message, data: string) {
    if (!canModify(msg.member!, data)) {
        return;
    }

    const isUser = data.startsWith("user ");
    data = stripUserPrefix(data);

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

export async function deleteMessage(msg: Message, data: string) {
    if (!canModify(msg.member!, data)) {
        return;
    }

    const isUser = data.startsWith("user ");
    const messageName = stripUserPrefix(data);

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

export async function listMessages(msg: Message, data: string | null) {
    if (data !== null && !["global", "user"].includes(data)) {
        return;
    }

    const globalMessages: RecallMessage[] = [];
    const userMessages: RecallMessage[] = [];

    const allMessages = await getAvailableMessages(msg.author.id);
    for (const message of allMessages) {
        const group = message.user_id === msg.author.id ? userMessages : globalMessages;
        group.push(message);
    }

    let content = `**Available messages for \`${msg.member!.displayName}\`**`;

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

export async function recallMessage(msg: Message, data: string) {
    if (!msg.channel.isSendable()) {
        return;
    }

    const message = await getMessage(data, msg.author.id);
    if (message === null) {
        return;
    }

    // Forwarded messages cannot be sent as replies to other messages
    const forwarded = isForwardedMessage(message.content);
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

function canModify(member: GuildMember, recallText: string) {
    if (recallText.startsWith("user ")) {
        // Users can always manage personal messages
        return true;
    }

    if (!allowedGuilds.includes(member.guild.id)) {
        // For global messages, the member permissions are only
        // considered if the guild is explicitly allowed
        return false;
    }

    return member.permissions.has(PermissionFlagsBits.ManageMessages, true);
}

function formatMessageList(title: string, messages: RecallMessage[]) {
    return `\n${title}: ${messages.map((m) => `\`${m.name}\``).join(", ")}`;
}

function getMessageCreateOptions(recallText: string): MessageCreateOptions {
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

function stripUserPrefix(recallText: string): string {
    if (recallText.startsWith("user ")) {
        return recallText.slice(5).trim();
    }

    return recallText;
}

/**
 * Checks if a message should be forwarded
 */
function isForwardedMessage(recallText: string) {
    return recallText.startsWith(forwardPrefix);
}
