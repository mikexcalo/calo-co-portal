#!/usr/bin/env bash
# Ask the database what one person can see, under the real policies.
#
# PostgREST applies row-level security by switching to the `authenticated` role
# and setting `request.jwt.claims` to the token's payload. `auth.uid()` reads
# `sub` out of that. So the same thing can be done here, with a user id and no
# token: the policies that run are the policies that run in production, against
# the same rows.
#
# Like ask-db.sh this raises at the end, so the transaction rolls back, nothing
# is committed and the migration is never recorded as applied. It can only read.
#
#   scripts/as-user.sh <uuid> "select count(*) from customers"
set -euo pipefail
uid="${1:?usage: as-user.sh <user-uuid> \"select ...\"}"
q="${2:?usage: as-user.sh <user-uuid> \"select ...\"}"

d="supabase/migrations"
f="$d/99999999999998_asuser.sql"
cat > "$f" <<EOF
do \$\$
declare out text;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"$uid","role":"authenticated","aud":"authenticated"}', true);
  select coalesce(string_agg(t.line, E'\n'), '(no rows)') into out
    from (select row_to_json(x)::text as line from ($q) x limit 200) t;
  raise exception e'ANSWER\n%', out;
end \$\$;
EOF

cleanup() { rm -f "$f"; }
trap cleanup EXIT

out="$(npx supabase db push --linked 2>&1 || true)"
if printf '%s' "$out" | grep -q 'ANSWER'; then
  printf '%s' "$out" | python3 -c '
import sys, re
t = sys.stdin.read()
m = re.search(r"ANSWER\\n(.*?)(?: \(SQLSTATE|\\nAt statement)", t, re.S)
body = m.group(1) if m else t
body = body.replace("\\n", "\n").replace("\\\"", "\"")
print(body.strip())'
else
  echo "as-user: no answer came back. Raw output follows." >&2
  printf '%s\n' "$out" >&2
  exit 1
fi
