import type { GenerateCandidatesInput, GeneratedCandidateDraft, Idea } from "@ph4k/core";

const typeLabels: Record<GenerateCandidatesInput["type"], string> = {
  awareness: "気づき喚起型",
  overtime: "残業訴求型",
  before_after: "Before/After系",
  double_question: "問いかけ2連発",
  light_achievement: "軽い実績・共感系",
  cta: "CTA",
  constraint: "制約提示型",
  viral: "拡散特化型",
};

export class OpenAiCandidateGenerator {
  constructor(
    private readonly promptVersion: string,
    private readonly lpLandingUrl: string,
  ) {}

  async generate(idea: Idea, input: GenerateCandidatesInput): Promise<GeneratedCandidateDraft[]> {
    const landingUrl = this.lpLandingUrl.trim();

    return Array.from({ length: input.count }, (_, index) => ({
      type: input.type,
      promptVersion: this.promptVersion,
      hook: `${typeLabels[input.type]} ${index + 1}: ${idea.title}`,
      body: [
        `${idea.problem}で止まっとる人、多いばい。`,
        `${idea.detail}`,
        "やり方を変えるだけで、見え方はかなり変わる。",
        landingUrl === "" ? "" : `詳細はこちら\n${landingUrl}`,
      ].join("\n"),
    }));
  }
}
