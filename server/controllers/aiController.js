import Chat from "../models/Chat.js";
import { getAiReply } from "../services/aiService.js";

export async function chat(req, res, next) {
  try {
    const { message } = req.body;
    const trimmed = message.trim();

    let chatDoc = await Chat.findOne({ userId: req.userId });
    if (!chatDoc) {
      chatDoc = await Chat.create({ userId: req.userId, messages: [] });
    }

    chatDoc.messages.push({ role: "user", text: trimmed });
    const { reply } = await getAiReply(trimmed);
    chatDoc.messages.push({ role: "ai", text: reply });
    await chatDoc.save();

    res.json({ reply });
  } catch (e) {
    next(e);
  }
}

export async function history(req, res, next) {
  try {
    const chatDoc = await Chat.findOne({ userId: req.userId }).lean();
    const messages = chatDoc?.messages ?? [];
    res.json({ messages });
  } catch (e) {
    next(e);
  }
}
