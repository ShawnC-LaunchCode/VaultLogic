# Dynamic Dropdown Options - Quick Start Guide

## Overview

Choice questions (dropdown, radio, multiple choice) can now source their options from three different sources:

1. **Static Options** - Manually defined (existing behavior)
2. **From List** - Bind to a ListVariable from Read Table / List Tools blocks
3. **From Table Column** - Load directly from a DataVault table

---

## Usage Examples

### 1. Static Options (Manual Entry)

**When to use:** When you have a fixed set of options that don't change.

**Example:** Product categories

```
Options Source: Static

Display Label    | Saved Value
-----------------|-------------
Electronics      | electronics
Clothing         | clothing
Home & Garden    | home_garden
Sports           | sports
```

---

### 2. From List (Read Table / List Tools)

**When to use:** When options come from a preceding Read Table or List Tools block.

**Example:** Dynamic user list from database

**Step 1:** Create a Read Table block
- Output Variable: `activeUsers`
- Columns: `user_id`, `full_name`, `email`

**Step 2:** Create a Dropdown question
```
Options Source: From List

List Variable:    activeUsers
Label Column:     full_name
Value Column:     user_id
```

**Result:** Dropdown shows user names, but stores user IDs when selected.

---

### 3. From Table Column (Direct Table Read)

**When to use:** When you want to load options directly from a table without a preceding block.

**Example:** Country selector

```
Options Source: From Table

Data Source ID:   550e8400-e29b-41d4-a716-446655440000
Table ID:         660e8400-e29b-41d4-a716-446655440000
Column ID:        770e8400-e29b-41d4-a716-446655440000
Label Column ID:  (optional - for separate display name)
Limit:            100
```

---

## Easy Mode vs Advanced Mode

### Easy Mode
- Shows dropdown: "Static Options" or "From Saved Data"
- Only supports Static and From List sources
- Hides complexity like limit controls
- Best for simple workflows

### Advanced Mode
- Shows three-button control: [Static] [From List] [From Table]
- Full feature access including table column source
- Exposed controls for limit, filters (future), sort (future)
- Best for complex data-driven workflows

---

## Label vs Value Separation

**Key Concept:** What the user sees vs what gets stored

**Display Label (Label):**
- What the end user sees in the dropdown/radio/checkbox
- Human-friendly text
- Example: "John Doe", "United States", "Option 1"

**Saved Value (Alias):**
- What gets stored in the workflow data
- Used in conditional logic, transforms, documents
- Example: "user_123", "us", "option_1"

**Why this matters:**
- You can change display labels without breaking logic
- You can use meaningful IDs instead of display text
- Supports internationalization (translate labels, keep values)

---

## Required Questions & Visibility

**Required Questions:**
- Block progression when visible and unanswered
- Hidden questions never block

**Visibility Rules:**
- Works with conditional logic
- Works with step-level `visibleIf` expressions
- Dynamic options load when question becomes visible

---

## Preview & Testing

**In Preview Mode:**
- Static options: Rendered immediately
- List sources: Loaded from preview context (if available)
- Table sources: Fetched from API asynchronously

**Loading States:**
- Shows "Loading options..." while fetching
- Shows error message if fetch fails
- Shows "No options available" if empty

---

## Best Practices

### Performance
- Keep option lists under 100 items for dropdown (use limit)
- For very large lists (1000+), consider using searchable mode (future)
- Cache table column sources when possible (future enhancement)

### Data Modeling
- Use meaningful aliases (IDs) instead of display text
- Keep display labels user-friendly
- Validate data at the source (table) level

### Workflow Design
- Use Read Table + List when you need filtering/sorting
- Use Table Column for simple, direct reads
- Use Static for fixed, unchanging options

---

## Troubleshooting

**"No options available"**
- Check that list variable exists in context
- Verify table/column IDs are correct
- Check permissions on the table

**"Loading options..." never completes**
- Check network tab for failed API requests
- Verify table exists and is accessible
- Check authentication/authorization

**Wrong values being stored**
- Check Value Column ID mapping
- Verify aliases are set correctly
- Review step values in run details

---

## Migration from Old Format

**Old format (deprecated but still works):**
```typescript
{
  type: 'dynamic',
  listVariable: 'usersList',
  labelKey: 'full_name',
  valueKey: 'user_id'
}
```

**New format:**
```typescript
{
  type: 'list',
  listVariable: 'usersList',
  labelColumnId: 'full_name',
  valueColumnId: 'user_id'
}
```

Existing workflows automatically migrate - no action required.

---

## Future Enhancements

Coming soon:
- Visual picker for data sources, tables, columns (no manual UUID entry)
- Preview loaded options in builder
- Filter/sort UI for table sources
- Dependent dropdowns (cascade)
- Remote search (typeahead)
- Virtualized rendering for large lists

---

## Support

For issues or questions, see:
- PROMPT_DB-4_SUMMARY.md (technical implementation details)
- CLAUDE.md (architecture overview)
- Server logs for runtime errors
