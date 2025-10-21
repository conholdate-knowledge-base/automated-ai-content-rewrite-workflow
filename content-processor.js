#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const LLMRewriter = require('./llm-rewriter.js');
const ContentValidator = require('./content-validator.js');

/**
 * Content Rewriting Logic
 * Processes selected articles and rewrites opening/closing paragraphs
 */

class ContentProcessor {
    constructor(apiKey) {
        this.llmRewriter = new LLMRewriter(apiKey);
        this.validator = new ContentValidator();
        this.processedFiles = [];
    }

    /**
     * Parse front matter from markdown file
     */
    parseFrontMatter(content) {
        // Handle both Unix (\n) and Windows (\r\n) line endings
        const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
        if (!frontMatterMatch) {
            throw new Error('No front matter found in file');
        }

        return {
            frontMatter: frontMatterMatch[1],
            content: frontMatterMatch[2]
        };
    }

    /**
     * Update lastmod field in front matter
     */
    updateLastMod(frontMatter) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Replace existing lastmod or add it after date
        if (frontMatter.includes('lastmod:')) {
            return frontMatter.replace(/lastmod:\s*\d{4}-\d{2}-\d{2}/, `lastmod: ${today}`);
        } else {
            // Add lastmod after date field
            return frontMatter.replace(
                /(date:\s*\d{4}-\d{2}-\d{2})/,
                `$1\nlastmod: ${today}`
            );
        }
    }

    /**
     * Extract opening paragraph (before first heading or gist)
     */
    extractOpeningParagraph(content) {
        // Find the first occurrence of ## heading or {{< gist
        const firstHeadingMatch = content.match(/^## /m);
        const firstGistMatch = content.match(/\{\{<\s*gist/);
        
        let endPosition = content.length;
        
        if (firstHeadingMatch && firstGistMatch) {
            endPosition = Math.min(firstHeadingMatch.index, firstGistMatch.index);
        } else if (firstHeadingMatch) {
            endPosition = firstHeadingMatch.index;
        } else if (firstGistMatch) {
            endPosition = firstGistMatch.index;
        }
        
        return content.substring(0, endPosition).trim();
    }

    /**
     * Extract closing paragraphs (after last gist) - returns array of individual paragraphs
     */
    extractClosingParagraphs(content) {
        // Find all gist occurrences - fixed regex to match full gist shortcode including closing }}
        const gistMatches = [...content.matchAll(/\{\{<\s*gist[\s\S]*?\>\}\}/g)];
        
        if (gistMatches.length === 0) {
            return []; // No gist found, no closing paragraphs to rewrite
        }
        
        const lastGist = gistMatches[gistMatches.length - 1];
        const afterLastGist = content.substring(lastGist.index + lastGist[0].length);
        
        // Split into individual paragraphs (separated by double newlines or more)
        const paragraphs = afterLastGist
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0 && !p.match(/^#+\s/)); // Filter out empty paragraphs and headings
        
        return paragraphs;
    }

    /**
     * Process a single article file
     */
    async processArticle(filePath) {
        console.log(`📝 Processing: ${path.basename(filePath)}`);
        
        // Ensure we have the correct absolute path
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '../..', filePath);
        
        try {
            // Read file content
            const originalContent = fs.readFileSync(absolutePath, 'utf8');
            const { frontMatter, content } = this.parseFrontMatter(originalContent);
            
            // Extract title and platform from frontmatter
            const titleMatch = frontMatter.match(/title:\s*"([^"]+)"/);
            const platformMatch = frontMatter.match(/platformkey:\s*"([^"]+)"/);
            
            if (!titleMatch || !platformMatch) {
                throw new Error('Could not extract title or platform from front matter');
            }
            
            const title = titleMatch[1];
            const platform = platformMatch[1];
            
            console.log(`  📋 Title: ${title}`);
            console.log(`  🔧 Platform: ${platform}`);
            
            // Extract paragraphs to rewrite
            const openingParagraph = this.extractOpeningParagraph(content);
            const closingParagraphs = this.extractClosingParagraphs(content);
            
            console.log(`  📝 Opening paragraph length: ${openingParagraph.length} chars`);
            console.log(`  📝 Found ${closingParagraphs.length} closing paragraphs to rewrite`);
            
            if (!openingParagraph && closingParagraphs.length === 0) {
                console.log(`  ⚠️  No content found to rewrite, skipping`);
                return null;
            }
            
            let newContent = content;
            const changes = [];
            
            // Rewrite opening paragraph if exists
            if (openingParagraph) {
                console.log(`  🤖 Rewriting opening paragraph...`);
                const rewrittenOpening = await this.llmRewriter.rewriteOpeningParagraph(
                    openingParagraph, title, platform
                );
                
                newContent = newContent.replace(openingParagraph, rewrittenOpening.trim());
                changes.push('opening paragraph');
                
                // Add delay between API calls
                await this.llmRewriter.delay();
            }
            
            // Rewrite each closing paragraph individually
            if (closingParagraphs.length > 0) {
                console.log(`  🤖 Rewriting ${closingParagraphs.length} closing paragraphs...`);
                
                for (let i = 0; i < closingParagraphs.length; i++) {
                    const paragraph = closingParagraphs[i];
                    console.log(`  🤖 Rewriting closing paragraph ${i + 1}/${closingParagraphs.length}...`);
                    
                    const rewrittenClosing = await this.llmRewriter.rewriteClosingParagraph(
                        paragraph, title, platform
                    );
                    
                    // Replace the original paragraph with the rewritten one
                    newContent = newContent.replace(paragraph, rewrittenClosing.trim());
                    
                    // Add delay between API calls
                    if (i < closingParagraphs.length - 1) {
                        await this.llmRewriter.delay();
                    }
                }
                
                changes.push(`${closingParagraphs.length} closing paragraphs`);
            }
            
            // Update lastmod in front matter
            const updatedFrontMatter = this.updateLastMod(frontMatter);
            
            // Reconstruct the file
            const newFileContent = `---\n${updatedFrontMatter}\n---\n${newContent}`;
            
            // Create backup before writing
            const backupPath = ContentValidator.createBackup(absolutePath);
            
            try {
                // Write the updated content
                fs.writeFileSync(absolutePath, newFileContent);
                
                // Validate the new content
                const validation = this.validator.validateFile(absolutePath, originalContent);
                
                if (!validation.valid) {
                    // Restore from backup if validation fails
                    ContentValidator.restoreFromBackup(absolutePath, backupPath);
                    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
                }
                
                // Clean up backup if validation passed
                fs.unlinkSync(backupPath);
                
                // Add validation info to result
                if (validation.warnings.length > 0) {
                    console.log(`  ⚠️  Warnings: ${validation.warnings.join(', ')}`);
                }
                
            } catch (error) {
                // Ensure backup is cleaned up even on error
                if (fs.existsSync(backupPath)) {
                    ContentValidator.restoreFromBackup(absolutePath, backupPath);
                }
                throw error;
            }
            
            const result = {
                filePath: absolutePath,
                fileName: path.basename(absolutePath),
                title,
                platform,
                changes,
                status: 'success'
            };
            
            this.processedFiles.push(result);
            console.log(`  ✅ Completed: ${changes.join(', ')}`);
            
            return result;
            
        } catch (error) {
            console.error(`  ❌ Error processing ${filePath}:`, error.message);
            
            const result = {
                filePath: absolutePath,
                fileName: path.basename(filePath),
                error: error.message,
                status: 'error'
            };
            
            this.processedFiles.push(result);
            return result;
        }
    }

    /**
     * Process multiple articles
     */
    async processArticles(articlePaths) {
        console.log(`🚀 Starting to process ${articlePaths.length} articles`);
        
        for (let i = 0; i < articlePaths.length; i++) {
            console.log(`\n📄 Processing article ${i + 1}/${articlePaths.length}`);
            await this.processArticle(articlePaths[i]);
            
            // Add delay between articles
            if (i < articlePaths.length - 1) {
                console.log(`  ⏳ Waiting before next article...`);
                await this.llmRewriter.delay(3000); // 3 second delay between articles
            }
        }
        
        return this.processedFiles;
    }

    /**
     * Generate processing report
     */
    generateReport() {
        const successful = this.processedFiles.filter(f => f.status === 'success');
        const failed = this.processedFiles.filter(f => f.status === 'error');
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.processedFiles.length,
                successful: successful.length,
                failed: failed.length
            },
            files: this.processedFiles
        };
        
        // Write detailed report
        fs.writeFileSync('processing-report.json', JSON.stringify(report, null, 2));
        
        console.log(`\n📊 Processing Summary:`);
        console.log(`  ✅ Successful: ${successful.length}`);
        console.log(`  ❌ Failed: ${failed.length}`);
        console.log(`  📄 Total: ${this.processedFiles.length}`);
        
        return report;
    }
}

// Main execution for GitHub Actions
if (require.main === module) {
    const apiKey = process.env.LLM_API_KEY;
    const selectedArticlesJson = process.env.SELECTED_ARTICLES;
    
    if (!apiKey) {
        console.error('❌ LLM_API_KEY environment variable is required');
        process.exit(1);
    }
    
    if (!selectedArticlesJson) {
        console.error('❌ SELECTED_ARTICLES environment variable is required');
        process.exit(1);
    }
    
    let selectedArticles;
    try {
        selectedArticles = JSON.parse(selectedArticlesJson);
    } catch (error) {
        console.error('❌ Invalid SELECTED_ARTICLES JSON:', error.message);
        process.exit(1);
    }
    
    const articlePaths = selectedArticles.map(article => article.path);
    
    const processor = new ContentProcessor(apiKey);
    
    processor.processArticles(articlePaths)
        .then(() => {
            const report = processor.generateReport();
            
            if (report.summary.failed > 0) {
                console.error(`❌ ${report.summary.failed} articles failed to process`);
                process.exit(1);
            }
            
            console.log('🎉 All articles processed successfully!');
        })
        .catch(error => {
            console.error('💥 Fatal error:', error.message);
            process.exit(1);
        });
}

module.exports = ContentProcessor;