# Feedback triage workflow

This is the production workflow for QuizCraft feedback handling.

## Source of truth

- Treat `/opt/quizcraft-cn/tiku/*.json` as the durable question-bank source.
- PostgreSQL `bank_questions` is a runtime shadow table. Service startup syncs local JSON into PostgreSQL, so direct `bank_questions` edits are not durable unless the JSON source is changed too.
- Use `(bank_key, question_id)` as the repair key for a concrete question.

## Mandatory durable-fix gate

Every feedback repair must follow this order:

1. Fix `/opt/quizcraft-cn/tiku/<bank>.json`.
2. Restart `quizcraft-cn.service` so the JSON source is reloaded and synced into PostgreSQL.
3. Verify the live PostgreSQL `bank_questions` row and the public page/API behavior.
4. Mark the feedback `resolved`.

Do not mark feedback as resolved after only editing PostgreSQL. That creates an invalid feedback repair: it can appear fixed temporarily, then disappear after the next service restart because JSON overwrites the runtime shadow table.

## Processing steps

1. Export or inspect pending feedback from the MCP/API.
2. Locate the matching question in `/opt/quizcraft-cn/tiku/<bank>.json`.
3. If only answer/options/analysis change, edit that question in the JSON source and restart/sync.
4. If splitting, inserting, deleting, or reordering questions, update IDs deliberately:
   - `id` must stay unique and stable.
   - Numeric IDs such as `maogai_0032` must remain continuous with the question order.
   - Do not invent suffix IDs such as `maogai_0032_08` for inserted questions.
   - Build an old-to-new `question_id` migration map for every shifted question.
   - Apply the same map to related PostgreSQL tables such as `question_stats` and `feedbacks`.
5. Run `scripts/validate_question_bank_identity.py` on every touched bank.
6. Restart `quizcraft-cn.service`, then verify:
   - `/api/banks` or practice start can load the bank.
   - `bank_questions` count matches the JSON count.
   - The repaired question can be fetched/submitted by its final `question_id`.
7. Mark feedback `resolved` only after the durable JSON source and live DB shadow are both verified.

## Common failure mode

If a fix only updates PostgreSQL, it may look correct until the next service restart. On restart, the app reloads `/opt/quizcraft-cn/tiku/*.json` and overwrites `bank_questions`. Always patch JSON first, then verify the synchronized database state.
