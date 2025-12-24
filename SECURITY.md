# VaultLogic Security Guide

## Critical Security Notice

**IMPORTANT**: All production secrets MUST be rotated immediately.

---

## Secret Rotation Procedure

### 1. Generate New Secrets

```bash
# Generate SESSION_SECRET (32+ bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate JWT_SECRET (32+ bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate VL_MASTER_KEY (32-byte base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Update Production Environment

**Railway/Hosting Platform:**
1. Navigate to Environment Variables
2. Update each secret:
   - `SESSION_SECRET`
   - `JWT_SECRET`
   - `VL_MASTER_KEY`
   - `GOOGLE_CLIENT_ID` (if compromised)
   - `DATABASE_URL` password (if compromised)
3. Redeploy application

### 3. Impact of Rotation

**SESSION_SECRET:**
- All users logged out
- Must re-authenticate

**JWT_SECRET:**
- All JWT tokens invalidated
- API clients must re-authenticate

**VL_MASTER_KEY:**
- CRITICAL: All encrypted secrets become unreadable
- Requires database migration to re-encrypt
- DO NOT rotate without migration script

### 4. Verify After Rotation

- [ ] Application starts without errors
- [ ] Users can log in
- [ ] Integrations work
- [ ] No secret-related errors in logs

---

## Cleaning Git History

If secrets were committed to git:

```bash
# Using BFG Repo-Cleaner (recommended)
git clone --mirror https://github.com/yourusername/VaultLogic.git
java -jar bfg.jar --delete-files .env VaultLogic.git
cd VaultLogic.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

**CRITICAL**: After cleaning git history, rotate ALL exposed secrets.

---

## Security Best Practices

1. **Never commit secrets** - Use .env files (add to .gitignore)
2. **Rotate secrets quarterly** - Or immediately if compromised
3. **Use strong secrets** - Minimum 32 bytes of random data
4. **Monitor access logs** - Check audit logs regularly
5. **Enable MFA** - For all production access

---

**Last Updated:** December 24, 2025
