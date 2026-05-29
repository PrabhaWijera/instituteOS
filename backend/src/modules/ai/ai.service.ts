import Groq from 'groq-sdk';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { groqCircuit } from '../../config/resilience';
import { withRetry } from '../../utils/retry';
import { buildSystemPrompt, isBlockedMessage } from './prompts';
import { ChatInput } from './ai.schema';
import logger from '../../utils/logger';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const GROQ_FALLBACK_MESSAGE =
  "I'm temporarily unavailable due to a technical issue. Please try again in a moment. " +
  "If the problem persists, contact your institute admin.";

class AiService {
  async chat(userId: string, data: ChatInput) {
    // Pre-check for blocked content before calling Groq
    if (isBlockedMessage(data.message)) {
      const refusal =
        "I'm your academic tutor and can only help with school subjects. Please ask me an educational question!";
      await prisma.aiChatMessage.createMany({
        data: [
          {
            userId,
            role: 'user',
            content: data.message,
            subject: data.subject,
            grade: data.grade,
            language: data.language,
          },
          {
            userId,
            role: 'assistant',
            content: refusal,
            subject: data.subject,
            grade: data.grade,
            language: data.language,
          },
        ],
      });
      return { reply: refusal };
    }

    // Load last 10 messages for context window
    const history = await prisma.aiChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: buildSystemPrompt(data.grade, data.subject, data.language) },
      ...history.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: data.message },
    ];

    let reply: string;

    try {
      // Circuit breaker wraps the entire retry block so a series of retried
      // failures still counts as a single "call" for circuit-state purposes.
      reply = await groqCircuit.execute(() =>
        withRetry(
          () =>
            groq.chat.completions
              .create({
                model: 'llama-3.3-70b-versatile',
                messages,
                max_tokens: 1024,
                temperature: 0.7,
              })
              .then((c) => c.choices[0].message.content!),
          {
            maxAttempts: 3,
            initialDelayMs: 500,
            operationName: 'groq-chat',
          },
        ),
      );
    } catch (err) {
      const isOpen = groqCircuit.getState() === 'OPEN';
      logger.error('[AI] Groq call failed', {
        circuitState: groqCircuit.getState(),
        error: (err as Error).message,
        userId,
      });

      // Graceful degradation: save the user message, return a friendly fallback
      await prisma.aiChatMessage.createMany({
        data: [
          {
            userId,
            role: 'user',
            content: data.message,
            subject: data.subject,
            grade: data.grade,
            language: data.language,
          },
          {
            userId,
            role: 'assistant',
            content: GROQ_FALLBACK_MESSAGE,
            subject: data.subject,
            grade: data.grade,
            language: data.language,
          },
        ],
      });

      return {
        reply: GROQ_FALLBACK_MESSAGE,
        degraded: true,
        reason: isOpen ? 'ai_service_circuit_open' : 'ai_service_unavailable',
      };
    }

    // Save both messages in one transaction
    await prisma.$transaction([
      prisma.aiChatMessage.create({
        data: {
          userId,
          role: 'user',
          content: data.message,
          subject: data.subject,
          grade: data.grade,
          language: data.language,
        },
      }),
      prisma.aiChatMessage.create({
        data: {
          userId,
          role: 'assistant',
          content: reply,
          subject: data.subject,
          grade: data.grade,
          language: data.language,
        },
      }),
    ]);

    return { reply };
  }

  async getHistory(userId: string) {
    return prisma.aiChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async clearHistory(userId: string) {
    await prisma.aiChatMessage.deleteMany({ where: { userId } });
    return { message: 'Chat history cleared' };
  }
}

export const aiService = new AiService();
