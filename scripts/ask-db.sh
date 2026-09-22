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

# ---------------------------------------------------------------------------
# Why the migrations get moved aside.
#
# db push refuses with LegacyDbPushMissingRemoteError, because the migrations
# are named with 8-digit dates and the CLI therefore believes none of the 98
# are applied. It suggests --include-all, which would try to re-run all of
# them against production. So the ask file is pushed on its own: everything
# else is moved out for the length of one command and put straight back.
#
# The trap restores on any exit, including a kill. The files are in git, so
# the worst case is a git checkout.
#
# This used to end in `|| true` with the error piped into a sed that matched
# nothing, so a broken connection and an empty table looked identical: both
# printed nothing at all. It is louder now.
# ---------------------------------------------------------------------------
d="supabase/migrations"
hold="$(mktemp -d)"
restore() { [ -d "$hold" ] && mv "$hold"/* "$d"/ 2>/dev/null || true; rm -rf "$hold"; }
trap restore EXIT INT TERM

mv "$d"/*.sql "$hold"/ 2>/dev/null || true

f="$d/99999999999999_ask.sql"
cat > "$f" <<EOF
do \$\$
declare out text;
begin
  select coalesce(string_agg(t.line, E'\n'), '(no rows)') into out
    from (select row_to_json(x)::text as line from ($q) x limit 200) t;
  raise exception e'ANSWER\n%', out;
end \$\$;
EOF

raw="$(npx --yes supabase@latest db push --linked </dev/null 2>&1 || true)"
rm -f "$f"

answer="$(printf '%s' "$raw" \
  | sed -n 's/.*ANSWER\\n\(.*\)/\1/p' \
  | sed 's/ (SQLSTATE P0001).*$//' \
  | perl -pe "s/\\\\n/\n/g; s/\\\\\"/\"/g")"

if [ -z "$answer" ]; then
  echo "ask-db: no answer came back. Raw output follows." >&2
  printf '%s\n' "$raw" >&2
  exit 1
fi
printf '%s\n' "$answer"
