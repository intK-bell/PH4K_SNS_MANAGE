import type { GenerateCandidatesInput, GeneratedCandidateDraft, Idea } from "@ph4k/core";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const SALES_ROLE_DESCRIPTIONS: Record<Exclude<GenerateCandidatesInput["type"], "viral">, string> = {
  awareness: "「あ、それ自分や」と思わせる",
  overtime: "しんどさ・負担を強めに出す",
  before_after: "シンプルに変化を見せる",
  double_question: "質問中心で構成する",
  light_achievement: "「自分だけじゃない」と思わせる",
  cta: "少し話を聞きたい、で終える",
  constraint: "高い・難しい・使われない等を入れる",
};
const TYPE_LABELS: Record<GenerateCandidatesInput["type"], string> = {
  awareness: "気づき喚起型",
  overtime: "残業訴求型",
  before_after: "Before/After型",
  double_question: "問いかけ型",
  light_achievement: "共感型",
  cta: "CTA型",
  constraint: "制約型",
  viral: "拡散特化型",
};
const TYPE_PROMPT_RULES: Record<
  GenerateCandidatesInput["type"],
  {
    hookIntent: string;
    bodySteps: string[];
    avoid: string[];
  }
> = {
  awareness: {
    hookIntent: "「それ普通と思っとったけど、実はムダかもしれん」と気づかせる",
    bodySteps: [
      "現場で普通にやっている行動を出す",
      "その裏で発生しているムダを指摘する",
      "残業や手戻りにつながると示す",
      "現場完結の必要性をにおわせる",
    ],
    avoid: ["革命的", "劇的改善", "誰でも簡単"],
  },
  overtime: {
    hookIntent: "帰社後作業のしんどさを一瞬で思い出させる",
    bodySteps: [
      "帰社後にやる作業を具体的に列挙する",
      "そこに時間が吸われることを示す",
      "本来の仕事ではない感覚を出す",
      "減らせる余地があると締める",
    ],
    avoid: ["ブラック", "地獄", "大げさな被害表現"],
  },
  before_after: {
    hookIntent: "分断運用と現場完結の差をひと目で理解させる",
    bodySteps: [
      "Before を短く示す",
      "After を短く示す",
      "何が減ったかを明示する",
      "現場完結の価値を一言で締める",
    ],
    avoid: ["比較が曖昧な表現", "数字のない誇張", "説明しすぎる前置き"],
  },
  double_question: {
    hookIntent: "自分ごととして答えたくなる状態を作る",
    bodySteps: [
      "質問",
      "もう1つ質問",
      "その問いの背景にある課題を明示する",
      "改善余地を短く示す",
    ],
    avoid: ["弱い質問", "抽象的な問い", "問いだけで終わる構成"],
  },
  light_achievement: {
    hookIntent: "「それ自分だけやない」と安心させる",
    bodySteps: [
      "よくある現場の状況を描く",
      "同じ悩みが多いと伝える",
      "個人の問題ではなく構造の問題だと示す",
      "変えられる可能性を出す",
    ],
    avoid: ["上から目線", "説教っぽい言い回し", "根拠のない断定"],
  },
  cta: {
    hookIntent: "読み手に「少し見てみようかな」と思わせる",
    bodySteps: [
      "課題を短く再提示する",
      "改善後のイメージを見せる",
      "強すぎない CTA を置く",
      "LP リンクへ自然につなぐ",
    ],
    avoid: ["今すぐ", "絶対", "強い押し売り表現"],
  },
  constraint: {
    hookIntent: "現実的な導入障壁を認めて警戒を下げる",
    bodySteps: [
      "制約を先に言う",
      "そのせいで分断運用が続くと示す",
      "でも現場完結したいニーズはあると返す",
      "軽さや使いやすさをにおわせる",
    ],
    avoid: ["他社批判", "高機能すぎる印象", "解決を断言しすぎる表現"],
  },
  viral: {
    hookIntent: "第三者も「それ変やね」と反応したくなる違和感を作る",
    bodySteps: [
      "一見普通の運用を書く",
      "でも冷静に見ると変だと示す",
      "非効率や時代遅れ感を短く出す",
      "余韻を残して終える",
    ],
    avoid: ["専門用語だらけ", "内輪ネタ", "弱いツッコミ"],
  },
};
const INTERNAL_OPERATION_KEYWORDS = [
  "LINE",
  "X",
  "Google Sheets",
  "Sheets",
  "metrics",
  "DynamoDB",
  "Step Functions",
  "webhook",
  "candidate",
  "E2E",
  "テスト",
  "再実行",
  "運用フロー",
  "投稿案",
];

