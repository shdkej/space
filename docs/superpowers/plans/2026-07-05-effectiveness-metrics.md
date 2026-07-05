# 4레이어 효과 지표 (지연 게이트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 4지표(즉시 게이트)의 대칭으로 "그 판단이 살아남았나"를 매일 판정하는 지연 게이트 4개(E1 조정 반영율, E2 실패 재발율, E3 채택안 생존율, E4 산출물 참조율)를 원장→판정→수집→대시보드까지 연결한다.

**Architecture:** 판정 결과는 `effectiveness.jsonl`에 하루 1줄 append(단일 출처). E2·E4는 결정적 스크립트(`effectiveness.py`)가 판정하고, E1·E3은 밤 점검 크론(23:20 KST)이 LLM으로 판정해 한 줄로 합쳐 쓴다. system-dashboard collector가 원장에서 rolling 비율을 파생해 CMS System 탭에 표시한다.

**Tech Stack:** Python 3 (stdlib + PyYAML, unittest), Next.js/React (CMS), git CLI, JSONL 원장.

**Spec:** `/home/ubuntu/.openclaw/workspace/system/docs/EFFECTIVENESS_METRICS_2026-07-05.md`

## Global Constraints

- 4개 레포에 걸친 작업: `~/.openclaw/workspace` (정본·원장), `~/workspace/system-dashboard` (판정 스크립트·collector), `~/workspace/space` (CMS UI), `~/workspace/prompt-archive` (workflow-master 기록 규칙).
- 비율은 원장에 저장하지 않는다 — collector/UI가 분자·분모에서 파생한다 (단일출처).
- 임계값 없음: 초기 4~6주는 관측만. 상태 점(dot)은 "원장이 돌고 있는가"만 반영한다.
- 분모 0은 통과가 아니라 "미기록"으로 표시한다 (Goodhart 방어).
- 원장은 append-only. 같은 날짜 줄이 이미 있으면 다시 쓰지 않는다.
- effectiveness.jsonl 하루 1줄 스키마 (정본에 명시, 모든 코드가 이 스키마를 따른다):
  `{"date":"YYYY-MM-DD","e1":{"adjustments":n,"reflected":m},"e2":{"logged":n,"recurred":m},"e3":{"judged":n,"survived":m},"e4":{"matured":n,"referenced":m},"note":"실패/특이 있을 때만 1줄"}`
- decisions.jsonl 두 종류 줄 (append-only):
  - 결정: `{"date":"YYYY-MM-DD","id":"슬러그","decision":"채택안 한 줄","project":"프로젝트","source":"결론이 기록된 파일 경로"}`
  - 판정: `{"judged_at":"YYYY-MM-DD","id":"슬러그","verdict":"survived|overturned","reason":"한 줄"}`
  - 미회수 잔액 = verdict 줄이 없는 결정 id 전체.
- 날짜는 전부 KST(Asia/Seoul) 기준 YYYY-MM-DD.

---

### Task 1: 정본·원장 규칙 (openclaw workspace 레포)

**Files:**
- Modify: `/home/ubuntu/.openclaw/workspace/system/docs/LIFE_SYSTEM_WORKFLOW_ARTIFACT.md` (필수 품질 게이트 섹션)
- Modify: `/home/ubuntu/.openclaw/workspace/system/data/quality-gates/README.md`
- Modify: `/home/ubuntu/.openclaw/workspace/skills/life-system-workflow-artifact-check/SKILL.md`

**Interfaces:**
- Produces: 밤 점검 크론이 읽는 지연 게이트 판정 절차 (크론 프롬프트 수정 없이 정본 경유로 동작 — layer-check와 같은 방식). Task 2의 스크립트 호출 경로 `python3 /home/ubuntu/workspace/system-dashboard/collector/effectiveness.py`를 정본이 참조한다.

- [x] **Step 1: 정본에 지연 게이트 소절 추가**

`LIFE_SYSTEM_WORKFLOW_ARTIFACT.md`의 `## 필수 품질 게이트` 섹션 안, `운영 원칙:` 블록 **바로 앞**에 다음을 삽입:

