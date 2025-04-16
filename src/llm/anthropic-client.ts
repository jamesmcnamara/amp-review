import { Anthropic } from "@anthropic-ai/sdk";

/**
 * Message content can be either text or multimodal content (text and images)
 */
interface Message {
	role: "user" | "assistant";
	content:
		| string
		| (
				| { type: "text"; text: string }
				| {
						type: "image";
						source: { type: "base64"; media_type: string; data: string };
				  }
		  )[];
}

/**
 * Tool definition with name, description, and JSON schema
 */
interface ToolSpec {
	name: string;
	description?: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

// Model constants
const CLAUDE_3_7_SONNET = "claude-3-7-sonnet-20250219";
const MAX_TOKENS = 8000;

/**
 * Message content can be either text or multimodal content (text and images)
 */
interface Message {
	role: "user" | "assistant";
	content:
		| string
		| (
				| { type: "text"; text: string }
				| {
						type: "image";
						source: { type: "base64"; media_type: string; data: string };
				  }
		  )[];
}

/**?
 * Tool definition with name, description, and JSON schema
 */
interface ToolSpec {
	name: string;
	description?: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

/**
 * Configuration options for AnthropicClient
 */
interface AnthropicClientOptions {
	apiKey: string;
	model?: string;
	maxTokens?: number;
	/**
	 * Whether to enable thinking in Claude responses
	 * See: https://www.anthropic.com/engineering/claude-think-tool
	 */
	enableThinking?: boolean;
	thinkingBudgetTokens?: number;
	/**
	 * Base URL for Anthropic API - only needed if using a proxy
	 */
	baseURL?: string;
}

export class AnthropicClient {
	private client: Anthropic;
	private model: string;
	private maxTokens: number;
	private enableThinking: boolean;
	private thinkingBudgetTokens: number;

	constructor(options: AnthropicClientOptions) {
		this.client = new Anthropic({
			apiKey: options.apiKey,
			baseURL: options.baseURL,
			// Set to false if you're using in a Node.js environment
			dangerouslyAllowBrowser: true,
		});
		this.model = options.model || CLAUDE_3_7_SONNET;
		this.maxTokens = options.maxTokens || MAX_TOKENS;
		this.enableThinking = options.enableThinking ?? true;
		this.thinkingBudgetTokens = options.thinkingBudgetTokens || 4000;
	}

	/**
	 * Send a completion request to Anthropic's Claude model
	 */
	async complete({
		messages,
		systemPrompt,
		tools = [],
		stream = false,
		signal,
	}: {
		messages: Message[];
		systemPrompt?: string;
		tools?: ToolSpec[];
		stream?: boolean;
		signal?: AbortSignal;
	}) {
		// Format the system prompt
		const system = systemPrompt
			? ({ type: "text", text: systemPrompt } as const)
			: undefined;

		// Format the tools
		const formattedTools = tools.map((tool) => ({
			name: tool.name,
			description: tool.description || "",
			input_schema: tool.inputSchema,
		}));

		// Apply token-efficient caching to the last message
		const messagesWithCache = this.withLastMessageCached(messages);

		// Create a base params object
		const baseParams = {
			model: this.model,
			max_tokens: this.maxTokens,
			messages: messagesWithCache,
			system: system ? [system] : undefined,
			tools: formattedTools.length > 0 ? formattedTools : undefined,
			stream,
		};

		// Add thinking capability if enabled
		const params = this.enableThinking
			? {
					...baseParams,
					thinking: {
						type: "enabled",
						budget_tokens: this.thinkingBudgetTokens,
					},
				}
			: baseParams;

		try {
			if (stream) {
				// biome-ignore lint/suspicious/noExplicitAny: Type assertion needed due to compatibility with the SDK
				return this.client.beta.messages.stream(params as any, { signal });
			}
			// biome-ignore lint/suspicious/noExplicitAny: Type assertion needed due to compatibility with the SDK
			return this.client.messages.create(params as any, { signal });
		} catch (error) {
			// Handle abortion errors consistently
			const err = error as Error;
			if (err.name === "APIUserAbortError") {
				throw new DOMException("Aborted", "AbortError");
			}
			throw error;
		}
	}

	/**
	 * Apply caching to the last message in the conversation to improve token efficiency
	 * @see https://www.anthropic.com/news/token-saving-updates
	 */
	private withLastMessageCached(messages: Message[]): Message[] {
		return messages.map((msg, index) => {
			// Only apply caching to the last message with array content
			if (index !== messages.length - 1 || !Array.isArray(msg.content)) {
				return msg;
			}
			return {
				...msg,
				content: msg.content.map((block, blockIndex) => {
					// Only apply caching to the last content block
					if (blockIndex !== msg.content.length - 1) {
						return block;
					}
					return {
						...block,
						cache_control: { type: "ephemeral" },
					};
				}),
			};
		});
	}

	/**
	 * Count tokens for a given input
	 */
	async countTokens({
		messages,
		systemPrompt,
		tools = [],
	}: {
		messages: Message[];
		systemPrompt?: string;
		tools?: ToolSpec[];
	}) {
		// Format the system prompt
		const system = systemPrompt
			? [{ type: "text", text: systemPrompt }]
			: undefined;

		// Format the tools
		const formattedTools = tools.map((tool) => ({
			name: tool.name,
			description: tool.description || "",
			input_schema: tool.inputSchema,
		}));

		// We need to use type assertions here due to slight differences between our types and SDK types
		const response = await this.client.messages.countTokens({
			model: this.model,
			messages: messages as unknown as Parameters<
				typeof this.client.messages.countTokens
			>[0]["messages"],
			system: system as unknown as Parameters<
				typeof this.client.messages.countTokens
			>[0]["system"],
			tools:
				formattedTools.length > 0
					? (formattedTools as unknown as Parameters<
							typeof this.client.messages.countTokens
						>[0]["tools"])
					: undefined,
		});

		return response.input_tokens;
	}

	/**
	 * Calculate estimated cost based on token usage
	 */
	calculateCost(usage: {
		input_tokens: number;
		output_tokens: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	}) {
		// Claude 3.7 Sonnet pricing per million tokens (as of April 2025)
		const pricing = {
			input: 3,
			output: 15, // output tokens include thinking tokens
			cache_creation_input: 3.75,
			cache_read_input: 0.3,
		};

		return (
			(usage.input_tokens * pricing.input) / 1_000_000 +
			(usage.output_tokens * pricing.output) / 1_000_000 +
			((usage.cache_creation_input_tokens ?? 0) *
				pricing.cache_creation_input) /
				1_000_000 +
			((usage.cache_read_input_tokens ?? 0) * pricing.cache_read_input) /
				1_000_000
		);
	}
}

// Example usage:
/*
  const client = new AnthropicClient({
    apiKey: 'your-api-key',
    enableThinking: true,
  });

  // Simple text completion
  const response = await client.complete({
    messages: [
      { role: 'user', content: 'Tell me about quantum computing' }
    ],
    systemPrompt: 'You are a helpful AI assistant.',
  });

  // Stream response
  const stream = await client.complete({
    messages: [
      { role: 'user', content: 'Write a short story about a robot' }
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
      process.stdout.write(chunk.delta.text);
    }
  }

  // With tools
  const toolsResponse = await client.complete({
    messages: [
      { role: 'user', content: 'What is 123 + 456?' }
    ],
    tools: [
      {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'The mathematical expression to evaluate',
            },
          },
          required: ['expression'],
        },
      },
    ],
  });
  */
