/**
 * Client-side mock image-to-video generate.
 * Replace with a real Kling/Seedance call (and a backend) when leaving static hosting.
 */

export type MockGenerateInput = {
  fileName?: string;
  effect?: string;
};

export type MockGenerateResult = {
  ok: true;
  mock: true;
  jobId: string;
  status: "completed";
  fileName: string | null;
  effect: string;
  previewUrl: null;
  message: string;
};

export async function mockGenerate(
  input: MockGenerateInput = {},
): Promise<MockGenerateResult> {
  const effect = input.effect ?? "dolly_zoom";
  if (effect !== "dolly_zoom") {
    throw new Error(`Unsupported effect: ${effect}`);
  }

  // Simulate I2V kickoff latency
  await new Promise((r) => setTimeout(r, 800));

  const jobId = `mock_dz_${Date.now().toString(36)}`;

  return {
    ok: true,
    mock: true,
    jobId,
    status: "completed",
    fileName: input.fileName ?? null,
    effect,
    previewUrl: null,
    message:
      "Mock generate succeeded. Wire Kling/Seedance I2V + storage next; return real previewUrl.",
  };
}
