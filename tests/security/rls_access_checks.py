"""Automated checks: sonk_status and sonk_accounts must never be publicly readable.

Runs two layers:
  1. Live REST probes with the anonymous (publishable) key — must return no rows.
  2. Policy-shape assertions via psql — every SELECT policy on those tables must
     be limited to the `authenticated` role and scoped to the owner or staff.

Usage: python3 tests/security/rls_access_checks.py
"""

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

TABLES = ["sonk_status", "sonk_accounts"]
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
ANON_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get(
    "VITE_SUPABASE_PUBLISHABLE_KEY"
)

failures: list[str] = []


def check_anonymous_reads() -> None:
    if not SUPABASE_URL or not ANON_KEY:
        print("! skipped anonymous REST probes (no URL/publishable key in env)")
        return
    for table in TABLES:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=5"
        req = urllib.request.Request(url, headers={"apikey": ANON_KEY})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                rows = json.loads(resp.read() or b"[]")
        except urllib.error.HTTPError as err:
            if err.code in (401, 403, 404):
                print(f"ok  anon read of {table} rejected ({err.code})")
                continue
            failures.append(f"{table}: unexpected HTTP {err.code} for anon read")
            continue
        if rows:
            failures.append(f"{table}: anon read returned {len(rows)} row(s)")
        else:
            print(f"ok  anon read of {table} returned no rows")


def check_policy_shapes() -> None:
    query = (
        "select tablename, policyname, roles::text, coalesce(qual,'') "
        "from pg_policies where schemaname='public' and cmd='SELECT' "
        f"and tablename in ({','.join(chr(39) + t + chr(39) for t in TABLES)})"
    )
    proc = subprocess.run(
        ["psql", "-At", "-F", "|", "-c", query], capture_output=True, text=True
    )
    if proc.returncode != 0:
        failures.append(f"psql failed: {proc.stderr.strip()[:200]}")
        return
    lines = [l for l in proc.stdout.strip().splitlines() if l]
    seen = set()
    for line in lines:
        table, policy, roles, qual = line.split("|", 3)
        seen.add(table)
        if "anon" in roles or "public" in roles:
            failures.append(f"{table}.{policy}: SELECT granted to {roles}")
        normalized = re.sub(r"\s+", " ", qual)
        if "auth.uid() = user_id" not in normalized or "sonk_rank(auth.uid())" not in normalized:
            failures.append(
                f"{table}.{policy}: SELECT rule is not owner-or-staff scoped -> {normalized}"
            )
        if normalized.strip() in ("true", "(true)"):
            failures.append(f"{table}.{policy}: SELECT rule is USING (true)")
        if not failures:
            print(f"ok  {table}.{policy} limited to owner or staff ({roles})")
    for table in TABLES:
        if table not in seen:
            failures.append(f"{table}: no SELECT policy found (unexpected)")


check_anonymous_reads()
check_policy_shapes()

if failures:
    print("\nFAILED:")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print("\nAll sonk_status / sonk_accounts access checks passed.")
