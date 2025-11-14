# DOCX Engine 2.0 - Advanced Document Templating

**Stage 21 - Document Generation Engine 2.0**
**Version:** 2.0
**Date:** November 14, 2025

---

## Overview

The DOCX Engine 2.0 is an advanced document templating system that supports:
- **Loops** (simple and nested)
- **Conditionals** (if/unless)
- **Inline helpers** (string, date, currency formatting)
- **Repeated sections** (tables and paragraphs)
- **Nested data access** (dot notation)
- **Rich error reporting**

---

## Template Syntax

### Basic Variables

```
{variableName}
```

**Example:**
```
Hello {firstName} {lastName},

Your email is: {email}
```

**Data:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

**Output:**
```
Hello John Doe,

Your email is: john@example.com
```

---

### Nested Variables (Dot Notation)

```
{object.property.nestedProperty}
```

**Example:**
```
Company: {company.name}
Address: {company.address.street}, {company.address.city}
```

**Data:**
```json
{
  "company": {
    "name": "Acme Corp",
    "address": {
      "street": "123 Main St",
      "city": "Springfield"
    }
  }
}
```

---

### Loops

#### Simple Loop

```
{#arrayName}
  Content for each item
  Access item properties: {propertyName}
{/arrayName}
```

**Example:**
```
Team Members:
{#employees}
- {name} ({title})
{/employees}
```

**Data:**
```json
{
  "employees": [
    { "name": "Alice", "title": "Developer" },
    { "name": "Bob", "title": "Designer" },
    { "name": "Charlie", "title": "Manager" }
  ]
}
```

**Output:**
```
Team Members:
- Alice (Developer)
- Bob (Designer)
- Charlie (Manager)
```

#### Nested Loops

```
{#departments}
  Department: {name}
  {#employees}
    - {name}
  {/employees}
{/departments}
```

**Example:**
```
Organization:
{#departments}
{deptName}:
  {#staff}
  • {name} - {role}
  {/staff}

{/departments}
```

**Data:**
```json
{
  "departments": [
    {
      "deptName": "Engineering",
      "staff": [
        { "name": "Alice", "role": "Senior Dev" },
        { "name": "Bob", "role": "Junior Dev" }
      ]
    },
    {
      "deptName": "Marketing",
      "staff": [
        { "name": "Carol", "role": "Manager" }
      ]
    }
  ]
}
```

---

### Conditionals

#### If Statement

```
{#if condition}
  Content shown when condition is true
{/if}
```

**Example:**
```
{#if isPremiumCustomer}
Thank you for being a premium member!
{/if}
```

#### Unless Statement

```
{#unless condition}
  Content shown when condition is false
{/unless}
```

**Example:**
```
{#unless verified}
IMPORTANT: Please verify your account.
{/unless}
```

---

### Inline Helpers

Helpers are special functions that format or transform values.

#### String Helpers

**uppercase:**
```
{upper name}
```
Example: `{upper "john"}` → `JOHN`

**lowercase:**
```
{lower name}
```
Example: `{lower "JOHN"}` → `john`

**capitalize:**
```
{capitalize name}
```
Example: `{capitalize "john doe"}` → `John doe`

**titleCase:**
```
{titleCase name}
```
Example: `{titleCase "john doe"}` → `John Doe`

**truncate:**
```
{truncate description 100}
```
Truncates text to specified length (adds "..." at end)

#### Number & Currency Helpers

**currency:**
```
{currency amount}
{currency amount USD}
{currency amount EUR}
```
Examples:
- `{currency 1234.56}` → `$1,234.56`
- `{currency 1234.56 EUR}` → `€1,234.56`

**number:**
```
{number value}
{number value 2}  (with 2 decimals)
```
Examples:
- `{number 1234.567}` → `1,235`
- `{number 1234.567 2}` → `1,234.57`

**percent:**
```
{percent value}
{percent value 1}  (with 1 decimal)
```
Examples:
- `{percent 75}` → `75%`
- `{percent 75.5 1}` → `75.5%`

#### Date Helpers

**date (simple):**
```
{date dateValue}
{date dateValue short}  → 03/15/2025
{date dateValue long}   → March 15, 2025
{date dateValue iso}    → 2025-03-15
```

