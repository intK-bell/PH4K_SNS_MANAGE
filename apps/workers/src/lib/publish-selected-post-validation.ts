export interface PublishSelectedPostInput {
  candidateId: string;
}

export const validatePublishSelectedPostInput = (
  input: unknown,
): PublishSelectedPostInput => {
  if (!input || typeof input !== "object") {
    throw new Error("input must be an object");
  }

  const candidateId = (input as { candidateId?: unknown }).candidateId;
  if (typeof candidateId !== "string" || candidateId.trim() === "") {
    throw new Error("candidateId is required");
  }

  return {
    candidateId: candidateId.trim(),
  };
};
