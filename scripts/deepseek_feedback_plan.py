#!/usr/bin/env python3
"""DeepSeek feedback plan generator for QuizCraft.

Usage:
  python scripts/deepseek_feedback_plan.py --feedback-id 178 --output /tmp/plan.json
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

import httpx
import psycopg

DEFAULT_MODEL = "deepseek-chat"
DEFAULT_BASE_URL = "https://api.deepseek.com"
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


def get_database_url(env: dict) -> str:
    url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)
    return url


def get_api_key(env: dict) -> str:
    key = env.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API_KEY", "")
    if not key:
        print("ERROR: DEEPSEEK_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    return key


def fetch_feedback(conn, feedback_id: int) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT feedback_id, question_index, question_bank, question_id, suggestion, status "
            "FROM feedbacks WHERE feedback_id=%s",
            (feedback_id,),
        )
        row = cur.fetchone()
        if not row:
            print(f"ERROR: feedback {feedback_id} not found", file=sys.stderr)
            sys.exit(1)
        return {
            "feedback_id": row[0],
            "question_index": row[1],
            "question_bank": row[2],
            "question_id": row[3],
            "suggestion": row[4],
            "status": row[5],
        }


def fetch_question(conn, bank_key: str, question_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT answer, type, payload FROM bank_questions WHERE bank_key=%s AND question_id=%s",
            (bank_key, question_id),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {"answer": row[0], "type": row[1], "payload": row[2]}


def fetch_bank_info(conn, bank_key: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM bank_questions WHERE bank_key=%s", (bank_key,)
        )
        return {"bank_key": bank_key, "count": cur.fetchone()[0]}


def _numeric_order_expr(options: list) -> str:
    """Build a human-readable option listing."""
    parts = []
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for i, opt in enumerate(options):
        label = letters[i] if i < len(letters) else str(i)
        parts.append(f"{label}. {opt}")
    return "\n".join(parts)


def build_prompt(feedback: dict, question: dict) -> str:
    payload = question["payload"]
    options = payload.get("options", [])
    content = payload.get("content", "")
    analysis = payload.get("analysis", "")
    answer = question["answer"]
    qtype = question["type"]

    opts_text = _numeric_order_expr(options) if options else "(判断题/无选项)"

    return f"""你是中文高校考试题库质检员。请根据用户反馈判断题目是否需要修复。

## 题目信息
- 题库: {feedback['question_bank']}
- 题号: {feedback['question_id']}
- 题型: {qtype}
- 题干: {content}
- 选项:
{opts_text}
- 当前答案: {answer}
- 解析: {analysis}

## 用户反馈
{suggestion if (suggestion := feedback['suggestion']) else '(无)'}

## 要求
分析反馈是否有道理。如果需要修复，返回包含 patch 的 JSON。如果不需要，返回 fix_needed=false。

必须返回以下 JSON 格式，不要其他文字：
{{
  "verdict": "fix_needed" 或 "no_change" 或 "needs_human_review",
  "confidence": 0.0-1.0,
  "reasoning_summary": "一句话说明原因",
  "changed_fields": [{{"path": "...", "before": ..., "after": ..., "why": "..."}}],
  "db_patch": {{
    "answer": null 或新答案,
    "type": null 或 "single"/"multi"/"judge",
    "payload": null 或完整payload对象
  }}
}}"""


def extract_json_object(text: str) -> dict:
    """Extract JSON from LLM response (may contain markdown fences)."""
    # Try direct parse
    text = text.strip()
    if text.startswith("{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    # Try extracting from ```json ... ```
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            pass
    # Try finding first { ... last }
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    print(f"ERROR: could not extract JSON from response", file=sys.stderr)
    sys.exit(1)


def call_deepseek(prompt: str, api_key: str, base_url: str, model: str) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 2000,
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def main():
    parser = argparse.ArgumentParser(description="Generate DeepSeek repair plan for a QuizCraft feedback")
    parser.add_argument("--feedback-id", type=int, required=True)
    parser.add_argument("--output", type=str, required=True)
    parser.add_argument("--env-file", type=str, default=DEFAULT_ENV_FILE)
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL)
    parser.add_argument("--base-url", type=str, default=DEFAULT_BASE_URL)
    args = parser.parse_args()

    env = load_env_file(args.env_file)
    db_url = get_database_url(env)
    api_key = get_api_key(env)

    with psycopg.connect(db_url) as conn:
        fb = fetch_feedback(conn, args.feedback_id)
        q = fetch_question(conn, fb["question_bank"], fb["question_id"])
        if not q:
            print(f"ERROR: question {fb['question_bank']}/{fb['question_id']} not found", file=sys.stderr)
            sys.exit(1)
        bank_info = fetch_bank_info(conn, fb["question_bank"])

    prompt = build_prompt(fb, q)
    raw = call_deepseek(prompt, api_key, args.base_url, args.model)
    plan = extract_json_object(raw)

    # Enrich plan with metadata
    plan["_model"] = args.model
    plan["_source"] = {
        "feedback_id": fb["feedback_id"],
        "bank_key": fb["question_bank"],
        "question_id": fb["question_id"],
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(plan, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
