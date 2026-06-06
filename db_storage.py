#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PostgreSQL persistence for QuizCraft runtime and bank shadow data."""

import json
import os
from contextlib import contextmanager
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:  # pragma: no cover - dependency can be absent in local fallback mode
    psycopg = None
    Jsonb = None


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


def is_enabled() -> bool:
    return bool(DATABASE_URL)


def is_available() -> bool:
    return is_enabled() and psycopg is not None


def require_available() -> None:
    if not is_enabled():
        raise RuntimeError("DATABASE_URL is not configured")
    if psycopg is None:
        raise RuntimeError("psycopg is not installed; install requirements.txt")


@contextmanager
def connect():
    require_available()
    with psycopg.connect(DATABASE_URL) as conn:
        yield conn


def init_schema() -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique
                ON users(display_name)
                WHERE display_name <> ''
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_stats (
                    user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                    correct INTEGER NOT NULL DEFAULT 0,
                    total INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS question_stats (
                    bank_key TEXT NOT NULL,
                    question_id TEXT NOT NULL,
                    total INTEGER NOT NULL DEFAULT 0,
                    correct INTEGER NOT NULL DEFAULT 0,
                    rate DOUBLE PRECISION NOT NULL DEFAULT 0,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (bank_key, question_id)
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS question_banks (
                    bank_key TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL,
                    source_file TEXT NOT NULL,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS bank_questions (
                    bank_key TEXT NOT NULL REFERENCES question_banks(bank_key) ON DELETE CASCADE,
                    question_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    chapter TEXT NOT NULL,
                    answer JSONB NOT NULL,
                    payload JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (bank_key, question_id)
                )
                """
            )


def _rate(correct: int, total: int) -> float:
    return round(correct / total * 100, 1) if total else 0.0


def _coerce_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def load_runtime_state() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, str], int]:
    users: Dict[str, Dict[str, Any]] = {}
    name_to_id: Dict[str, str] = {}
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.user_id, u.display_name, COALESCE(s.correct, 0), COALESCE(s.total, 0)
                FROM users u
                LEFT JOIN user_stats s ON s.user_id = u.user_id
                ORDER BY u.user_id
                """
            )
            for user_id, display_name, correct, total in cur.fetchall():
                correct_i = _coerce_int(correct)
                total_i = _coerce_int(total)
                users[str(user_id)] = {
                    "name": str(display_name or user_id),
                    "correct": correct_i,
                    "total": total_i,
                    "practice_history": [],
                }
                if display_name:
                    name_to_id[str(display_name)] = str(user_id)

    numeric_ids = [int(uid) for uid in users if str(uid).isdigit()]
    next_user_id = max(numeric_ids + [0]) + 1
    return users, name_to_id, next_user_id


def load_question_stats() -> Dict[str, Dict[str, Dict[str, float]]]:
    stats: Dict[str, Dict[str, Dict[str, float]]] = {}
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT bank_key, question_id, total, correct, rate
                FROM question_stats
                """
            )
            for bank_key, question_id, total, correct, rate in cur.fetchall():
                stats.setdefault(str(bank_key), {})[str(question_id)] = {
                    "total": _coerce_int(total),
                    "correct": _coerce_int(correct),
                    "rate": float(rate or 0),
                }
    return stats


def upsert_user(user_id: str, display_name: Optional[str] = None) -> Dict[str, Any]:
    name = (display_name or user_id).strip() or user_id
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (user_id, display_name)
                VALUES (%s, %s)
                ON CONFLICT (user_id) DO UPDATE
                SET display_name = EXCLUDED.display_name
                """,
                (user_id, name),
            )
            cur.execute(
                """
                INSERT INTO user_stats (user_id, correct, total)
                VALUES (%s, 0, 0)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id,),
            )
            cur.execute(
                """
                SELECT correct, total
                FROM user_stats
                WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
    correct = _coerce_int(row[0]) if row else 0
    total = _coerce_int(row[1]) if row else 0
    return {
        "name": name,
        "correct": correct,
        "total": total,
        "practice_history": [],
    }


def find_user_by_name(name: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.user_id, u.display_name, COALESCE(s.correct, 0), COALESCE(s.total, 0)
                FROM users u
                LEFT JOIN user_stats s ON s.user_id = u.user_id
                WHERE u.display_name = %s
                """,
                (name,),
            )
            row = cur.fetchone()
    if not row:
        return None
    user_id, display_name, correct, total = row
    return str(user_id), {
        "name": str(display_name or user_id),
        "correct": _coerce_int(correct),
        "total": _coerce_int(total),
        "practice_history": [],
    }


def increment_user_stats(user_id: str, display_name: Optional[str], is_correct: bool) -> Dict[str, Any]:
    name = (display_name or user_id).strip() or user_id
    correct_inc = 1 if is_correct else 0
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (user_id, display_name)
                VALUES (%s, %s)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id, name),
            )
            cur.execute(
                """
                INSERT INTO user_stats (user_id, correct, total)
                VALUES (%s, 0, 0)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id,),
            )
            cur.execute(
                """
                UPDATE user_stats
                SET correct = correct + %s,
                    total = total + 1,
                    updated_at = now()
                WHERE user_id = %s
                RETURNING correct, total
                """,
                (correct_inc, user_id),
            )
            correct, total = cur.fetchone()
    correct_i = _coerce_int(correct)
    total_i = _coerce_int(total)
    return {
        "name": name,
        "correct": correct_i,
        "total": total_i,
        "practice_history": [],
        "rate": _rate(correct_i, total_i),
    }


def save_user_snapshot(users: Dict[str, Dict[str, Any]]) -> None:
    with connect() as conn:
        with conn.cursor() as cur:
            for user_id, stats in users.items():
                if not isinstance(stats, dict):
                    continue
                display_name = str(stats.get("name") or user_id)
                correct = _coerce_int(stats.get("correct"))
                total = _coerce_int(stats.get("total"))
                cur.execute(
                    """
                    INSERT INTO users (user_id, display_name)
                    VALUES (%s, %s)
                    ON CONFLICT (user_id) DO UPDATE
                    SET display_name = EXCLUDED.display_name
                    """,
                    (str(user_id), display_name),
                )
                cur.execute(
                    """
                    INSERT INTO user_stats (user_id, correct, total)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE
                    SET correct = EXCLUDED.correct,
                        total = EXCLUDED.total,
                        updated_at = now()
                    """,
                    (str(user_id), correct, total),
                )


def increment_question_stats(bank_key: str, question_id: str, is_correct: bool) -> Dict[str, float]:
    correct_inc = 1 if is_correct else 0
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO question_stats (bank_key, question_id, total, correct, rate)
                VALUES (%s, %s, 0, 0, 0)
                ON CONFLICT (bank_key, question_id) DO NOTHING
                """,
                (bank_key, question_id),
            )
            cur.execute(
                """
                SELECT total, correct
                FROM question_stats
                WHERE bank_key = %s AND question_id = %s
                FOR UPDATE
                """,
                (bank_key, question_id),
            )
            total, correct = cur.fetchone()
            next_total = _coerce_int(total) + 1
            next_correct = _coerce_int(correct) + correct_inc
            next_rate = _rate(next_correct, next_total)
            cur.execute(
                """
                UPDATE question_stats
                SET total = %s,
                    correct = %s,
                    rate = %s,
                    updated_at = now()
                WHERE bank_key = %s AND question_id = %s
                """,
                (next_total, next_correct, next_rate, bank_key, question_id),
            )
    return {"total": next_total, "correct": next_correct, "rate": next_rate}


def upsert_question_bank(
    bank_key: str,
    name: str,
    color: str,
    source_file: str,
    metadata: Dict[str, Any],
    questions: Iterable[Dict[str, Any]],
) -> None:
    question_list = list(questions)
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO question_banks (bank_key, name, color, source_file, metadata)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (bank_key) DO UPDATE
                SET name = EXCLUDED.name,
                    color = EXCLUDED.color,
                    source_file = EXCLUDED.source_file,
                    metadata = EXCLUDED.metadata,
                    updated_at = now()
                """,
                (bank_key, name, color, source_file, Jsonb(metadata or {})),
            )
            cur.execute("DELETE FROM bank_questions WHERE bank_key = %s", (bank_key,))
            for question in question_list:
                qid = str(question.get("id") or "")
                if not qid:
                    continue
                cur.execute(
                    """
                    INSERT INTO bank_questions (
                        bank_key, question_id, type, chapter, answer, payload
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        bank_key,
                        qid,
                        str(question.get("type") or ""),
                        str(question.get("chapter") or ""),
                        Jsonb(question.get("answer")),
                        Jsonb(question),
                    ),
                )


def get_ranking(limit: int = 50) -> List[Dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.user_id, u.display_name, s.correct, s.total
                FROM user_stats s
                JOIN users u ON u.user_id = s.user_id
                WHERE s.total > 0
                ORDER BY s.correct DESC,
                         CASE WHEN s.total > 0 THEN s.correct::float / s.total ELSE 0 END DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
    return [
        {
            "user_id": str(user_id),
            "name": str(display_name or user_id),
            "correct": _coerce_int(correct),
            "total": _coerce_int(total),
            "accuracy": _rate(_coerce_int(correct), _coerce_int(total)),
        }
        for user_id, display_name, correct, total in rows
    ]


def import_rankings_payload(payload: Dict[str, Any]) -> Dict[str, int]:
    users = payload.get("users", {}) if isinstance(payload, dict) else {}
    name_to_id = payload.get("name_to_id", {}) if isinstance(payload, dict) else {}
    imported = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for user_id, stats in users.items():
                if not isinstance(stats, dict):
                    continue
                display_name = str(stats.get("name") or user_id)
                cur.execute(
                    """
                    INSERT INTO users (user_id, display_name)
                    VALUES (%s, %s)
                    ON CONFLICT (user_id) DO UPDATE
                    SET display_name = EXCLUDED.display_name
                    """,
                    (str(user_id), display_name),
                )
                correct = _coerce_int(stats.get("correct"))
                total = _coerce_int(stats.get("total"))
                cur.execute(
                    """
                    INSERT INTO user_stats (user_id, correct, total)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE
                    SET correct = EXCLUDED.correct,
                        total = EXCLUDED.total,
                        updated_at = now()
                    """,
                    (str(user_id), correct, total),
                )
                imported += 1

            for display_name, user_id in name_to_id.items():
                if not display_name or not user_id:
                    continue
                cur.execute(
                    """
                    UPDATE users
                    SET display_name = %s
                    WHERE user_id = %s
                    """,
                    (str(display_name), str(user_id)),
                )
    return {"users": imported, "name_to_id": len(name_to_id)}


def import_question_stats_payload(payload: Dict[str, Any]) -> Dict[str, int]:
    imported = 0
    with connect() as conn:
        with conn.cursor() as cur:
            for bank_key, stats in payload.items():
                if not isinstance(stats, dict):
                    continue
                for question_id, stat in stats.items():
                    if not isinstance(stat, dict):
                        continue
                    total = _coerce_int(stat.get("total"))
                    correct = _coerce_int(stat.get("correct"))
                    rate = float(stat.get("rate") or _rate(correct, total))
                    cur.execute(
                        """
                        INSERT INTO question_stats (bank_key, question_id, total, correct, rate)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (bank_key, question_id) DO UPDATE
                        SET total = EXCLUDED.total,
                            correct = EXCLUDED.correct,
                            rate = EXCLUDED.rate,
                            updated_at = now()
                        """,
                        (str(bank_key), str(question_id), total, correct, rate),
                    )
                    imported += 1
    return {"question_stats": imported}


def bank_consistency_snapshot() -> Dict[str, Dict[str, Any]]:
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT qb.bank_key,
                       qb.name,
                       COUNT(bq.question_id) AS total
                FROM question_banks qb
                LEFT JOIN bank_questions bq ON bq.bank_key = qb.bank_key
                GROUP BY qb.bank_key, qb.name
                """
            )
            bank_rows = cur.fetchall()
            cur.execute(
                """
                SELECT bank_key, question_id, answer
                FROM bank_questions
                ORDER BY bank_key, question_id
                """
            )
            question_rows = cur.fetchall()

    snapshot: Dict[str, Dict[str, Any]] = {
        str(bank_key): {"name": str(name), "total": _coerce_int(total), "questions": {}}
        for bank_key, name, total in bank_rows
    }
    for bank_key, question_id, answer in question_rows:
        parsed_answer = answer
        if isinstance(answer, str):
            try:
                parsed_answer = json.loads(answer)
            except json.JSONDecodeError:
                parsed_answer = answer
        snapshot.setdefault(str(bank_key), {"name": str(bank_key), "total": 0, "questions": {}})
        snapshot[str(bank_key)]["questions"][str(question_id)] = parsed_answer
    return snapshot
