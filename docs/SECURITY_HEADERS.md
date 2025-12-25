# Security Headers Documentation

## Overview

VaultLogic implements comprehensive security headers using the **Helmet** middleware library to protect against common web vulnerabilities. This document explains which headers are implemented, why they're needed, and any compatibility considerations.

**Last Updated:** December 25, 2025
**Middleware Location:** `server/middleware/securityHeaders.ts`
**Applied in:** `server/index.ts` (line 86)

---

## Headers Implemented

### 1. Content Security Policy (CSP)

**Header:** `Content-Security-Policy`
**Purpose:** Prevents XSS attacks, code injection, and unauthorized resource loading

**Configuration:**
```typescript
{
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.google.com", ...],
  'style-src': ["'self'", "'unsafe-inline'", "https://*.googleapis.com", ...],
  'font-src': ["'self'", "https://*.gstatic.com", "data:"],
  'img-src': ["'self'", "data:", "blob:", "https:"],
  'connect-src': ["'self'", "https://*.google.com", "wss://localhost:*", ...],
  'frame-src': ["'self'", "https://*.google.com"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': []
}
```

**Why these directives:**
- `'unsafe-inline'` and `'unsafe-eval'` in script-src: Required for React/Vite in development
- Google domains: Required for Google OAuth authentication
- WebSocket localhost: Required for development hot module reloading
- `data:` and `blob:` in img-src: Allows inline images and generated content
- `upgrade-insecure-requests`: Automatically upgrades HTTP to HTTPS

**Production Considerations:**
- Use `strictSecurityHeaders()` to remove `'unsafe-inline'` and `'unsafe-eval'`
- Consider restricting `img-src` from `https:` to specific domains

---

### 2. HTTP Strict Transport Security (HSTS)

**Header:** `Strict-Transport-Security`
**Purpose:** Forces browsers to only use HTTPS connections

**Configuration:**
- **Development:** Disabled (not set)
- **Production:** `max-age=31536000; includeSubDomains; preload`

**Values:**
- `max-age`: 1 year (31,536,000 seconds) in default mode, 2 years in strict mode
- `includeSubDomains`: Apply to all subdomains
- `preload`: Eligible for browser HSTS preload lists

**Why disabled in development:**
- Local development typically uses HTTP
- Prevents browser from blocking localhost connections

---

### 3. X-Content-Type-Options

**Header:** `X-Content-Type-Options: nosniff`
**Purpose:** Prevents MIME type sniffing attacks

**Protection:**
- Forces browsers to respect declared Content-Type
- Prevents browsers from executing files with incorrect MIME types
- Mitigates attacks where malicious files are disguised as safe types

---

### 4. X-Frame-Options

**Header:** `X-Frame-Options: DENY`
**Purpose:** Prevents clickjacking attacks

**Values:**
- `DENY`: Page cannot be displayed in a frame (default)
- `SAMEORIGIN`: Page can only be framed by same origin (available via config)

**Why DENY:**
- Strongest protection against clickjacking
- VaultLogic workflows are not designed to be embedded

**Alternative:** Use `allowFraming: 'SAMEORIGIN'` in config if embedding is needed

---

### 5. X-XSS-Protection

**Header:** `X-XSS-Protection: 0`
**Purpose:** Legacy XSS protection for older browsers

**Note:** Helmet sets this to `0` (disabled) by default because:
- Modern browsers rely on CSP for XSS protection
- Legacy XSS filters can introduce vulnerabilities
- CSP provides superior protection

---

### 6. Referrer-Policy

**Header:** `Referrer-Policy: no-referrer-when-downgrade`
**Purpose:** Controls how much referrer information is sent with requests

**Values:**
- `no-referrer-when-downgrade`: Send full referrer for HTTPS→HTTPS, no referrer for HTTPS→HTTP

**Why this policy:**
- Balances privacy with analytics/debugging needs
- Prevents leaking sensitive URLs when downgrading to HTTP
- Allows referrer tracking within secure contexts

---

### 7. X-DNS-Prefetch-Control

**Header:** `X-DNS-Prefetch-Control: off`
**Purpose:** Controls DNS prefetching behavior