interface OpenAiStructuredCandidateResponse {
  items: Array<{
    hook: string;
    body: string;
  }>;
}

const buildSalesPrompt = (
  idea: Idea,
  input: GenerateCandidatesInput,
  landingUrl: string,
): string => {
  const rules = TYPE_PROMPT_RULES[input.type];

  return `あなたは、BtoBの現場課題に強いSNS投稿ライターです。
X向けの投稿文を${input.count}本生成してください。

# 目的
指定された投稿型に基づき、現場担当者に刺さる投稿を${input.count}本作成する。

# 前提
- 投稿先はX
- 読み手は現場で監査・点検・報告をしている担当者
- 売り込み感は弱くする
- 短く、改行多めで読みやすくする
- 1投稿はXの文字数内に収める
- ハッシュタグ不要
- 誇張しない
- フックが最重要
- ${input.count}本とも切り口を変えること

# 投稿型
${TYPE_LABELS[input.type]}

# 型の役割
${SALES_ROLE_DESCRIPTIONS[input.type as Exclude<GenerateCandidatesInput["type"], "viral">]}

# hookで何を起こすか
${rules.hookIntent}

# bodyを何段で組むか
${rules.bodySteps.map((step, index) => `- ${index + 1}段目: ${step}`).join("\n")}

# ネタ
テーマ: ${idea.title}
課題: ${idea.problem}
詳細: ${idea.detail}

# この投稿で伝える対象サービス
- 写真を用いる業務監査において、記録・共有・報告の分断をなくし、現場で業務を完結させるサービスを前提に書く
- 現場担当者の負担、帰社後の写真整理、報告書作成、残業、導入負荷の高さを主要論点とする
- SNS自動運用の内部仕組みの話にはしない

# 必須ルール
- すべての投稿の最後に必ず以下のリンクをつける
${landingUrl}

# 型ごとのルール
- 気づき喚起型: 「あ、それ自分や」と思わせる
- 残業訴求型: しんどさ・負担を強めに出す
- Before/After型: シンプルに変化を見せる
- 問いかけ型: 質問中心で構成
- 共感型: 「自分だけじゃない」と思わせる
- CTA型: 少し話を聞きたい、で終える
- 制約型: 高い・難しい・使われない等を入れる

# この型で避ける言い回し
${rules.avoid.map((item) => `- ${item}`).join("\n")}

# 禁止
- 同じ表現の繰り返し
- 抽象的すぎる文章
- 「効率化できます」などのありきたり表現
- 強すぎる営業文
- 以下の内部運用用語を本文に出さない
${INTERNAL_OPERATION_KEYWORDS.map((item) => `- ${item}`).join("\n")}

# 出力
JSONで出力すること。各要素は "hook" と "body" を必ず持つこと。`;
};