**formatDate (custom):**
```
{formatDate dateValue "MM/DD/YYYY"}
{formatDate dateValue "YYYY-MM-DD"}
{formatDate dateValue "DD-MM-YYYY"}
```
Format tokens:
- `YYYY` - 4-digit year
- `MM` - 2-digit month
- `DD` - 2-digit day
- `HH` - 2-digit hours
- `mm` - 2-digit minutes
- `ss` - 2-digit seconds

#### Array Helpers

**join:**
```
{join tags ", "}
```
Example: `{join ["tag1", "tag2", "tag3"] ", "}` → `tag1, tag2, tag3`

**length:**
```
Total items: {length items}
```

**first:**
```
First item: {first items}
```

**last:**
```
Last item: {last items}
```

#### Conditional Helpers

**isEmpty / isNotEmpty:**
```
{#if isEmpty(description)}
No description provided
{/if}
```

**defaultValue:**
```
{defaultValue notes "No notes"}
```
Shows "No notes" if notes is null/empty

#### Boolean Helpers

**yesno:**
```
{yesno isActive}
```
Example: `{yesno true}` → `Yes`

#### Math Helpers

```
{add value1 value2}
{subtract value1 value2}
{multiply value1 value2}
{divide value1 value2}
```

Examples:
- `{add 10 5}` → `15`
- `{multiply price quantity}` → calculated result

#### Utility Helpers

**pluralize:**
```
{pluralize count "item" "items"}
```
Examples:
- `{pluralize 1 "item"}` → `item`
- `{pluralize 5 "item"}` → `items`
- `{pluralize 2 "child" "children"}` → `children`

---

## Complete Examples

### Invoice Template

```
INVOICE

Date: {formatDate invoiceDate "MM/DD/YYYY"}
Invoice #: {invoiceNumber}

Bill To:
{customer.name}
{customer.address.street}
{customer.address.city}, {customer.address.state} {customer.address.zip}

Items:
{#lineItems}
{description}
Quantity: {quantity}
Unit Price: {currency unitPrice}
Total: {currency (multiply quantity unitPrice)}

{/lineItems}

Subtotal: {currency subtotal}
Tax ({percent taxRate 1}): {currency tax}
Total: {currency total}

{#if isPaid}
PAID - Thank you!
{/if}

{#unless isPaid}
Payment Due: {formatDate dueDate "MMMM DD, YYYY"}
{/unless}
```

### Employee Report

```
{upper companyName}
EMPLOYEE ROSTER

Generated: {formatDate today "MMMM DD, YYYY"}

{#departments}
===== {upper name} =====
Employees: {length employees}

{#employees}
{firstName} {lastName}
Title: {title}
Email: {lower email}
Start Date: {formatDate startDate "MM/DD/YYYY"}
Active: {yesno isActive}

{/employees}

{/departments}

Total Employees: {length allEmployees}
```

### Contract with Conditions

```
ENGAGEMENT AGREEMENT

This agreement is entered into on {formatDate agreementDate "MMMM DD, YYYY"}
between {upper clientName} ("Client") and {upper providerName} ("Provider").

SCOPE OF WORK:
{#services}
{order}. {serviceName}
   Description: {description}
   Fee: {currency fee}
   {#if hasDeadline}
   Deadline: {formatDate deadline "MM/DD/YYYY"}
   {/if}

{/services}

TOTAL FEES: {currency totalFees}

{#if requiresDeposit}
DEPOSIT: {currency (multiply totalFees 0.5)} due upon signing
{/if}

PAYMENT TERMS:
{#if paymentTerms}
{paymentTerms}
{/if}
{#unless paymentTerms}
Net 30 days from invoice date
{/unless}

SIGNATURES:

_______________________        Date: __________
{clientName}

_______________________        Date: __________
{providerName}
```

---

## Error Handling

### Common Errors

**Missing Variable:**
```
Error: Variable 'userName' not found
```
Solution: Ensure all referenced variables are provided in data

**Unclosed Loop:**
```
Error: Loop 'items' not closed
```
Solution: Add closing tag `{/items}`