**Why disabled:**
- Prevents privacy leaks from speculative DNS lookups
- Reduces external requests
- Minimal performance impact in most cases

---

### 8. X-Download-Options

**Header:** `X-Download-Options: noopen`
**Purpose:** Prevents Internet Explorer from executing downloads in site context

**Protection:**
- IE-specific header
- Prevents downloaded files from executing in the context of the site
- Mitigates "open or save" dialog attacks

---

### 9. X-Permitted-Cross-Domain-Policies

**Header:** `X-Permitted-Cross-Domain-Policies: none`
**Purpose:** Controls Adobe Flash and PDF cross-domain access

**Why 'none':**
- Prevents Flash/PDF files from making cross-domain requests
- Legacy protection (Flash is deprecated)
- No downside to blocking

---

### 10. Cross-Origin-Opener-Policy (COOP)

**Header:** `Cross-Origin-Opener-Policy: unsafe-none`
**Purpose:** Controls cross-origin window interactions

**Why 'unsafe-none':**
- **Required for Google OAuth:** Google Sign-In uses `window.postMessage()` for authentication
- Default policy would block OAuth popup communication
- Trade-off between security and authentication functionality

**Security Note:**
- This is a known limitation when using OAuth popup flows
- Alternative: Use OAuth redirect flow instead of popup (more restrictive)

---

### 11. Cross-Origin-Embedder-Policy (COEP)

**Header:** Not set (explicitly disabled)
**Purpose:** Controls cross-origin resource embedding

**Why disabled:**
- **Required for Google OAuth:** COEP would block OAuth resources
- Strict COEP requires all resources to opt-in with CORS or CORP headers
- Many third-party resources (Google, analytics, etc.) don't set these headers

**Security Note:**
- Disabling COEP is common for applications using third-party services
- Consider enabling if all resources can be controlled

---

### 12. X-Powered-By

**Header:** Removed (not sent)
**Purpose:** Security through obscurity

**Why removed:**
- Default Express header reveals technology stack
- Provides attackers with information about the server
- No functional benefit to including it

---

## Configuration Options

### Default Configuration

```typescript
import { securityHeaders } from './middleware/securityHeaders.js';
app.use(securityHeaders());
```

- CSP: Enabled with development-friendly directives
- HSTS: Enabled only in production
- All other headers: Enabled

### Relaxed Configuration (Development)

```typescript
import { relaxedSecurityHeaders } from './middleware/securityHeaders.js';
app.use(relaxedSecurityHeaders());
```

- CSP: Disabled
- HSTS: Disabled
- X-Frame-Options: SAMEORIGIN
- ⚠️ **NEVER use in production!**

### Strict Configuration (Production)

```typescript
import { strictSecurityHeaders } from './middleware/securityHeaders.js';
app.use(strictSecurityHeaders());
```

- CSP: Enabled without `'unsafe-inline'` or `'unsafe-eval'`
- HSTS: 2 years max-age
- X-Frame-Options: DENY
- ✅ **Recommended for production**

### Custom Configuration

```typescript
app.use(securityHeaders({
  enableCSP: true,
  enableHSTS: true,
  hstsMaxAge: 63072000, // 2 years
  allowFraming: 'SAMEORIGIN',
  cspDirectives: {
    'script-src': ["'self'", 'https://trusted-cdn.com'],
    // Overrides default directives
  },
}));
```

---

## Testing Security Headers

### Manual Testing

Use curl to inspect headers:
```bash
curl -I http://localhost:5000/api/health
```

### Automated Testing

Run the test script:
```bash
npx tsx scripts/testSecurityHeaders.ts
```

Expected output:
```
✓ content-security-policy: ...
ℹ strict-transport-security: (disabled in development)
✓ x-content-type-options: nosniff
✓ x-frame-options: DENY
✓ x-xss-protection: 0
✓ referrer-policy: no-referrer-when-downgrade
✓ x-dns-prefetch-control: off
✓ x-download-options: noopen
✓ x-permitted-cross-domain-policies: none
✓ cross-origin-opener-policy: unsafe-none
ℹ cross-origin-embedder-policy: (disabled for Google OAuth compatibility)
✓ x-powered-by: (removed - good!)
```

### Online Security Scanners

