import { Inject, Injectable } from "@nestjs/common";

export const RAG_CHUNK_MAX_CHARACTERS = Symbol("RAG_CHUNK_MAX_CHARACTERS");

export type RagTextChunk = {
  content: string;
  ordinal: number;
  tokenEstimate: number;
};

@Injectable()
export class DeterministicRagChunker {
  constructor(
    @Inject(RAG_CHUNK_MAX_CHARACTERS)
    private readonly maxCharacters: number,
  ) {
    if (maxCharacters < 200 || maxCharacters > 4_000) {
      throw new Error(
        "RAG chunk size must be between 200 and 4000 characters.",
      );
    }
  }

  chunk(content: string): RagTextChunk[] {
    const units = content
      .split(/\n{2,}/)
      .flatMap((paragraph) => this.splitOversized(paragraph.trim()))
      .filter(Boolean);
    const chunks: string[] = [];
    let current = "";
    for (const unit of units) {
      const candidate = current ? `${current}\n\n${unit}` : unit;
      if (candidate.length <= this.maxCharacters) {
        current = candidate;
        continue;
      }
      if (current) chunks.push(current);
      current = unit;
    }
    if (current) chunks.push(current);
    return chunks.map((chunk, ordinal) => ({
      content: chunk,
      ordinal,
      tokenEstimate: Math.max(1, Math.ceil(chunk.length / 4)),
    }));
  }

  private splitOversized(paragraph: string): string[] {
    if (!paragraph || paragraph.length <= this.maxCharacters)
      return [paragraph];
    const words = paragraph.split(/\s+/);
    const parts: string[] = [];
    let current = "";
    for (const word of words) {
      if (word.length > this.maxCharacters) {
        if (current) parts.push(current);
        for (
          let offset = 0;
          offset < word.length;
          offset += this.maxCharacters
        ) {
          parts.push(word.slice(offset, offset + this.maxCharacters));
        }
        current = "";
        continue;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= this.maxCharacters) {
        current = candidate;
      } else {
        if (current) parts.push(current);
        current = word;
      }
    }
    if (current) parts.push(current);
    return parts;
  }
}
