
import { GoogleGenAI, Type } from "@google/genai";
import { UploadedImage, SuccessStrategy } from "../types";

/**
 * 参考画像から「売れる意図」を深く分析する
 */
export const analyzeSuccessDNA = async (
  referenceImages: UploadedImage[]
): Promise<SuccessStrategy> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';

  const imageParts = referenceImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));

  const prompt = `
    あなたは伝説的なWEBマーケター兼クリエイティブディレクターです。
    添付された「売れているFV（参考画像）」を分析し、その成功の要因（DNA）を抽出してください。
    表面的なデザインだけでなく、裏側の「心理的フック」や「情報設計」を言語化してください。

    JSON形式で出力してください：
    {
      "target": "このFVが狙っている具体的なターゲット層とその悩み",
      "valueProp": "一瞬で心を掴むための『最大の売り』の伝え方",
      "visualHierarchy": "視線誘導の設計意図（何から順に見せているか、配置の黄金律）",
      "colorStrategy": "色の組み合わせがユーザーに与える心理的影響と信頼構築の狙い",
      "copySuggestion": "この成功構造を維持しつつ、新しい商品に適用する場合の最強のキャッチコピー案"
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: { responseMimeType: "application/json" }
  });

  try {
    const text = response.text || "{}";
    return JSON.parse(text) as SuccessStrategy;
  } catch (e) {
    throw new Error("成功DNAの分析に失敗しました。AIの回答を解析できません。");
  }
};

/**
 * アスペクト比の計算
 */
const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  const supported = [
    { name: '1:1', value: 1.0 },
    { name: '3:4', value: 0.75 },
    { name: '4:3', value: 1.333 },
    { name: '9:16', value: 0.5625 },
    { name: '16:9', value: 1.777 },
  ];
  
  return supported.reduce((prev, curr) => 
    Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev
  ).name;
};

/**
 * 分析結果と素材を融合させて、画像を生成・改善する
 */
export const generateFinalFV = async (
  strategy: SuccessStrategy,
  assetImages: UploadedImage[],
  userRequest: string,
  dimensions: { width: number; height: number },
  previousImage?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-image-preview';

  const assetParts = assetImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));

  const mappedRatio = getClosestAspectRatio(dimensions.width, dimensions.height);

  let basePrompt = "";
  const contentParts: any[] = [...assetParts];

  if (previousImage) {
    contentParts.push({
      inlineData: { mimeType: 'image/png', data: previousImage }
    });
    basePrompt = `
      【画像改善指示】
      前回の生成結果（添付画像）を元に、以下の指示に従ってデザインを修正してください。
      指示内容: ${userRequest}
      アスペクト比: ${mappedRatio}
    `;
  } else {
    basePrompt = `
      【新規生成指令】
      抽出されたマーケティング戦略に基づき、提供された商品素材を使用して画像を生成してください。
      ターゲット戦略: ${strategy.target}
      価値提供: ${strategy.valueProp}
      視覚階層: ${strategy.visualHierarchy}
      色彩戦略: ${strategy.colorStrategy}
      配置コピー: 「${strategy.copySuggestion}」
      ユーザー追加要望: ${userRequest}
      アスペクト比: ${mappedRatio}
    `;
  }

  contentParts.push({ text: basePrompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contentParts },
    config: {
      imageConfig: {
        aspectRatio: mappedRatio as any
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }

  throw new Error("画像の生成に失敗しました。");
};
