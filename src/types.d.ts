import { Message } from "discord.js";

declare global {
    interface RecallMessage {
        id: number;
        name: string;
        content: string;
        user_id: string | null;
        created: Date;
    }

    type BotCommand = (msg: Message, data: string | null) => Promise<void>;
}
