import { evaluateLocalRag } from "../rag/evaluation/rag-evaluation";

export async function runLocalRagEvaluation(): Promise<void> {
  const report = await evaluateLocalRag();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

if (require.main === module) {
  void runLocalRagEvaluation().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`Local RAG evaluation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
