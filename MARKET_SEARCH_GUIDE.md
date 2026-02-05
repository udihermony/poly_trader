# Market Search Guide

## Overview
The market search feature now uses Polymarket's Events API for better search results and category browsing.

## Features

### 1. **Keyword Search**
Search through events and markets using keywords:
- **Backend**: Searches through Polymarket Events API + Markets API
- **Combines results** from both endpoints for comprehensive coverage
- **Deduplicates** results to avoid showing the same market twice

**Example searches that work well:**
- `bitcoin` - Bitcoin-related markets
- `crypto` - Cryptocurrency markets
- `trump` - Trump-related markets
- `ai` - AI/technology markets
- `sports` - Sports betting markets
- `election` - Election markets

### 2. **Browse by Category**
Click category buttons to filter markets by topic:
- Categories loaded from `/tags` endpoint
- Shows top 10 most relevant categories
- Click a category to see all related markets

### 3. **Trending Markets**
When you first open the Markets page, you'll see trending/popular markets automatically loaded.

## How It Works

### Search Flow
```
User enters search term
    ↓
Backend searches Events API (50 results)
    ↓
Filters events by title/description match
    ↓
Extracts markets from matching events
    ↓
If < 10 results, also searches Markets API (100 results)
    ↓
Combines and deduplicates
    ↓
Returns top 20 results to frontend
```

### Category Browse Flow
```
User clicks category button
    ↓
Backend queries Events API with tag_id filter
    ↓
Extracts all markets from events in that category
    ↓
Returns top 20 results
```

## API Endpoints

### GET /api/markets/search
Search markets by keyword

**Parameters:**
- `query` (string, optional) - Search term
- `limit` (number, optional, default: 20) - Max results

**Example:**
```bash
curl "http://localhost:8000/api/markets/search?query=bitcoin&limit=5"
```

### GET /api/markets/tags
Get available categories/tags

**Example:**
```bash
curl "http://localhost:8000/api/markets/tags"
```

### GET /api/markets/category/:tagId
Get markets by category

**Parameters:**
- `tagId` (string, required) - Category ID
- `limit` (number, optional, default: 20) - Max results

**Example:**
```bash
curl "http://localhost:8000/api/markets/category/1059?limit=10"
```

## Improvements Over Original

### Before:
- ❌ Always returned same markets regardless of search term
- ❌ No category browsing
- ❌ Used only Markets API endpoint
- ❌ Limited to top trending markets only

### After:
- ✅ Actual keyword filtering
- ✅ Browse by category
- ✅ Uses Events API for better coverage
- ✅ Combines multiple data sources
- ✅ Shows trending markets on load
- ✅ Better search results with event context

## Tips for Best Results

1. **Use specific keywords**: "bitcoin" works better than "crypto coins"
2. **Try different phrasings**: "AI" vs "artificial intelligence"
3. **Browse categories**: If search doesn't find what you want, try categories
4. **Check trending**: Sometimes the market you want is already trending

## Known Limitations

- Search limited to top 100 active markets from Polymarket
- Categories depend on Polymarket's tagging (not all markets are tagged)
- Very niche markets may not appear in results
- Search is case-insensitive but requires exact word matches

## Future Enhancements

Potential improvements:
- Fuzzy search (typo tolerance)
- Search history
- Saved searches
- More advanced filtering (by volume, liquidity, end date)
- Full-text search across all Polymarket markets
