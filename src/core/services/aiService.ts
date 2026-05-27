export interface AIConfig {
  provider: "ollama" | "openai" | "gemini";
  apiKey: string;
  model: string;
}

export async function generateCompletion(
  prompt: string,
  systemPrompt: string = "",
  config: AIConfig
): Promise<string> {
  const { provider, apiKey, model } = config;

  if (provider === "ollama") {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "llama3",
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const data = await response.json();
    return data.message.content;
  }

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-1.5-flash"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            ...(systemPrompt
              ? [{ role: "user", parts: [{ text: `System instruction: ${systemPrompt}` }] }]
              : []),
            { role: "user", parts: [{ text: prompt }] },
          ],
        }),
      }
    );
    if (!response.ok) throw new Error(`Gemini error: ${response.statusText}`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error("Unsupported AI Provider");
}

export async function generateEmbeddings(
  text: string,
  config: AIConfig
): Promise<number[]> {
  const { provider, apiKey, model } = config;

  if (provider === "ollama") {
    // Try newer Ollama endpoint /api/embed, then fallback to /api/embeddings
    try {
      const response = await fetch("http://localhost:11434/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || "nomic-embed-text",
          input: text,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.embeddings[0];
      }
    } catch {}

    const response = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "nomic-embed-text",
        prompt: text,
      }),
    });
    if (!response.ok) throw new Error(`Ollama embeddings error: ${response.statusText}`);
    const data = await response.json();
    return data.embedding;
  }

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "text-embedding-3-small",
        input: text,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI embeddings error: ${response.statusText}`);
    const data = await response.json();
    return data.data[0].embedding;
  }

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || "text-embedding-004"}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
        }),
      }
    );
    if (!response.ok) throw new Error(`Gemini embeddings error: ${response.statusText}`);
    const data = await response.json();
    return data.embedding.values;
  }

  throw new Error("Unsupported embeddings provider");
}

export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
