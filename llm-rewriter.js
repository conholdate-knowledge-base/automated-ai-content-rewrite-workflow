#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

/**
 * LLM Integration Module for Content Rewriting
 * Handles API calls to LiteLLM service for content enhancement
 */

class LLMRewriter {
    constructor(apiKey, apiUrl = 'https://llm.professionalize.com/v1/chat/completions') {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
        this.model = 'gpt-oss';
    }

    /**
     * Make API call to LiteLLM service
     */
    async callLLM(messages, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 1000
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                const data = await response.json();
                return data.choices[0].message.content;
            } catch (error) {
                console.error(`LLM API attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    throw new Error(`LLM API failed after ${maxRetries} attempts: ${error.message}`);
                }
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    /**
     * Generate system prompt for content rewriting
     */
    getSystemPrompt() {
        return `You are an expert technical content writer specializing in software development tutorials. Your task is to rewrite content to improve readability, SEO, and engagement while maintaining technical accuracy.

CRITICAL REQUIREMENTS:
- Preserve all technical accuracy and facts
- Keep the same meaning and information
- Improve readability and flow
- Enhance SEO-friendly language
- Maintain professional, educational tone
- Do NOT change any technical details, API names, or code references
- Do NOT add new information not present in original
- Focus on better phrasing and structure
- PRESERVE ALL LINKS exactly as they appear, including markdown links and Hugo shortcodes like {{< site/baseurl >}}
- PRESERVE ALL internal references and cross-links to other articles
- Keep all URLs, file paths, and technical references intact

Your rewrite should be engaging, clear, and informative while staying true to the original content.`;
    }

    /**
     * Rewrite opening paragraph
     */
    async rewriteOpeningParagraph(originalText, articleTitle, platform) {
        const messages = [
            {
                role: 'system',
                content: this.getSystemPrompt()
            },
            {
                role: 'user',
                content: `Please rewrite this opening paragraph for a ${platform} tutorial article titled "${articleTitle}". 

Make it more engaging and SEO-friendly while preserving all technical information and maintaining the same meaning:

"${originalText}"

Return ONLY the rewritten paragraph, no additional text or explanations.`
            }
        ];

        return await this.callLLM(messages);
    }

    /**
     * Rewrite closing paragraph
     */
    async rewriteClosingParagraph(originalText, articleTitle, platform) {
        const messages = [
            {
                role: 'system',
                content: this.getSystemPrompt()
            },
            {
                role: 'user',
                content: `Please rewrite this closing paragraph for a ${platform} tutorial article titled "${articleTitle}". 

Make it more engaging and provide a better conclusion while preserving all technical information and maintaining the same meaning:

"${originalText}"

Return ONLY the rewritten paragraph, no additional text or explanations.`
            }
        ];

        return await this.callLLM(messages);
    }

    /**
     * Add delay between API calls to respect rate limits
     */
    async delay(ms = 2000) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = LLMRewriter;