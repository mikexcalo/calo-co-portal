#!/usr/bin/env bash
# Read from production, using the only connection we have.
#
# The Supabase CLI can push migrations but has no "run this query and show me
# the answer" command, and the service-role key is stored as a Vercel Secret,
# which Vercel will not hand back. So every question about live data was being
# answered by reading code and hoping.
#
# This asks the question inside a migration that deliberately fails: the answer
# comes back as the error message, and because the statement raises, nothing is
# committed and nothing is recorded as applied. It is a read, and it can only
# ever be a read.
#
#   scripts/ask-db.sh "select name, stage from customers order by name"
set -euo pipefail
q="${1:?usage: ask-db.sh \"select ...\"}"
f="supabase/migrations/99999999999999_ask.sql"
cat > "$f" <<EOF
do \$\$
declare out text;
begin
  select coalesce(string_agg(t.line, E'\n'), '(no rows)') into out
    from (select row_to_json(x)::text as line from ($q) x limit 200) t;
  raise exception e'ANSWER\n%', out;
end \$\$;
EOF
npx --yes supabase@latest db push --linked </dev/null 2>&1 \
  | sed -n 's/.*ANSWER\\n\(.*\)/\1/p' \
  | sed 's/ (SQLSTATE P0001).*$//' \
  | perl -pe "s/\\\\n/\n/g; s/\\\\\"/\"/g" || true
rm -f "$f"
