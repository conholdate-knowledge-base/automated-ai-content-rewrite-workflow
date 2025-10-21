# Automated Content Rewriting System

This system automatically enhances Knowledge Base articles using AI-powered rewriting to improve SEO and readability while maintaining technical accuracy.

## 🎯 Overview

The system runs daily via GitHub Actions and:
- Randomly selects 2-5 articles from `content/en/total/{java|net}/` that haven't been modified in 30+ days
- Uses LiteLLM API to rewrite opening and closing paragraphs
- Updates the `lastmod` field to current date
- Creates Pull Requests for human review
- Preserves all technical content, links, and code samples

## 🔧 Components

### Scripts (`/.github/scripts/`)

- **`article-selector.js`** - Identifies eligible articles for rewriting
- **`llm-rewriter.js`** - Handles LiteLLM API communication
- **`content-processor.js`** - Main processing logic with validation
- **`content-validator.js`** - Ensures content integrity and quality

### Workflow (`/.github/workflows/`)

- **`content-rewriter.yml`** - GitHub Actions workflow that orchestrates the process

## 🚀 Setup

### 1. Add GitHub Secret

Add your LiteLLM API key as a GitHub repository secret:

```
Repository Settings → Secrets and variables → Actions → New repository secret
Name: LLM_API_KEY
Value: sk-8W05YDkddO7rioWnXjyfng
```

### 2. Configure Reviewers

Edit `.github/workflows/content-rewriter.yml` and add your GitHub username in the reviewers section:

```yaml
reviewers: |
  your-github-username
```

### 3. Test the System

Trigger manually for testing:
```
Repository → Actions → Automated Content Rewriting → Run workflow
```

## 📋 Process Flow

1. **Daily Schedule**: Runs at 2 AM UTC every day
2. **Article Selection**: Random selection using git history analysis
3. **Content Processing**: AI-powered rewriting with validation
4. **Pull Request Creation**: Automatic PR with detailed summary
5. **Human Review**: Manual review and approval before merge

## 🔍 What Gets Modified

### ✅ Modified
- `lastmod` field in front matter (updated to current date)
- Opening paragraph (before first heading/gist)
- Closing paragraph (after last gist)

### ❌ Preserved
- All front matter fields except `lastmod`
- Headings and structure
- Code samples and gist shortcodes
- Links and references
- Technical accuracy and API names

## 📊 Monitoring

### GitHub Actions
- View workflow runs in the Actions tab
- Download processing reports as artifacts
- Monitor for failures and errors

### Pull Requests
- Each run creates a detailed PR with:
  - List of modified articles
  - Summary of changes made
  - Validation results
  - Review checklist

## 🛡️ Safety Features

### Validation
- Front matter integrity checks
- Code sample preservation validation
- Link and reference verification
- Markdown structure validation

### Backup & Recovery
- Automatic backup before modifications
- Instant rollback on validation failures
- Manual rollback via git history

### Rate Limiting
- API call delays to respect limits
- Exponential backoff on failures
- Maximum retry attempts

## 🔧 Configuration

### Adjust Processing Volume
Edit the constants in `article-selector.js`:
```javascript
const DAYS_THRESHOLD = 30;        // Days since last modification
const MIN_ARTICLES_PER_RUN = 2;   // Minimum articles per execution
const MAX_ARTICLES_PER_RUN = 5;   // Maximum articles per execution
```

### Modify LLM Prompts
Edit the system prompts in `llm-rewriter.js` to adjust rewriting style and focus.

### Change Schedule
Modify the cron expression in `content-rewriter.yml`:
```yaml
schedule:
  - cron: '0 2 * * *'  # Daily at 2 AM UTC
```

## 📝 Example Output

### Sample PR Title
```
🤖 Automated Content Enhancement - 2025-10-16
```

### Sample PR Description
```
## 🤖 Automated Content Enhancement

This PR contains automated improvements to knowledge base articles using AI-powered rewriting.

### 📊 Summary
- **Articles processed**: Total: 3, Java: 2, .NET: 1
- **Branch**: `content-update-2025-10-16-1729123456`
- **Timestamp**: 2025-10-16 02:00:15 UTC

### 📄 Modified Files
- `how-to-add-watermark-to-pdf-using-java.md` (JAVA) - opening paragraph, closing paragraph
- `compare-pdf-documents-using-csharp.md` (NET) - opening paragraph, closing paragraph
- `extract-text-from-pdf-in-java.md` (JAVA) - opening paragraph
```

## 🚨 Troubleshooting

### Common Issues

1. **No articles selected**: All articles were modified recently
2. **API failures**: Check LLM_API_KEY secret and API status
3. **Validation errors**: Content structure may have been corrupted
4. **Git conflicts**: Manual intervention required for merge conflicts

### Debug Mode
Enable verbose logging by setting `DEBUG=true` in the workflow environment.

## 📈 Benefits

- **SEO Improvement**: Fresh content signals for search engines
- **Readability Enhancement**: AI-powered writing improvements
- **Automated Maintenance**: Reduces manual content review workload
- **Quality Assurance**: Validation ensures technical accuracy
- **Audit Trail**: Complete history via Pull Requests

## 🔄 Workflow States

- ✅ **Success**: Articles processed and PR created
- ⚠️ **No Content**: No eligible articles found
- ❌ **Failure**: Processing errors or validation failures
- 🔄 **In Progress**: Currently processing articles