const buildHarvestPrompt = (
  idea: Idea,
  input: GenerateCandidatesInput,
  landingUrl: string,
): string => {
  const rules = TYPE_PROMPT_RULES.viral;

  return `あなたは、SNSで拡散を生む投稿を作るライターです。
X向け投稿を${input.count}本生成してください。

# 目的
広く反応される投稿を作ること。
現場担当者だけでなく、第三者も「それおかしくない？」と反応する内容にする。

# 前提
- 投稿先はX
- 短く、改行多め
- フック最重要
- 違和感・あるある・ツッコミを重視
- 売り込み感は出さない
- ${input.count}本とも切り口を変える

# hookで何を起こすか
${rules.hookIntent}

# bodyを何段で組むか
${rules.bodySteps.map((step, index) => `- ${index + 1}段目: ${step}`).join("\n")}

# ネタ
テーマ: ${idea.title}
課題: ${idea.problem}
詳細: ${idea.detail}

# この投稿で伝える対象サービス
- 写真を用いる業務監査において、記録・共有・報告の分断をなくし、現場で業務を完結させるサービスを前提に書く
- 現場担当者だけでなく、第三者も違和感を持てるように、現場の非効率さを分かりやすく言い換える
- SNS自動運用の内部仕組みの話にはしない

# 必須ルール
- すべての投稿の最後に必ず以下のリンクをつける
${landingUrl}

# 強化ルール
- 「冷静に考えておかしい」視点を入れる
- 外部の人でも理解できる表現にする
- シンプルにする
- 短く切る

# この型で避ける言い回し
${rules.avoid.map((item) => `- ${item}`).join("\n")}

# 禁止
- 専門用語だらけ
- 内輪ネタすぎる内容
- 弱い問いかけ
- 以下の内部運用用語を本文に出さない
${INTERNAL_OPERATION_KEYWORDS.map((item) => `- ${item}`).join("\n")}

# 出力
JSONで出力すること。各要素は "hook" と "body" を必ず持つこと。`;
};

const normalizeBody = (body: string, landingUrl: string): string => {
  const normalized = body
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/https?:\/\/[^\s]+/g, landingUrl)
    .trim();

  if (landingUrl === "") {
    return normalized;
  }

  if (normalized.includes(landingUrl)) {
    return normalized;
  }

  return `${normalized}\n\n${landingUrl}`.trim();
};

const extractOutputText = (payload: Record<string, unknown>): string => {
  if (typeof payload.output_text === "string" && payload.output_text.trim() !== "") {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: Array<Record<string, unknown>> }).content
      : [];

    for (const block of content) {
      if (typeof block.text === "string" && block.text.trim() !== "") {
        return block.text;
      }
    }
  }

  throw new Error("openai response text not found");
};

const parseStructuredCandidates = (
  rawText: string,
  expectedCount: number,
): OpenAiStructuredCandidateResponse => {
  const parsed = JSON.parse(rawText) as Partial<OpenAiStructuredCandidateResponse>;
  if (!parsed || !Array.isArray(parsed.items) || parsed.items.length !== expectedCount) {
    throw new Error("openai structured candidates shape is invalid");
  }

  for (const item of parsed.items) {
    if (!item || typeof item.hook !== "string" || typeof item.body !== "string") {
      throw new Error("openai structured candidate item is invalid");
    }
  }

  return parsed as OpenAiStructuredCandidateResponse;
};

export class OpenAiCandidateGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly promptVersion: string,
    private readonly lpLandingUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private buildSchema(count: number) {
    return {
      name: "candidate_posts",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: count,
            maxItems: count,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["hook", "body"],
              properties: {
                hook: {
                  type: "string",
                },
                body: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    };
  }

  async generate(idea: Idea, input: GenerateCandidatesInput): Promise<GeneratedCandidateDraft[]> {
    if (this.apiKey.trim() === "") {
      throw new Error("OPENAI_API_KEY is required");
    }

    const landingUrl = this.lpLandingUrl.trim();
    const prompt =
      input.type === "viral"
        ? buildHarvestPrompt(idea, input, landingUrl)
        : buildSalesPrompt(idea, input, landingUrl);

    const response = await this.fetchImpl(OPENAI_RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "system",
            content:
              "You are a precise X post writing assistant. Return only valid JSON that matches the provided schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            ...this.buildSchema(input.count),
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`openai candidate generation failed: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const rawText = extractOutputText(payload);
    const parsed = parseStructuredCandidates(rawText, input.count);

    return parsed.items.map((item) => ({
      type: input.type,
      promptVersion: this.promptVersion,
      hook: item.hook.trim(),
      body: normalizeBody(item.body, landingUrl),
    }));
  }
}
