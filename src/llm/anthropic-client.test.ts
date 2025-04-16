import { AnthropicClient } from "./anthropic-client";

async function testClient() {
	const client = new AnthropicClient({
		apiKey: process.env.ANTHROPIC_API_KEY || "",
	});

	try {
		// Now try our wrapper
		console.log("\nTesting our client wrapper...");
		const response = await client.complete({
			messages: [{ role: "user", content: "What is the capital of France?" }],
			systemPrompt: "You are a helpful AI assistant.",
		});

		console.log("Response content:", response);

		// Type assertion to handle the union type
		if ("content" in response) {
			const text = response.content
				.filter((item) => item.type === "text")
				.map((item) => item.text)
				.join("\n");
			console.log("Response text:", text);
			console.log("Response ID:", response.id);
			console.log("Usage:", response.usage);
		} else {
			console.log("Received stream response type");
		}
	} catch (error) {
		console.error("Error:", error);
	}
}

testClient();