```markdown
### 지연 게이트 (효과 검증)

즉시 게이트가 "오늘 지켰나"라면, 지연 게이트는 "그 판단이 살아남았나"를 본다. 판정은 매일 밤 점검 때 하되, 각 항목은 성숙 기간이 지나야 판정 대상이 된다. 정의·근거의 상세는 `system/docs/EFFECTIVENESS_METRICS_2026-07-05.md`.

- Life `E1 조정 반영율` (성숙 1일): 어제 Roll-up의 "내일 블록 조정"이 오늘 Plan에 반영됐는가. "유지" 같은 무조정은 분모에서 뺀다.
- System `E2 실패 재발율` (창 30일): 오늘 `failures.jsonl`에 기록된 원인(cause)이 직전 30일에 이미 있던 원인인가.
- Workflow `E3 채택안 생존율` (성숙 14일): `decisions.jsonl`의 채택안이 14일간 뒤집히지 않았는가. 14일 전에 뒤집힘이 보이면 그 시점에 즉시 overturned로 종결한다. 판정 대상은 미회수 잔액 전체다.
- Artifact `E4 산출물 참조율` (성숙 30일): 30일 전 생성된 산출물이 이후 참조(다른 파일의 인용, 후속 커밋)를 남겼는가.

밤 점검 절차 (layer-check.jsonl append 직후에 수행):

1. `python3 /home/ubuntu/workspace/system-dashboard/collector/effectiveness.py` 실행 — E2·E4 판정 JSON을 받는다.
2. E1: 어제 daily-review의 "내일 블록 조정"과 오늘 Plan 기록(memory/YYYY-MM-DD.md, 아침 Plan 보조 결과)을 대조해 `adjustments`/`reflected`를 센다. 출처가 없으면 둘 다 0 (미기록).
3. E3: `decisions.jsonl`에서 verdict 없는 결정 전체를 훑어, 뒤집힘이 관측됐거나 14일이 지난 건에 verdict 줄을 append하고, 오늘 종결한 건수를 `judged`/`survived`로 센다.
4. 네 값을 합쳐 `system/data/quality-gates/effectiveness.jsonl`에 하루 1줄 append:

   `{"date":"YYYY-MM-DD","e1":{"adjustments":0,"reflected":0},"e2":{"logged":0,"recurred":0},"e3":{"judged":0,"survived":0},"e4":{"matured":0,"referenced":0},"note":""}`

   같은 날짜 줄이 있으면 다시 쓰지 않는다. note는 실패·특이(재발 cause, dead 산출물 등)가 있을 때만 1줄.

원장 기록 규칙:

- `failures.jsonl`에는 `cause` 필드(kebab-case 슬러그)를 반드시 포함한다. 같은 원인은 같은 슬러그를 재사용한다.
- 워크플로우 결론(채택/폐기/보류)을 확정하면 `decisions.jsonl`에 결정 줄 1개를 append한다:

  `{"date":"YYYY-MM-DD","id":"슬러그","decision":"채택안 한 줄","project":"프로젝트","source":"결론이 기록된 파일 경로"}`

- 판정(verdict) 줄은 밤 점검만 쓴다: `{"judged_at":"YYYY-MM-DD","id":"슬러그","verdict":"survived|overturned","reason":"한 줄"}`
```

- [x] **Step 2: quality-gates README에 원장 2개 추가**

`system/data/quality-gates/README.md`의 JSONL 예시 블록 **뒤에** 다음을 추가하고, 기존 failures 예시 JSON에 `"cause":"kebab-case-슬러그"` 필드를 삽입 (`"task"` 앞):

```markdown
## 지연 게이트 원장

정본은 `system/docs/LIFE_SYSTEM_WORKFLOW_ARTIFACT.md`의 지연 게이트 소절이다.

- `decisions.jsonl` — 워크플로우 결론마다 결정 줄 1개, 밤 점검이 판정 줄을 append.
- `effectiveness.jsonl` — 밤 점검이 하루 1줄, E1~E4 분자·분모만 기록 (비율은 대시보드가 파생).
```

- [x] **Step 3: SKILL.md에 포인터 추가**

`skills/life-system-workflow-artifact-check/SKILL.md`의 `- 점검을 마치면 4지표 판정을 ... append한다.` 줄 바로 아래에 추가:

```markdown
- 이어서 지연 게이트(E1~E4)를 판정해 `system/data/quality-gates/effectiveness.jsonl`에 append한다. 절차의 정본은 `system/docs/LIFE_SYSTEM_WORKFLOW_ARTIFACT.md`의 지연 게이트 소절이다.
```

