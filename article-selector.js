#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Article Selector for Content Rewriting
 * Selects random articles from en/total/{java|net} that haven't been modified in 30+ days
 */

// Path relative to repository root
const CONTENT_BASE = path.resolve(__dirname, '../../content/en/total');
const DAYS_THRESHOLD = 30;
const MIN_ARTICLES_PER_RUN = 2;
const MAX_ARTICLES_PER_RUN = 5;

class ArticleSelector {
    constructor() {
        this.selectedArticles = [];
    }

    /**
     * Get last modified date of a file using git
     */
    getLastModifiedDate(filePath) {
        try {
            const gitLog = execSync(`git log -1 --format=%cd --date=short -- "${filePath}"`, { 
                encoding: 'utf8' 
            }).trim();
            return gitLog ? new Date(gitLog) : new Date(0);
        } catch (error) {
            console.warn(`Warning: Could not get git history for ${filePath}`);
            // Fallback to file system modification time
            const stats = fs.statSync(filePath);
            return stats.mtime;
        }
    }

    /**
     * Check if file was modified within the threshold days
     */
    isFileOldEnough(filePath) {
        const lastModified = this.getLastModifiedDate(filePath);
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - DAYS_THRESHOLD);
        
        return lastModified < thresholdDate;
    }

    /**
     * Get all markdown files from a directory
     */
    getMarkdownFiles(dirPath) {
        try {
            return fs.readdirSync(dirPath)
                .filter(file => file.endsWith('.md') && !file.startsWith('_index'))
                .map(file => path.join(dirPath, file))
                .filter(filePath => this.isFileOldEnough(filePath));
        } catch (error) {
            console.warn(`Warning: Could not read directory ${dirPath}`);
            return [];
        }
    }

    /**
     * Randomly select between java (1) and net (0)
     */
    randomPlatformChoice() {
        return Math.random() < 0.5 ? 'net' : 'java';
    }

    /**
     * Select random articles for rewriting
     */
    selectArticles() {
        // First, randomly decide how many articles to process (2-5)
        const articlesToProcess = Math.floor(Math.random() * (MAX_ARTICLES_PER_RUN - MIN_ARTICLES_PER_RUN + 1)) + MIN_ARTICLES_PER_RUN;
        
        console.log(`🎲 Randomly selected to process ${articlesToProcess} articles this run`);
        
        const availableArticles = {
            java: this.getMarkdownFiles(path.join(CONTENT_BASE, 'java')),
            net: this.getMarkdownFiles(path.join(CONTENT_BASE, 'net'))
        };

        console.log(`Found ${availableArticles.java.length} eligible Java articles`);
        console.log(`Found ${availableArticles.net.length} eligible .NET articles`);

        const selected = [];

        for (let i = 0; i < articlesToProcess; i++) {
            const platform = this.randomPlatformChoice();
            const articles = availableArticles[platform];
            
            if (articles.length === 0) {
                console.log(`No eligible articles found for ${platform}, skipping iteration ${i + 1}`);
                continue;
            }

            // Remove already selected articles from the pool
            const unselectedArticles = articles.filter(article => 
                !selected.some(sel => sel.path === article)
            );

            if (unselectedArticles.length === 0) {
                console.log(`All ${platform} articles already selected, skipping iteration ${i + 1}`);
                continue;
            }

            const randomIndex = Math.floor(Math.random() * unselectedArticles.length);
            const selectedPath = unselectedArticles[randomIndex];
            
            selected.push({
                path: selectedPath,
                platform: platform,
                filename: path.basename(selectedPath),
                lastModified: this.getLastModifiedDate(selectedPath).toISOString().split('T')[0]
            });

            console.log(`Selected: ${platform}/${path.basename(selectedPath)}`);
        }

        this.selectedArticles = selected;
        return selected;
    }

    /**
     * Export selected articles as JSON for GitHub Actions
     */
    exportSelection() {
        const selection = {
            timestamp: new Date().toISOString(),
            articles: this.selectedArticles,
            summary: {
                total: this.selectedArticles.length,
                java: this.selectedArticles.filter(a => a.platform === 'java').length,
                net: this.selectedArticles.filter(a => a.platform === 'net').length
            }
        };

        // Write to file for GitHub Actions to consume (write to repo root)
        const outputPath = path.resolve(__dirname, '../../selected-articles.json');
        fs.writeFileSync(outputPath, JSON.stringify(selection, null, 2));
        
        // Also output to stdout for GitHub Actions
        console.log('SELECTED_ARTICLES=' + JSON.stringify(selection.articles));
        
        return selection;
    }
}

// Main execution
if (require.main === module) {
    const selector = new ArticleSelector();
    
    console.log('🔍 Scanning for articles to rewrite...');
    console.log(`📅 Looking for articles older than ${DAYS_THRESHOLD} days`);
    console.log(`🎯 Will randomly select between ${MIN_ARTICLES_PER_RUN}-${MAX_ARTICLES_PER_RUN} articles`);
    
    const selected = selector.selectArticles();
    
    if (selected.length === 0) {
        console.log('❌ No articles found matching criteria');
        process.exit(1);
    }
    
    console.log(`✅ Selected ${selected.length} articles for rewriting`);
    selector.exportSelection();
}

module.exports = ArticleSelector;