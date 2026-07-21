export type FunctionJob = {functionId: string; installationId: string; input: unknown}
export async function runFunctionJob(_job: FunctionJob): Promise<void> {
  // Worker dispatch is intentionally declarative; no eval/new Function execution is permitted.
}
