# Task 0 report — September copy approval

Recorded the sender-approved recipient-facing labels exactly as specified:

- `envelopeCta`: `Mở phong bì`
- `letterCta`: `Mở lá thư`
- `imageError`: `Ảnh món quà chưa tải được`
- `approvedBySender: true`

No proposed default changed, so `apps/september/src/content/copy.mjs` was not modified.
The dated evidence record contains no query, recipient, camera, or gesture data.

## Validation

```sh
node -e 'const fs=require("fs"); const p="docs/superpowers/evidence/2026-09-01-september-copy-approval.md"; const s=fs.readFileSync(p,"utf8"); for (const v of ["Mở phong bì","Mở lá thư","Ảnh món quà chưa tải được","approvedBySender: true"]) if (!s.includes(v)) process.exit(1);'
```

Result: exit 0.

## Concerns

None for Task 0. Source implementation remains gated for subsequent tasks.