**Invalid Helper:**
```
Error: Helper 'unknownHelper' not found
```
Solution: Use only documented helpers

**Type Mismatch:**
```
Error: currency helper expects number, got string
```
Solution: Ensure correct data types

---

## Best Practices

### 1. Variable Naming
- Use camelCase: `firstName`, `orderDate`
- Avoid special characters
- Be descriptive: `clientEmailAddress` not just `email`

### 2. Data Structure
- Keep nested structures shallow (3 levels max)
- Use arrays for repeating data
- Provide default values for optional fields

### 3. Conditionals
- Keep conditions simple
- Use `isEmpty` / `isNotEmpty` for null checks
- Provide fallback content with `{#unless}`

### 4. Loops
- Test with empty arrays
- Provide meaningful data for nested loops
- Use helpers inside loops (e.g., `{currency}`, `{formatDate}`)

### 5. Formatting
- Use consistent date formats
- Always format currency
- Use titleCase for proper names

---

## Helper Function Reference

| Helper | Purpose | Example |
|--------|---------|---------|
| `upper` | Uppercase | `{upper "hello"}` → `HELLO` |
| `lower` | Lowercase | `{lower "HELLO"}` → `hello` |
| `capitalize` | Capitalize first letter | `{capitalize "hello"}` → `Hello` |
| `titleCase` | Title case | `{titleCase "hello world"}` → `Hello World` |
| `currency` | Format currency | `{currency 1234.56}` → `$1,234.56` |
| `number` | Format number | `{number 1234.567 2}` → `1,234.57` |
| `percent` | Format percent | `{percent 75}` → `75%` |
| `date` | Format date (presets) | `{date value "short"}` |
| `formatDate` | Format date (custom) | `{formatDate value "MM/DD/YYYY"}` |
| `join` | Join array | `{join tags ", "}` |
| `length` | Array length | `{length items}` |
| `first` | First element | `{first items}` |
| `last` | Last element | `{last items}` |
| `isEmpty` | Check if empty | `{isEmpty value}` |
| `isNotEmpty` | Check if not empty | `{isNotEmpty value}` |
| `defaultValue` | Default if empty | `{defaultValue notes "None"}` |
| `yesno` | Boolean to text | `{yesno true}` → `Yes` |
| `add` | Addition | `{add 5 3}` → `8` |
| `subtract` | Subtraction | `{subtract 10 3}` → `7` |
| `multiply` | Multiplication | `{multiply 5 3}` → `15` |
| `divide` | Division | `{divide 10 2}` → `5` |
| `pluralize` | Pluralize word | `{pluralize 2 "item"}` → `items` |
| `truncate` | Truncate text | `{truncate text 50}` |
| `replace` | Replace text | `{replace text "old" "new"}` |

---

## Technical Notes

### Supported File Formats
- **Input:** DOCX (Microsoft Word)
- **Output:** DOCX, PDF (with LibreOffice)

### Performance
- Templates are compiled once per render
- Typical render time: <100ms for simple templates
- PDF conversion adds 1-3 seconds

### Limitations
- Max template size: 10MB
- Max output size: 50MB
- Nested loops: Up to 5 levels deep
- Variables per template: Unlimited

---

## Migration from Engine 1.0

### Breaking Changes
None - Engine 2.0 is fully backward compatible

### New Features
- Inline helpers
- Nested loops
- Unless conditionals
- Custom date formats
- Math operations
- Array helpers

### Recommended Updates
1. Replace manual formatting with helpers:
   - Before: `{UPPER(name)}` or custom code
   - After: `{upper name}`

2. Simplify conditionals:
   - Before: Complex if-else in code
   - After: `{#if}...{/if}`

3. Use formatDate for consistency:
   - Before: Various date formats
   - After: `{formatDate value "MM/DD/YYYY"}`

---

## Support & Resources

- **Documentation:** `/docs/DOCX_ENGINE_2.0.md`
- **API Reference:** `/docs/api/DOCX_RENDERING.md`
- **Examples:** `/docs/examples/docx-templates/`
- **Tests:** `/tests/unit/services/docxRenderer2.test.ts`

---

**Version:** 2.0
**Last Updated:** November 14, 2025
**Author:** VaultLogic Development Team
