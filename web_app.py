#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import json
import random
import os
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
from collections import defaultdict

from flask import Flask, jsonify, request, render_template, session


# ============== Question Model & Utilities ==============

@dataclass
class Question:
    id: str
    chapter_name: str
    item_type: str
    stem: str
    raw_item: str
    answer: str
    analysis: str = ""  # 新增：题目解析


def normalize_bool_answer(ans: str) -> Optional[bool]:
    ans = ans.strip().lower()
    if ans in ("对", "正确", "√", "true", "t", "yes", "y"):
        return True
    if ans in ("错", "错误", "×", "false", "f", "no", "n"):
        return False
    return None


def load_contents(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_question_list(contents: Dict) -> List[Question]:
    questions: List[Question] = []
    for chapter_name, chapter_data in contents.items():
        for item_type, items in chapter_data.items():
            for idx, item in enumerate(items):
                analysis = ""  # 默认无解析
                
                if "答案：" in item:
                    split_idx = item.find("答案：")
                    stem = item[:split_idx]
                    rest = item[split_idx + 3:].strip()
                    
                    # 检查是否有解析
                    if "解析：" in rest:
                        analysis_idx = rest.find("解析：")
                        answer = rest[:analysis_idx].strip()
                        analysis = rest[analysis_idx + 3:].strip()
                    else:
                        answer = rest
                else:
                    stem = item
                    answer = ""
                    
                qid = f"{chapter_name}|{item_type}|{idx}"
                questions.append(
                    Question(
                        id=qid,
                        chapter_name=chapter_name,
                        item_type=item_type,
                        stem=stem,
                        raw_item=item,
                        answer=answer,
                        analysis=analysis,
                    )
                )
    return questions


def judge_answer(question: Question, user_input: str) -> Tuple[bool, str]:
    correct_answer = question.answer.strip()
    user_input = user_input.strip()
    ans_bool = normalize_bool_answer(correct_answer)

    if ans_bool is not None and user_input.lower() in ("y", "n"):
        is_correct = (user_input.lower() == "y" and ans_bool) or (
            user_input.lower() == "n" and not ans_bool
        )
    else:
        ua = user_input.replace(" ", "").upper()
        ca = correct_answer.replace(" ", "").upper()
        if ua and ca and all(ch in "ABCD" for ch in ua + ca):
            is_correct = set(ua) == set(ca)
        else:
            is_correct = user_input.lower() == correct_answer.lower()

    return is_correct, correct_answer


# ============== Flask App ==============

app = Flask(__name__, template_folder=".")
app.secret_key = "sawd-history-quiz-secret"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUBJECTS = {
    "history": {
        "name": "近代史",
        "file": os.path.join(BASE_DIR, "chapters.json"),
        "color": "#1976d2"
    },
    "sixiu": {
        "name": "思想道德与法治",
        "file": os.path.join(BASE_DIR, "sixiu.json"),
        "color": "#2e7d32"
    },
    "xigai": {
        "name": "习概",
        "file": os.path.join(BASE_DIR, "xigai.json"),
        "color": "#c62828"
    }
}

USER_STATS: Dict[str, Dict] = defaultdict(lambda: {"name": "", "correct": 0, "total": 0})
NAME_TO_ID: Dict[str, str] = {}
NEXT_USER_ID = 1
RANK_FILE_PATH = "rankings.json"


# ============== Helper Functions ==============

def get_subject_key_from_request():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        return data.get("subject") or request.args.get("subject") or "history"
    else:
        return request.args.get("subject") or "history"


def get_questions_and_contents(subject_key: str):
    if subject_key not in SUBJECTS:
        subject_key = "history"
    file_path = SUBJECTS[subject_key]["file"]
    if os.path.exists(file_path):
        contents = load_contents(file_path)
        questions = build_question_list(contents)
        return questions, contents
    else:
        return [], {}


def load_rankings_from_file():
    global NEXT_USER_ID, NAME_TO_ID, USER_STATS
    if not os.path.exists(RANK_FILE_PATH):
        return
    try:
        with open(RANK_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            users = data.get("users", {})
            name_to_id = data.get("name_to_id", {})
            USER_STATS.clear()
            for uid, stats in users.items():
                name = stats.get("name", "") or uid
                correct = int(stats.get("correct", 0) or 0)
                total = int(stats.get("total", 0) or 0)
                USER_STATS[uid] = {"name": name, "correct": correct, "total": total}
            NAME_TO_ID.clear()
            for k, v in name_to_id.items():
                NAME_TO_ID[k] = v
            if users:
                NEXT_USER_ID = max([int(uid) for uid in users.keys() if uid.isdigit()] + [1]) + 1
            else:
                NEXT_USER_ID = 1
    except Exception:
        pass


def save_rankings_to_file():
    try:
        data = {
            "users": dict(USER_STATS),
            "name_to_id": NAME_TO_ID,
        }
        with open(RANK_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


# ============== Routes ==============

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/subjects", methods=["GET"])
def get_subjects():
    subject_key = get_subject_key_from_request()
    return jsonify({
        "subjects": [
            {"key": k, "name": v["name"], "color": v["color"]}
            for k, v in SUBJECTS.items()
        ],
        "current": subject_key
    })


@app.route("/api/init", methods=["POST"])
def api_init():
    data = request.get_json(silent=True) or {}
    subject_key = data.get("subject") or "history"
    questions, contents = get_questions_and_contents(subject_key)
    return jsonify({
        "total": len(questions),
        "chapters": list(contents.keys()),
        "subject": subject_key,
        "subject_name": SUBJECTS.get(subject_key, {}).get("name", "")
    })


@app.route("/api/next", methods=["POST"])
def api_next():
    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "random")
    done_ids = set(data.get("done_ids", []))
    subject_key = data.get("subject") or "history"
    questions, contents = get_questions_and_contents(subject_key)
    remaining = [q for q in questions if q.id not in done_ids]
    if not remaining:
        return jsonify({"finished": True}), 200
    q = random.choice(remaining) if mode != "sequential" else sorted(remaining, key=lambda x: x.id)[0]
    answer_type = "text"
    ans_up = q.answer.upper()
    if all(ch in "ABCD" for ch in ans_up) and len(ans_up) >= 1:
        if len(ans_up) == 1:
            answer_type = "single"
        else:
            answer_type = "multi"
    if normalize_bool_answer(q.answer) is not None:
        answer_type = "judge"
    return jsonify({
        "finished": False,
        "id": q.id,
        "chapter_name": q.chapter_name,
        "item_type": q.item_type,
        "stem": q.stem,
        "answer_type": answer_type,
    })


@app.route("/api/answer", methods=["POST"])
def api_answer():
    data = request.get_json(silent=True) or {}
    qid = data.get("id")
    user_input = data.get("user_input", "")
    subject_key = data.get("subject") or "history"
    questions, contents = get_questions_and_contents(subject_key)
    if not qid:
        return jsonify({"error": "Missing question id"}), 400
    q = next((x for x in questions if x.id == qid), None)
    if q is None:
        return jsonify({"error": "Question not found"}), 404
    is_correct, correct_answer = judge_answer(q, user_input)
    user_id = session.get("user_id")
    if user_id:
        stats = USER_STATS[user_id]
        stats["total"] = stats.get("total", 0) + 1
        if is_correct:
            stats["correct"] = stats.get("correct", 0) + 1
        save_rankings_to_file()
    return jsonify({
        "correct": is_correct,
        "correct_answer": correct_answer,
        "analysis": q.analysis,  # 新增：返回题目解析
        "user_stats": {
            "user_id": user_id,
            "name": USER_STATS[user_id]["name"] if user_id else "",
            "correct": USER_STATS[user_id]["correct"] if user_id else 0,
            "total": USER_STATS[user_id]["total"] if user_id else 0,
        } if user_id else None,
    })


@app.route("/api/user", methods=["POST"])
def api_user():
    global NEXT_USER_ID, NAME_TO_ID
    data = request.get_json(silent=True) or {}
    raw_name = data.get("name", "").strip()
    name = raw_name or None

    if name and name in NAME_TO_ID:
        user_id = NAME_TO_ID[name]
        session["user_id"] = user_id
        USER_STATS[user_id]["name"] = name
        save_rankings_to_file()
        stats = USER_STATS[user_id]
        return jsonify({
            "user_id": user_id,
            "name": stats.get("name") or user_id,
            "correct": stats.get("correct", 0),
            "total": stats.get("total", 0),
        })

    user_id = str(NEXT_USER_ID)
    NEXT_USER_ID += 1
    session["user_id"] = user_id

    if name:
        NAME_TO_ID[name] = user_id
        USER_STATS[user_id]["name"] = name
    else:
        USER_STATS[user_id]["name"] = user_id

    save_rankings_to_file()
    stats = USER_STATS[user_id]
    return jsonify({
        "user_id": user_id,
        "name": stats.get("name") or user_id,
        "correct": stats.get("correct", 0),
        "total": stats.get("total", 0),
    })


@app.route("/api/rank", methods=["GET"])
def api_rank():
    ranking = []
    for user_id, stats in USER_STATS.items():
        correct = stats.get("correct", 0)
        total = stats.get("total", 0)
        name = stats.get("name") or user_id
        accuracy = (correct / total * 100) if total > 0 else 0.0
        ranking.append({
            "user_id": user_id,
            "name": name,
            "correct": correct,
            "total": total,
            "accuracy": round(accuracy, 1),
        })
    ranking.sort(key=lambda x: (-x["correct"], -x["total"]))
    return jsonify({"ranking": ranking})


# ============== Initialization ==============

load_rankings_from_file()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10086, debug=True)
