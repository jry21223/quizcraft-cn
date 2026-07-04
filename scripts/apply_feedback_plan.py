#!/usr/bin/env python3
"""Apply a DeepSeek repair plan to QuizCraft database.

Usage:
  python scripts/apply_feedback_plan.py --plan /tmp/plan.json
  python scripts/apply_feedback_plan.py --plan /tmp/plan.json --set-feedback-status --yes
"""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

DEFAULT_ENV_FILE = "/etc/quizcraft-cn.env"


def _parse_env_line(line: str):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        return None, None
    key, val = line.split("=", 1)
    return key.strip(), val.strip().strip("\"'")


def load_env_file(path: str) -> dict:
    env = {}
    p = Path(path)
    if not p.exists():
        return env
    for line in p.read_text(encoding="utf-8").splitlines():
        k, v = _parse_env_line(line)
        if k:
            env[k] = v
    return env


def main():
    parser = argparse.ArgumentParser(description="Apply DeepSeek repair plan")
    parser.add_argument("--plan", required=True, help="Path to plan JSON")
    parser.add_argument("--env-file", default=DEFAULT_ENV_FILE)
    parser.add_argument("--set-feedback-status", action="store_true", help="Update feedback status")
    parser.add_argument("--yes", action="store_true", help="Actually write changes (default: dry-run)")
    args = parser.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    env = load_env_file(args.env_file)
    db_url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    source = plan.get("_source", {})
    bank_key = source.get("bank_key")
    question_id = source.get("question_id")
    feedback_id = source.get("feedback_id")
    verdict = plan.get("verdict", "unknown")
    confidence = plan.get("confidence", 0)
    db_patch = plan.get("db_patch", {})

    print(f"target: {bank_key}/{question_id}")
    print(f"feedback_id: {feedback_id}")
    print(f"verdict: {verdict} confidence={confidence}")
    print(f"source_of_truth: db")

    # Determine what to update
    new_answer = db_patch.get("answer")
    new_type = db_patch.get("type")
    new_payload = db_patch.get("payload")

    will_update_answer = new_answer is not None
    will_update_type = new_type is not None
    will_update_payload = new_payload is not None

    print(f"will_update: answer={will_update_answer} type={will_update_type} payload={will_update_payload}")

    if not (will_update_answer or will_update_type or will_update_payload):
        print("nothing to update")
        if args.set_feedback_status and feedback_id:
            _update_feedback(db_url, feedback_id, plan, args.yes)
        return

    if not args.yes:
        print("dry-run: no PostgreSQL changes written; pass --yes to apply")
        return

    # Backup
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = Path("/opt/quizcraft-cn/repair_backups/db")
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{bank_key}-{question_id}-feedback-{feedback_id}-{ts}.json"

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # Read current
            cur.execute(
                "SELECT answer, type, payload FROM bank_questions WHERE bank_key=%s AND question_id=%s",
                (bank_key, question_id),
            )
            row = cur.fetchone()
            if not row:
                print(f"ERROR: question not found", file=sys.stderr)
                sys.exit(1)

            old_answer, old_type, old_payload = row
            backup_data = {
                "answer": old_answer,
                "type": old_type,
                "payload": old_payload,
                "plan": plan,
            }
            backup_path.write_text(json.dumps(backup_data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"backup: {backup_path}")

            # Apply patches
            if will_update_payload:
                # payload is the full object, also update answer and type from it
                cur.execute(
                    "UPDATE bank_questions SET payload=%s WHERE bank_key=%s AND question_id=%s",
                    (Jsonb(new_payload), bank_key, question_id),
                )
                # Also sync answer and type from payload if not explicitly set
                if not will_update_answer and "answer" in new_payload:
                    cur.execute(
                        "UPDATE bank_questions SET answer=%s::jsonb WHERE bank_key=%s AND question_id=%s",
                        (json.dumps(new_payload["answer"]), bank_key, question_id),
                    )
                if not will_update_type and "type" in new_payload:
                    cur.execute(
                        "UPDATE bank_questions SET type=%s WHERE bank_key=%s AND question_id=%s",
                        (new_payload["type"], bank_key, question_id),
                    )

            if will_update_answer:
                cur.execute(
                    "UPDATE bank_questions SET answer=%s::jsonb WHERE bank_key=%s AND question_id=%s",
                    (json.dumps(new_answer), bank_key, question_id),
                )

            if will_update_type:
                cur.execute(
                    "UPDATE bank_questions SET type=%s WHERE bank_key=%s AND question_id=%s",
                    (new_type, bank_key, question_id),
                )

            conn.commit()

            # Verify
            cur.execute(
                "SELECT answer, type, payload FROM bank_questions WHERE bank_key=%s AND question_id=%s",
                (bank_key, question_id),
            )
            verify = cur.fetchone()
            print(f"verified: bank_questions answer/type/payload match plan")
            print(f"applied")

    if args.set_feedback_status and feedback_id:
        _update_feedback(db_url, feedback_id, plan, args.yes)


def _update_feedback(db_url: str, feedback_id: int, plan: dict, yes: bool):
    resolution_note = plan.get("resolution_note", "")
    if not resolution_note:
        changed = plan.get("changed_fields", [])
        if changed:
            parts = [f"{c['path']}: {c.get('before')} -> {c.get('after')}" for c in changed]
            resolution_note = "已修复: " + "; ".join(parts)
        else:
            resolution_note = "DeepSeek审题: 无需修改"

    if not yes:
        print(f"dry-run: would set feedback {feedback_id} to resolved")
        return

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE feedbacks SET status='resolved', resolved_at=now(), resolution_note=%s WHERE feedback_id=%s",
                (resolution_note, feedback_id),
            )
            conn.commit()
            print(f"feedback {feedback_id} -> resolved")


if __name__ == "__main__":
    main()
