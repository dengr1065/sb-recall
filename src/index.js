import { Client, GatewayIntentBits, MessageMentions } from "discord.js";
import { discordToken } from "./config.js";
import { deleteMessage, listMessages, sendMessage, storeMessage } from "./handler.js";

const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

bot.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.content.startsWith("=")) {
        return;
    }

    const text = msg.content.trim().toLowerCase();

    const firstSpace = text.indexOf(" ");

    const command = firstSpace > 0 ? text.slice(0, firstSpace) : text;
    const data = firstSpace >= 0 ? text.slice(firstSpace + 1, text.length) : null;

    try {
        switch (command) {
            case "=store": {
                await storeMessage(msg, data);
                break;
            }
            case "=delete": {
                await deleteMessage(msg, data);
                break;
            }
            case "=list": {
                await listMessages(msg, data);
                break;
            }
            default: {
                // Used to handle cases like =message-name
                const fullData = command.slice(1) + " " + (data ?? "");
                await sendMessage(msg, fullData.trim());
            }
        }
    } catch (err) {
        console.error(err);
        await msg.channel.send({
            content: `An error occurred:\n\`\`\`\n${err}\n\`\`\``,
            allowedMentions: {
                repliedUser: false,
            },
        });
    }
});

bot.on("ready", async () => {
    console.log("Logged in!");
});

bot.login(discordToken);