- [x] **Step 4: 검증 — 정본 일관성 확인**

Run: `grep -c "effectiveness.jsonl" /home/ubuntu/.openclaw/workspace/system/docs/LIFE_SYSTEM_WORKFLOW_ARTIFACT.md /home/ubuntu/.openclaw/workspace/system/data/quality-gates/README.md /home/ubuntu/.openclaw/workspace/skills/life-system-workflow-artifact-check/SKILL.md`
Expected: 세 파일 모두 1 이상.

- [x] **Step 5: Commit**

```bash
cd /home/ubuntu/.openclaw/workspace
git add system/docs/LIFE_SYSTEM_WORKFLOW_ARTIFACT.md system/data/quality-gates/README.md skills/life-system-workflow-artifact-check/SKILL.md
git commit -m "feat(quality-gates): 지연 게이트 E1~E4 정본·원장 규칙 추가

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: E2·E4 결정적 판정 스크립트 (system-dashboard 레포)

**Files:**
- Create: `/home/ubuntu/workspace/system-dashboard/collector/effectiveness.py`
- Test: `/home/ubuntu/workspace/system-dashboard/collector/tests/test_effectiveness.py`
- Modify: `/home/ubuntu/workspace/system-dashboard/collector/manifest.yaml` (effectiveness 섹션)

**Interfaces:**
- Consumes: `failures.jsonl`의 `cause` 필드 (Task 1 규칙), manifest.yaml.
- Produces: CLI `python3 effectiveness.py [--date YYYY-MM-DD] [--config manifest.yaml]` → stdout JSON `{"date":..., "e2":{"logged":n,"recurred":m,"recurred_causes":[...]}, "e4":{"matured":n,"referenced":m,"dead":[...]}}`. 함수 `judge_e2(failures_path, date)`, `judge_e4(repos, date, globs)` — Task 1의 밤 점검 절차와 테스트가 사용.

- [x] **Step 1: manifest에 effectiveness 섹션 추가**

`manifest.yaml` 끝(`links:` 섹션 앞 아무 곳, 기존 pdca 섹션 뒤 권장)에 추가 — pdca 섹션처럼 절대 경로를 쓴다:

```yaml
effectiveness:
  ledger: /home/ubuntu/.openclaw/workspace/system/data/quality-gates/effectiveness.jsonl
  decisions: /home/ubuntu/.openclaw/workspace/system/data/quality-gates/decisions.jsonl
  failures: /home/ubuntu/.openclaw/workspace/system/data/quality-gates/failures.jsonl
  artifact_repos:          # E4 산출물 스캔 대상 git 레포
    - /home/ubuntu/.openclaw/workspace
    - /home/ubuntu/workspace/knowledge-lab
  artifact_globs: ["*.md", "*.html"]
  stale_after_days: 2      # 원장 최신 줄이 이보다 오래되면 기록이 죽은 것
```

- [x] **Step 2: 실패하는 테스트 작성**

`collector/tests/test_effectiveness.py`:

```python
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import effectiveness


def write_jsonl(path, rows):
    Path(path).write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")


def git(repo, *args, date=None):
    env = dict(os.environ)
    if date:
        env["GIT_AUTHOR_DATE"] = f"{date}T12:00:00+09:00"
        env["GIT_COMMITTER_DATE"] = f"{date}T12:00:00+09:00"
    subprocess.run(["git", "-C", str(repo), *args], check=True, env=env,
                   capture_output=True)


def make_repo(root):
    git(root, "init", "-q")
    git(root, "config", "user.email", "t@t")
    git(root, "config", "user.name", "t")
    return root


