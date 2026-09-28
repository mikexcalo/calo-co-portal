#!/usr/bin/env bash
# Run a block of SQL as a given user, and roll it back.
#
# ask-db.sh answers questions; this one answers "what happens if THEY try
# it". Same trick - a migration that raises at the end, so nothing commits -
# but the body is arbitrary SQL with auth.uid() set to a real person, which
# is the only way to test a policy or a guard without their password.
#
#   scripts/try-as.sh <user-uuid> "update orgs set modules = ... where id = ..."
set -euo pipefail
uid="${1:?usage: try-as.sh <user-uuid> \"sql\"}"
sql="${2:?usage: try-as.sh <user-uuid> \"sql\"}"

f="supabase/migrations/99999999999998_tryas.sql"
cat > "$f" <<EOF
do \$\$
declare msg text;
begin
  perform set_config('request.jwt.claims', '{"sub":"$uid","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  begin
    $sql
    msg := 'ALLOWED';
  exception when others then
    msg := 'REFUSED: ' || SQLERRM;
  end;
  perform set_config('role', 'postgres', true);
  raise exception e'ANSWER\n%', msg;
end \$\$;
EOF

raw="$(npx --yes supabase@latest db push --linked </dev/null 2>&1 || true)"
rm -f "$f"
printf '%s' "$raw" | sed -n 's/.*ANSWER\\n\(.*\)/\1/p' | sed 's/ (SQLSTATE P0001).*$//' | perl -pe "s/\\\\n/\n/g; s/\\\\\"/\"/g"
