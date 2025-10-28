import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Content, StreamPart } from "@google/genai";

export interface ChatMessage extends Content {}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private readonly MODEL = 'gemini-2.5-flash';

  constructor() {
    const apiKey = (window as any).process?.env?.API_KEY || '';
    if (!apiKey) {
      console.error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateSummary(text: string, question: string): Promise<string> {
    const prompt = `
      Eres un experto literario. Genera un resumen del siguiente texto con un tono literario y elocuente.
      Si el usuario ha hecho una pregunta, enfoca el resumen en responderla.

      Pregunta del usuario: "${question || 'No se proporcionó ninguna pregunta específica.'}"

      Texto a resumir:
      ---
      ${text.substring(0, 100000)}
      ---

      Resumen:
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.MODEL,
        contents: prompt
      });
      return response.text;
    } catch (error) {
      console.error("Gemini API error in generateSummary:", error);
      throw new Error("No se pudo generar el resumen. Verifica la configuración de la API Key o la conexión.");
    }
  }

  async refineSummary(originalText: string, previousSummary: string, request: string): Promise<string> {
    const prompt = `
      Eres un experto literario. Tu tarea es refinar un resumen existente de una novela basándote en la petición del usuario.

      Petición del usuario para el refinamiento: "${request}"

      Resumen Anterior:
      ---
      ${previousSummary}
      ---

      Contexto del texto original (fragmento para referencia):
      ---
      ${originalText.substring(0, 50000)}
      ---

      Por favor, genera un nuevo resumen mejorado que incorpore la petición del usuario, manteniendo un tono literario y elocuente. No incluyas preámbulos, solo el resumen refinado.

      Nuevo Resumen Refinado:
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.MODEL,
        contents: prompt
      });
      return response.text;
    } catch (error) {
        console.error("Gemini API error in refineSummary:", error);
        throw new Error("No se pudo refinar el resumen.");
    }
  }
  
  chatWithContextStream(context: string, history: ChatMessage[]): AsyncGenerator<StreamPart> {
    const systemInstruction = `
      Eres un chatbot experto en la novela proporcionada. Tu único contexto es el texto de esta novela. 
      Responde las preguntas del usuario basándote exclusivamente en este texto. 
      Si la respuesta no se encuentra en el texto, indica amablemente que no tienes esa información.
      ---
      CONTEXTO DE LA NOVELA:
      ${context.substring(0, 200000)}
      ---
    `;

    return this.ai.models.generateContentStream({
        model: this.MODEL,
        contents: history,
        config: { systemInstruction }
    });
  }

  async translateText(text: string): Promise<string> {
    const prompt = `
      Traduce el siguiente texto al español de manera fluida, precisa y culturalmente resonante. 
      Mantén la voz y el tono del autor. Preserva los saltos de párrafo y la estructura básica.
      
      Texto original:
      ---
      ${text.substring(0, 100000)}
      ---

      Traducción:
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.MODEL,
        contents: prompt
      });
      return response.text;
    } catch (error) {
      console.error("Gemini API error in translateText:", error);
      throw new Error("Error: No se pudo traducir el texto.");
    }
  }

  public formatText(text: string): string {
    // Basic formatting: replace newlines with <br> for HTML display
    return text.replace(/\n\g, '<br>');
  }
}