class TestJudgeE2(unittest.TestCase):
    def test_recurrence_within_window(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "failures.jsonl"
            write_jsonl(p, [
                {"date": "2026-06-20", "cause": "unit-mismatch", "task": "a"},
                {"date": "2026-07-05", "cause": "unit-mismatch", "task": "b"},
                {"date": "2026-07-05", "cause": "new-cause", "task": "c"},
            ])
            out = effectiveness.judge_e2(p, "2026-07-05")
            self.assertEqual(out["logged"], 2)
            self.assertEqual(out["recurred"], 1)
            self.assertEqual(out["recurred_causes"], ["unit-mismatch"])

    def test_no_cause_lines_ignored_and_missing_file(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "failures.jsonl"
            write_jsonl(p, [{"date": "2026-07-05", "task": "no-cause"}])
            out = effectiveness.judge_e2(p, "2026-07-05")
            self.assertEqual(out["logged"], 0)
            missing = effectiveness.judge_e2(Path(d) / "nope.jsonl", "2026-07-05")
            self.assertEqual(missing, {"logged": 0, "recurred": 0, "recurred_causes": []})

    def test_outside_window_not_recurrence(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "failures.jsonl"
            write_jsonl(p, [
                {"date": "2026-05-01", "cause": "old-cause", "task": "a"},
                {"date": "2026-07-05", "cause": "old-cause", "task": "b"},
            ])
            out = effectiveness.judge_e2(p, "2026-07-05")
            self.assertEqual(out["recurred"], 0)


class TestJudgeE4(unittest.TestCase):
    def test_referenced_by_grep_and_followup_commit(self):
        with tempfile.TemporaryDirectory() as d:
            repo = make_repo(Path(d))
            # 30일 전(2026-06-05) 생성된 산출물 3개
            (repo / "cited.md").write_text("본문")
            (repo / "touched.md").write_text("본문")
            (repo / "dead.md").write_text("본문")
            git(repo, "add", "."); git(repo, "commit", "-qm", "add", date="2026-06-05")
            # cited.md는 다른 파일이 인용, touched.md는 후속 커밋
            (repo / "later.md").write_text("근거는 cited.md 참조")
            git(repo, "add", "later.md"); git(repo, "commit", "-qm", "cite", date="2026-06-20")
            (repo / "touched.md").write_text("수정")
            git(repo, "add", "touched.md"); git(repo, "commit", "-qm", "touch", date="2026-06-21")
            out = effectiveness.judge_e4([repo], "2026-07-05", ["*.md"])
            self.assertEqual(out["matured"], 3)
            self.assertEqual(out["referenced"], 2)
            self.assertEqual(len(out["dead"]), 1)
            self.assertTrue(out["dead"][0].endswith("dead.md"))

    def test_generic_basename_needs_commit_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            repo = make_repo(Path(d))
            (repo / "README.md").write_text("문서")
            git(repo, "add", "."); git(repo, "commit", "-qm", "add", date="2026-06-05")
            (repo / "other.md").write_text("README.md 언급")  # grep은 무시돼야 함
            git(repo, "add", "other.md"); git(repo, "commit", "-qm", "o", date="2026-06-20")
            out = effectiveness.judge_e4([repo], "2026-07-05", ["*.md"])
            # 06-05 생성분은 README.md뿐 (other.md는 06-20 생성이라 미성숙)
            self.assertEqual(out["matured"], 1)
            # grep 인용은 흔한 이름이라 무시, 후속 커밋도 없으므로 dead
            self.assertEqual(out["referenced"], 0)
            self.assertTrue(out["dead"][0].endswith("README.md"))

    def test_deleted_file_excluded(self):
        with tempfile.TemporaryDirectory() as d:
            repo = make_repo(Path(d))
            (repo / "gone.md").write_text("x")
            git(repo, "add", "."); git(repo, "commit", "-qm", "add", date="2026-06-05")
            git(repo, "rm", "-q", "gone.md"); git(repo, "commit", "-qm", "rm", date="2026-06-10")
            out = effectiveness.judge_e4([repo], "2026-07-05", ["*.md"])
            self.assertEqual(out["matured"], 0)


if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 3: 테스트가 실패하는지 확인**

Run: `cd /home/ubuntu/workspace/system-dashboard/collector && python3 -m unittest tests.test_effectiveness -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'effectiveness'`

- [x] **Step 4: effectiveness.py 구현**

```python
"""E2(실패 재발)·E4(산출물 참조) 결정적 판정.

밤 점검 크론이 호출해 stdout JSON을 받고, E1/E3(LLM 판정)과 합쳐
effectiveness.jsonl에 하루 1줄 append한다. 이 스크립트는 원장에 쓰지 않는다.
"""
import argparse
import datetime as dt
import fnmatch
import json
import subprocess
from pathlib import Path

import yaml

BASE = Path(__file__).resolve().parent
KST = dt.timezone(dt.timedelta(hours=9))

RECURRENCE_WINDOW_DAYS = 30
MATURITY_DAYS = 30
GENERIC_BASENAMES = {"README.md", "index.md", "index.html", "SKILL.md"}


def _read_jsonl(path):
    p = Path(path)
    if not p.exists():
        return []
    rows = []
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def _row_date(row):
    return str(row.get("date") or row.get("created_at") or row.get("ts") or "")[:10]


def judge_e2(failures_path, date):
    """date에 기록된 cause 중 직전 30일 창에 이미 있던 것이 재발이다."""
    rows = [r for r in _read_jsonl(failures_path) if r.get("cause")]
    day = dt.date.fromisoformat(date)
    window_start = (day - dt.timedelta(days=RECURRENCE_WINDOW_DAYS)).isoformat()
    prior = {r["cause"] for r in rows if window_start <= _row_date(r) < date}
    todays = [r["cause"] for r in rows if _row_date(r) == date]
    recurred = sorted({c for c in todays if c in prior})
    return {"logged": len(todays), "recurred": len(recurred), "recurred_causes": recurred}


def _git(repo, *args):
    res = subprocess.run(["git", "-C", str(repo), *args],
                         capture_output=True, text=True, timeout=120)
    return res.stdout if res.returncode == 0 else ""


def _files_created_on(repo, date, globs):
    out = _git(repo, "log", "--diff-filter=A", f"--since={date} 00:00 +0900",
               f"--until={date} 23:59 +0900", "--name-only", "--format=")
    files = set()
    for line in out.splitlines():
        line = line.strip()
        if line and any(fnmatch.fnmatch(Path(line).name, g) for g in globs):
            files.add(line)
    return sorted(files)


def _is_referenced(repo, rel, since_date):
    if _git(repo, "log", "--oneline", f"--since={since_date} 00:00 +0900", "--", rel).strip():
        return True  # 후속 커밋이 이 파일을 다시 만졌다
    name = Path(rel).name
    if name in GENERIC_BASENAMES:
        return False  # 흔한 이름은 grep 참조를 신뢰하지 않는다
    hits = [h for h in _git(repo, "grep", "-l", "-F", name).splitlines() if h and h != rel]
    return bool(hits)


def judge_e4(repos, date, globs):
    """생성 후 30일이 지난 산출물의 참조 여부. 삭제된 파일은 분모에서 뺀다."""
    day = dt.date.fromisoformat(date)
    created = (day - dt.timedelta(days=MATURITY_DAYS)).isoformat()
    next_day = (day - dt.timedelta(days=MATURITY_DAYS - 1)).isoformat()
    matured = referenced = 0
    dead = []
    for repo in repos:
        repo = Path(repo)
        for rel in _files_created_on(repo, created, globs):
            if not (repo / rel).exists():
                continue
            matured += 1
            if _is_referenced(repo, rel, next_day):
                referenced += 1
            else:
                dead.append(f"{repo.name}/{rel}")
    return {"matured": matured, "referenced": referenced, "dead": dead}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=dt.datetime.now(KST).date().isoformat())
    ap.add_argument("--config", default=str(BASE / "manifest.yaml"))
    args = ap.parse_args(argv)
    cfg = yaml.safe_load(Path(args.config).read_text())["effectiveness"]
    result = {
        "date": args.date,
        "e2": judge_e2(cfg["failures"], args.date),
        "e4": judge_e4(cfg["artifact_repos"], args.date, cfg["artifact_globs"]),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
```

- [x] **Step 5: 테스트 통과 확인**

Run: `cd /home/ubuntu/workspace/system-dashboard/collector && python3 -m unittest tests.test_effectiveness -v`
Expected: PASS (전체). 기존 테스트도 확인: `python3 -m unittest discover tests -v` → PASS.

- [x] **Step 6: CLI 실측 1회**

Run: `cd /home/ubuntu/workspace/system-dashboard/collector && python3 effectiveness.py`
Expected: `{"date":"...","e2":{"logged":0,...},"e4":{...}}` JSON 1줄 (현재 원장이 비어 있어 e2는 0, e4는 실제 레포 30일 전 생성 파일에 따라 0 이상).

- [x] **Step 7: Commit**

```bash
cd /home/ubuntu/workspace/system-dashboard
git add collector/effectiveness.py collector/tests/test_effectiveness.py collector/manifest.yaml
git commit -m "feat: E2·E4 지연 게이트 결정적 판정 스크립트

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: collector 확장 — effectiveness rolling 파생 (system-dashboard 레포)

**Files:**
- Modify: `/home/ubuntu/workspace/system-dashboard/collector/collector.py` (collect_layer_checks 아래에 신규 함수, build_snapshot sections에 1줄)
- Test: `/home/ubuntu/workspace/system-dashboard/collector/tests/test_collector.py` (테스트 클래스 추가)

**Interfaces:**
- Consumes: manifest `effectiveness` 섹션 (Task 2), effectiveness.jsonl·decisions.jsonl 스키마 (Global Constraints).
- Produces: snapshot payload에 `effectiveness` 키:
  `{"ledger_status":"operational|down|none","latest_date":str|None,"e1":{"window_days":7,"num":m,"den":n},"e2":{...30},"e3":{...30},"e4":{...30},"decisions_pending":k}`
  (e1 num=reflected/den=adjustments, e2 num=recurred/den=logged, e3 num=survived/den=judged, e4 num=referenced/den=matured)

- [x] **Step 1: 실패하는 테스트 작성**

`tests/test_collector.py` 끝(`if __name__` 앞)에 추가:

```python
class TestEffectiveness(unittest.TestCase):
    def _write(self, d, name, rows):
        p = Path(d) / name
        p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n")
        return p

    def test_rolling_windows_and_pending(self):
        import datetime as dt
        today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
        d1 = today.isoformat()
        d10 = (today - dt.timedelta(days=10)).isoformat()
        with tempfile.TemporaryDirectory() as d:
            ledger = self._write(d, "effectiveness.jsonl", [
                {"date": d10, "e1": {"adjustments": 1, "reflected": 0},
                 "e2": {"logged": 2, "recurred": 1}, "e3": {"judged": 1, "survived": 1},
                 "e4": {"matured": 3, "referenced": 1}, "note": ""},
                {"date": d1, "e1": {"adjustments": 1, "reflected": 1},
                 "e2": {"logged": 0, "recurred": 0}, "e3": {"judged": 0, "survived": 0},
                 "e4": {"matured": 0, "referenced": 0}, "note": ""},
            ])
            decisions = self._write(d, "decisions.jsonl", [
                {"date": d10, "id": "dec-a", "decision": "A안", "project": "p", "source": "s"},
                {"date": d10, "id": "dec-b", "decision": "B안", "project": "p", "source": "s"},
                {"judged_at": d1, "id": "dec-a", "verdict": "survived", "reason": "유지"},
            ])
            cfg = {"ledger": str(ledger), "decisions": str(decisions), "stale_after_days": 2}
            out = collector.collect_effectiveness(cfg)
            self.assertEqual(out["ledger_status"], "operational")
            self.assertEqual(out["e1"], {"window_days": 7, "num": 1, "den": 1})   # d10은 7일 창 밖
            self.assertEqual(out["e2"], {"window_days": 30, "num": 1, "den": 2})
            self.assertEqual(out["e3"], {"window_days": 30, "num": 1, "den": 1})
            self.assertEqual(out["e4"], {"window_days": 30, "num": 1, "den": 3})
            self.assertEqual(out["decisions_pending"], 1)  # dec-b만 미회수

    def test_missing_and_stale_ledger(self):
        with tempfile.TemporaryDirectory() as d:
            cfg = {"ledger": str(Path(d) / "none.jsonl"),
                   "decisions": str(Path(d) / "none2.jsonl"), "stale_after_days": 2}
            out = collector.collect_effectiveness(cfg)
            self.assertEqual(out["ledger_status"], "none")
            stale = self._write(d, "eff.jsonl", [
                {"date": "2026-01-01", "e1": {"adjustments": 0, "reflected": 0},
                 "e2": {"logged": 0, "recurred": 0}, "e3": {"judged": 0, "survived": 0},
                 "e4": {"matured": 0, "referenced": 0}, "note": ""}])
            cfg["ledger"] = str(stale)
            out = collector.collect_effectiveness(cfg)
            self.assertEqual(out["ledger_status"], "down")
```

- [x] **Step 2: 테스트 실패 확인**

Run: `cd /home/ubuntu/workspace/system-dashboard/collector && python3 -m unittest tests.test_collector.TestEffectiveness -v`
Expected: FAIL — `AttributeError: module 'collector' has no attribute 'collect_effectiveness'`

- [x] **Step 3: collect_effectiveness 구현**

`collector.py`의 `collect_layer_checks` 함수 아래에 추가:

```python
# --- effectiveness (지연 게이트 rolling 파생 — 비율 저장 금지, 분자·분모만) ---

EFFECT_WINDOWS = {"e1": 7, "e2": 30, "e3": 30, "e4": 30}
EFFECT_FIELDS = {"e1": ("reflected", "adjustments"), "e2": ("recurred", "logged"),
                 "e3": ("survived", "judged"), "e4": ("referenced", "matured")}


def _read_jsonl_rows(path):
    p = Path(path)
    if not p.exists():
        return []
    rows = []
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def collect_effectiveness(cfg):
    kst = dt.timezone(dt.timedelta(hours=9))
    today = dt.datetime.now(kst).date()
    rows = _read_jsonl_rows(cfg["ledger"])
    out = {"ledger_status": "none", "latest_date": None, "decisions_pending": 0}
    for key, window in EFFECT_WINDOWS.items():
        num_f, den_f = EFFECT_FIELDS[key]
        cutoff = (today - dt.timedelta(days=window)).isoformat()
        recent = [r for r in rows if str(r.get("date", ""))[:10] > cutoff]
        out[key] = {"window_days": window,
                    "num": sum((r.get(key) or {}).get(num_f, 0) for r in recent),
                    "den": sum((r.get(key) or {}).get(den_f, 0) for r in recent)}
    if rows:
        latest = str(rows[-1].get("date", ""))[:10]
        out["latest_date"] = latest
        try:
            age = (today - dt.date.fromisoformat(latest)).days
            out["ledger_status"] = "down" if age > cfg.get("stale_after_days", 2) else "operational"
        except ValueError:
            out["ledger_status"] = "down"
    decisions = _read_jsonl_rows(cfg["decisions"])
    judged = {r["id"] for r in decisions if r.get("verdict")}
    out["decisions_pending"] = sum(1 for r in decisions
                                   if r.get("decision") and r.get("id") not in judged)
    return out
```

`build_snapshot`의 sections 튜플에서 `("pdca", ...)` 줄 다음에 추가:

```python
        ("effectiveness", lambda: collect_effectiveness(cfg["effectiveness"])),
```

- [x] **Step 4: 전체 테스트 통과 확인**

Run: `cd /home/ubuntu/workspace/system-dashboard/collector && python3 -m unittest discover tests -v`
Expected: 전체 PASS.

- [x] **Step 5: 수집기 실측 1회 (dry)**

Run: `cd /home/ubuntu/workspace/system-dashboard/collector && python3 -c "import yaml,json,collector;cfg=yaml.safe_load(open('manifest.yaml').read());print(json.dumps(collector.collect_effectiveness(cfg['effectiveness']),ensure_ascii=False))"`
Expected: `{"ledger_status":"none",...}` (원장이 아직 없으므로 none — 기록 시작 전 상태).

- [x] **Step 6: Commit**

```bash
cd /home/ubuntu/workspace/system-dashboard
git add collector/collector.py collector/tests/test_collector.py
git commit -m "feat: collector에 지연 게이트 rolling 파생 섹션 추가

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: CMS System 탭 지연 게이트 카드 (space 레포)

**Files:**
- Modify: `/home/ubuntu/workspace/space/apps/control-center-cms/components/system-panel.jsx`

**Interfaces:**
- Consumes: snapshot payload의 `effectiveness` 키 (Task 3 스키마). payload에 키가 없거나 null이면 "기록 시작 전" 표시 (수집기 미배포/섹션 오류에도 화면이 죽지 않아야 함).

- [x] **Step 1: 지연 게이트 카드 추가**

`system-panel.jsx` 상단 상수 영역(`LAYER_KEY_LABELS` 아래)에 추가:

```jsx
const EFFECT_ROWS = [
  { key: "e1", label: "L1 조정 반영율" },
  { key: "e2", label: "L2 실패 재발율" },
  { key: "e3", label: "L3 채택안 생존율" },
  { key: "e4", label: "L4 산출물 참조율" }
];

function fmtRate(m) {
  if (!m || !m.den) return "미기록";
  return `${Math.round((m.num / m.den) * 100)}% (${m.num}/${m.den})`;
}
```

L1 grid에서 `4지표 히트맵` Card와 `일일 리뷰` Card 사이에 카드 삽입 (히트맵 Card의 닫는 `</Card>` 바로 뒤):

```jsx
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Dot status={payload.effectiveness?.ledger_status || "none"} /> 지연 게이트 (효과)
            </CardTitle>
            <CardDescription>히트맵이 "오늘 지켰나"라면, 여기는 "그 판단이 살아남았나"</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {!payload.effectiveness || payload.effectiveness.ledger_status === "none" ? (
              <p className="text-sm text-muted-foreground">
                기록 시작 전 — 밤 점검이 effectiveness.jsonl에 쌓기 시작하면 표시됩니다.
              </p>
            ) : (
              <>
                {EFFECT_ROWS.map((r) => (
                  <div key={r.key} className="flex justify-between">
                    <span>{r.label} ({payload.effectiveness[r.key]?.window_days ?? "-"}일)</span>
                    <span className="font-mono">{fmtRate(payload.effectiveness[r.key])}</span>
                  </div>
                ))}
                <div className="flex justify-between text-muted-foreground">
                  <span>판정 대기 결정</span>
                  <span className="font-mono">{payload.effectiveness.decisions_pending ?? 0}건</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
```

- [x] **Step 2: 빌드 검증**

Run: `cd /home/ubuntu/workspace/space/apps/control-center-cms && npm run build`
Expected: 빌드 성공 (exit 0). 실패 시 JSX 문법 확인.

- [x] **Step 3: Commit**

```bash
cd /home/ubuntu/workspace/space
git add apps/control-center-cms/components/system-panel.jsx
git commit -m "feat(cms): System 탭에 지연 게이트(효과) 카드 추가

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

참고: 배포(k8s)는 이 플랜 범위 밖 — 커밋까지만 하고 기존 배포 절차를 따른다.

---

### Task 5: workflow-master에 결정 기록 규칙 (prompt-archive 레포)

**Files:**
- Modify: `/home/ubuntu/workspace/prompt-archive/.agent/workflows/workflow-master.md`

**Interfaces:**
- Produces: 로컬 워크플로우 세션이 결론 확정 시 decisions.jsonl에 결정 줄을 남기는 규칙 (Task 1 정본과 같은 스키마).

- [x] **Step 1: 결정 기록 섹션 추가**

`workflow-master.md` 파일 끝에 추가:

```markdown
## 결정 기록 (지연 게이트 E3)

산출물 결론(채택/폐기/보류)을 확정하면 아래 원장에 결정 줄 1개를 append한다. 판정(verdict) 줄은 밤 점검만 쓴다 — 여기서는 결정 줄만.

- 원장: `/home/ubuntu/.openclaw/workspace/system/data/quality-gates/decisions.jsonl`
- 형식: `{"date":"YYYY-MM-DD","id":"슬러그","decision":"채택안 한 줄","project":"프로젝트","source":"결론이 기록된 파일 경로"}`
- 정본: `/home/ubuntu/.openclaw/workspace/system/docs/LIFE_SYSTEM_WORKFLOW_ARTIFACT.md` 지연 게이트 소절
```

- [x] **Step 2: 검증 및 Commit**

Run: `grep -c "decisions.jsonl" /home/ubuntu/workspace/prompt-archive/.agent/workflows/workflow-master.md`
Expected: 1 이상.

```bash
cd /home/ubuntu/workspace/prompt-archive
git add .agent/workflows/workflow-master.md
git commit -m "feat(workflow-master): 결론 확정 시 decisions.jsonl 기록 규칙

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 완료 후 확인 (수동, 첫 데이터는 오늘 밤부터)

1. 오늘 밤 23:20 크론 이후 `effectiveness.jsonl`에 첫 줄이 생겼는지 확인.
2. collector 다음 실행(10분 주기) 후 CMS System 탭에서 지연 게이트 카드가 "기록 시작 전" → 값 표시로 바뀌는지 확인.
3. 첫 4~6주는 임계 없이 관측 — 오탐 사례를 note로 모아 판정 규칙을 확정한다 (스펙 "운영하며 조정할 지점").
