#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Content Validator - Ensures rewritten content maintains quality and integrity
 */

class ContentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Validate front matter integrity
     */
    validateFrontMatter(content) {
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        
        if (!frontMatterMatch) {
            this.errors.push('Missing or malformed front matter');
            return false;
        }

        const frontMatter = frontMatterMatch[1];
        
        // Required fields
        const requiredFields = ['title', 'productname', 'productkey', 'platformkey', 'date', 'lastmod', 'type'];
        
        for (const field of requiredFields) {
            if (!frontMatter.includes(`${field}:`)) {
                this.errors.push(`Missing required field: ${field}`);
            }
        }

        // Validate date formats (YYYY-MM-DD)
        const dateFields = ['date', 'lastmod'];
        for (const field of dateFields) {
            const match = frontMatter.match(new RegExp(`${field}:\\s*(\\d{4}-\\d{2}-\\d{2})`));
            if (match) {
                const dateStr = match[1];
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    this.errors.push(`Invalid date format for ${field}: ${dateStr} (should be YYYY-MM-DD)`);
                }
            }
        }

        return this.errors.length === 0;
    }

    /**
     * Validate that gist shortcodes are preserved
     */
    validateGistPreservation(originalContent, newContent) {
        // Fixed regex to properly match full gist shortcode including closing }}
        const originalGists = (originalContent.match(/\{\{<\s*gist[\s\S]*?\>\}\}/g) || []);
        const newGists = (newContent.match(/\{\{<\s*gist[\s\S]*?\>\}\}/g) || []);

        if (originalGists.length !== newGists.length) {
            this.errors.push(`Gist count mismatch: original ${originalGists.length}, new ${newGists.length}`);
            return false;
        }

        // Check that each gist is preserved exactly
        for (let i = 0; i < originalGists.length; i++) {
            if (originalGists[i] !== newGists[i]) {
                this.errors.push(`Gist ${i + 1} was modified: "${originalGists[i]}" -> "${newGists[i]}"`);
            }
        }

        return this.errors.length === 0;
    }

    /**
     * Validate that headings are preserved
     */
    validateHeadingsPreservation(originalContent, newContent) {
        const originalHeadings = (originalContent.match(/^#{1,6}\s+.+$/gm) || []);
        const newHeadings = (newContent.match(/^#{1,6}\s+.+$/gm) || []);

        if (originalHeadings.length !== newHeadings.length) {
            this.warnings.push(`Heading count changed: original ${originalHeadings.length}, new ${newHeadings.length}`);
        }

        // Check for significant heading changes
        const originalHeadingTexts = originalHeadings.map(h => h.replace(/^#+\s+/, ''));
        const newHeadingTexts = newHeadings.map(h => h.replace(/^#+\s+/, ''));

        for (let i = 0; i < Math.min(originalHeadingTexts.length, newHeadingTexts.length); i++) {
            if (originalHeadingTexts[i] !== newHeadingTexts[i]) {
                this.warnings.push(`Heading ${i + 1} changed: "${originalHeadingTexts[i]}" -> "${newHeadingTexts[i]}"`);
            }
        }

        return true;
    }

    /**
     * Validate that links are preserved
     */
    validateLinksPreservation(originalContent, newContent) {
        const originalLinks = (originalContent.match(/\[([^\]]*)\]\([^)]+\)/g) || []);
        const newLinks = (newContent.match(/\[([^\]]*)\]\([^)]+\)/g) || []);

        if (originalLinks.length !== newLinks.length) {
            this.warnings.push(`Link count changed: original ${originalLinks.length}, new ${newLinks.length}`);
        }

        // Check for broken internal links
        const internalLinkPattern = /\{\{<\s*site\/baseurl\s*\>\}/g;
        const originalInternalLinks = (originalContent.match(internalLinkPattern) || []);
        const newInternalLinks = (newContent.match(internalLinkPattern) || []);

        if (originalInternalLinks.length !== newInternalLinks.length) {
            this.errors.push(`Internal link count mismatch: original ${originalInternalLinks.length}, new ${newInternalLinks.length}`);
        }

        return this.errors.length === 0;
    }

    /**
     * Validate markdown structure
     */
    validateMarkdownStructure(content) {
        // Check for broken markdown elements
        const issues = [];

        // Check for unmatched brackets
        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/\]/g) || []).length;
        if (openBrackets !== closeBrackets) {
            issues.push(`Unmatched square brackets: ${openBrackets} open, ${closeBrackets} close`);
        }

        // Check for unmatched parentheses in links
        const openParens = (content.match(/\]\(/g) || []).length;
        const closeParens = (content.match(/\)\s*[^(]/g) || []).length;
        if (Math.abs(openParens - closeParens) > 1) { // Allow for some flexibility
            this.warnings.push(`Potential unmatched parentheses in links`);
        }

        // Check for broken code blocks
        const codeBlocks = content.match(/```/g);
        if (codeBlocks && codeBlocks.length % 2 !== 0) {
            issues.push('Unmatched code block markers (```)');
        }

        this.errors.push(...issues);
        return issues.length === 0;
    }

    /**
     * Validate content length (shouldn't be dramatically different)
     */
    validateContentLength(originalContent, newContent) {
        const originalLength = originalContent.length;
        const newLength = newContent.length;
        const ratio = newLength / originalLength;

        if (ratio < 0.5) {
            this.warnings.push(`Content significantly shortened: ${Math.round((1 - ratio) * 100)}% reduction`);
        } else if (ratio > 2.0) {
            this.warnings.push(`Content significantly lengthened: ${Math.round((ratio - 1) * 100)}% increase`);
        }

        return true;
    }

    /**
     * Validate a single file
     */
    validateFile(filePath, originalContent = null) {
        this.errors = [];
        this.warnings = [];

        try {
            const content = fs.readFileSync(filePath, 'utf8');

            // Basic validations
            this.validateFrontMatter(content);
            this.validateMarkdownStructure(content);

            // If we have original content, do comparison validations
            if (originalContent) {
                this.validateGistPreservation(originalContent, content);
                this.validateHeadingsPreservation(originalContent, content);
                this.validateLinksPreservation(originalContent, content);
                this.validateContentLength(originalContent, content);
            }

            return {
                valid: this.errors.length === 0,
                errors: [...this.errors],
                warnings: [...this.warnings]
            };

        } catch (error) {
            return {
                valid: false,
                errors: [`Failed to validate file: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * Create backup of original content
     */
    static createBackup(filePath) {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        fs.copyFileSync(filePath, backupPath);
        return backupPath;
    }

    /**
     * Restore from backup
     */
    static restoreFromBackup(filePath, backupPath) {
        fs.copyFileSync(backupPath, filePath);
        fs.unlinkSync(backupPath); // Clean up backup
    }
}

module.exports = ContentValidator;