Test deployed application with:
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers](https://securityheaders.com/)
- [Helmet Check](https://helmetjs.github.io/)

---

## Compatibility Considerations

### Google OAuth

**Requirements:**
- `Cross-Origin-Opener-Policy: unsafe-none`
- `Cross-Origin-Embedder-Policy` disabled
- CSP `frame-src` allows `https://*.google.com`
- CSP `script-src` allows `https://*.google.com`

**Why:** Google OAuth popup uses `window.postMessage()` which requires relaxed COOP/COEP

### Vite Development

**Requirements:**
- CSP `script-src` includes `'unsafe-inline'` and `'unsafe-eval'`
- CSP `connect-src` includes WebSocket localhost
- HSTS disabled in development

**Why:** Vite's hot module reloading requires dynamic script execution and WebSocket

### React + Tailwind CSS

**Requirements:**
- CSP `style-src` includes `'unsafe-inline'`

**Why:** Runtime style injection requires inline styles

---

## Migration from Custom Implementation

### Changes from Previous Implementation

**Before (Custom implementation):**
```typescript
export function securityHeaders() {
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', ...);
    res.setHeader('Strict-Transport-Security', ...);
    // ... manual header setting
    next();
  };
}
```

**After (Helmet-based):**
```typescript
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: { directives: {...} },
    hsts: { maxAge: 31536000, ... },
    // ... declarative configuration
  });
}
```

### Benefits of Helmet

1. **Maintained by security experts:** Regular updates for new vulnerabilities
2. **Comprehensive coverage:** Implements 15+ security headers automatically
3. **Best practices by default:** Sensible defaults based on OWASP recommendations
4. **Easier configuration:** Declarative API instead of manual header manipulation
5. **TypeScript support:** Better type safety and IDE autocomplete
6. **Battle-tested:** Used by thousands of Node.js applications

---

## Security Best Practices

### Production Checklist

- [ ] Use `strictSecurityHeaders()` or custom strict configuration
- [ ] Enable HSTS with `includeSubDomains` and `preload`
- [ ] Remove `'unsafe-inline'` and `'unsafe-eval'` from CSP if possible
- [ ] Restrict CSP `img-src` from `https:` to specific domains
- [ ] Monitor CSP violations with `report-uri` or `report-to` directives
- [ ] Test headers with online scanners before deployment
- [ ] Set up automated header testing in CI/CD pipeline

### Development vs Production

| Header | Development | Production |
|--------|-------------|------------|
| CSP | Relaxed (unsafe-inline, unsafe-eval) | Strict (no unsafe) |
| HSTS | Disabled | Enabled (1-2 years) |
| X-Frame-Options | SAMEORIGIN | DENY |
| COEP | Disabled | Disabled (OAuth) |
| COOP | unsafe-none | unsafe-none (OAuth) |

---

## Troubleshooting

### Common Issues

#### "Refused to execute inline script because it violates CSP"

**Cause:** CSP `script-src` doesn't allow inline scripts
**Solution:**
- Add `'unsafe-inline'` to CSP (development only)
- Use external scripts or nonce-based CSP (production)

#### "Google OAuth popup blocked"

**Cause:** Strict COOP/COEP policy
**Solution:**
- Ensure COOP is `unsafe-none`
- Ensure COEP is disabled
- Check CSP `frame-src` allows Google domains

#### "Styles not loading"

**Cause:** CSP `style-src` doesn't allow inline styles
**Solution:**
- Add `'unsafe-inline'` to CSP `style-src`
- Use external stylesheets or nonce-based CSP

#### "WebSocket connection failed"

**Cause:** CSP `connect-src` doesn't allow WebSocket
**Solution:**
- Add `wss://localhost:*` and `ws://localhost:*` to CSP `connect-src` (development)

---

## References

- [Helmet Documentation](https://helmetjs.github.io/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [HSTS Preload List](https://hstspreload.org/)

---

## Version History

- **v1.0.0** (December 22, 2025) - Initial custom implementation
- **v1.1.0** (December 25, 2025) - Migrated to Helmet middleware

**Maintainer:** Development Team
**Review Cycle:** Quarterly
**Next Review:** March 25, 2026
