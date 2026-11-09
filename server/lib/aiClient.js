const { Groq } = require('groq-sdk');
const { z } = require('zod');

const MODEL_NAME = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 10000;

class AiFormatError extends Error {
    constructor(message, raw) {
        super(message);
        this.name = 'AiFormatError';
        this.raw = raw;
    }
}

let groqClient = null;
function getClient() {
    if (!groqClient && process.env.GROQ_API_KEY) {
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
            timeout: TIMEOUT_MS
        });
    }
    return groqClient;
}

/**
 * Parses and validates JSON reply using Zod schema.
 * On syntax error, attempts one repair call before throwing AiFormatError.
 */
async function parseJsonReply(rawContent, zodSchema) {
    let parsed;
    try {
        parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    } catch (parseErr) {
        // One repair attempt
        const client = getClient();
        if (client) {
            try {
                const repairCompletion = await client.chat.completions.create({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        {
                            role: 'system',
                            content: 'Fix the malformed JSON below and return ONLY valid JSON.'
                        },
                        { role: 'user', content: rawContent }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.1
                });
                parsed = JSON.parse(repairCompletion.choices[0]?.message?.content || '{}');
            } catch (repairErr) {
                throw new AiFormatError('Failed to parse or repair JSON reply', rawContent);
            }
        } else {
            throw new AiFormatError('Malformed JSON and no LLM client available for repair', rawContent);
        }
    }

    const validation = zodSchema.safeParse(parsed);
    if (!validation.success) {
        throw new AiFormatError(`Schema validation failed: ${validation.error.message}`, parsed);
    }
    return validation.data;
}

/**
 * Generate completion with automatic single retry on network error.
 */
async function generateJson({ messages, temperature = 0.2, schema }) {
    const client = getClient();

    if (!client) {
        // Return null to signal offline / no-key mode
        return null;
    }

    let attempts = 0;
    while (attempts < 2) {
        attempts++;
        try {
            const completion = await client.chat.completions.create({
                model: MODEL_NAME,
                messages,
                temperature,
                response_format: { type: 'json_object' }
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) throw new Error('Empty AI response');
            return await parseJsonReply(content, schema);
        } catch (err) {
            if (attempts >= 2 || err instanceof AiFormatError) {
                throw err;
            }
            console.warn(`AI request attempt ${attempts} failed (${err.message}), retrying once...`);
        }
    }
}

module.exports = {
    generateJson,
    parseJsonReply,
    AiFormatError,
    MODEL_NAME
};
