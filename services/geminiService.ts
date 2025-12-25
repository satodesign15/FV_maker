
import { GoogleGenAI } from "@google/genai";
import { UploadedImage } from "../types";

type ValidAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

function getClosestAspectRatio(width: number, height: number): ValidAspectRatio {
  const targetRatio = width / height;
  const supportedRatios: { id: ValidAspectRatio; value: number }[] = [
    { id: "16:9", value: 16 / 9 },
    { id: "4:3", value: 4 / 3 },
    { id: "1:1", value: 1 },
    { id: "3:4", value: 3 / 4 },
    { id: "9:16", value: 9 / 16 },
  ];
  return supportedRatios.reduce((prev, curr) => 
    Math.abs(curr.value - targetRatio) < Math.abs(prev.value - targetRatio) ? curr : prev
  ).id;
}

/**
 * 90%以上の再現性を実現するためのプロフェッショナル指示書作成
 */
export const analyzeImageStructure = async (
  referenceImages: UploadedImage[], 
  instructions: string
): Promise<string> => {
  // 常に最新のAPIキーを使用するため、呼び出しの度にインスタンス化
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';

  const imageParts = referenceImages.map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));

  const prompt = `
    あなたは世界最高峰のアートディレクター兼ビジュアルアナリストです。
    添付された参考画像を「色、光、構図、質感」の観点からピクセル単位で深く分析してください。
    
    分析の目的：
    この画像を95%以上の精度で「再構築」するための、AI画像生成モデル向けの完璧なプロンプトを作成すること。
    
    以下の形式で日本語で出力してください：
    ■ デザインDNA分析
    - 構図: 要素の配置、余白、視線誘導のロジック
    - カラーDNA: 使用されている主要な色のトーン、ライティングの方向
    - 素材感: テクスチャのディテール（マット、光沢、粒子感など）
    
    ■ 再構築用マスタープロンプト (英語)
    [ここに詳細な英語プロンプトを記述]
    
    追加のユーザー要望: ${instructions}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [...imageParts, { text: prompt }] },
  });

  return response.text || "分析に失敗しました。";
};

/**
 * 抽出したDNAを元に、高精度なビジュアルを生成
 */
export const generateHighFidelityImage = async (
  referenceImages: UploadedImage[],
  analysisText: string,
  width: number,
  height: number
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-image-preview';
  const aspectRatio = getClosestAspectRatio(width, height);

  // 参考画像自体もコンテキストとして渡す
  const imageParts = referenceImages.slice(0, 3).map(img => ({
    inlineData: { mimeType: img.mimeType, data: img.base64Data }
  }));

  const finalPrompt = `
    TASK: Generate a high-end commercial visual that is 95% identical in style to the provided references.
    
    BLUEPRINT:
    ${analysisText}

    TECHNICAL SPEC:
    - 8k Resolution, Photorealistic, Masterpiece quality.
    - Maintain exact color grading and lighting fidelity.
    - Professional architectural/product photography style.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [...imageParts, { text: finalPrompt }] },
    config: {
      imageConfig: { 
        imageSize: "1K", 
        aspectRatio: aspectRatio 
      }
    }
  });

  // 画像パーツを探してBase64を返す
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("画像の生成に失敗しました。");
};
