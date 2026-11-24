"""
Contract test cho quy tắc 6 giai đoạn (app/workflow_stages.py).

File test + fixture stage_contract_cases.json được nhân bản ở cả hai repo
(smart-fyp-management & Smart-Fyp-Admin). Nếu repo anh em có mặt cạnh repo này,
test còn kiểm tra hai bản module/fixture giống hệt nhau.
"""
import importlib
import json
import os
from pathlib import Path
from types import SimpleNamespace
from unittest import SkipTest

from django.test import SimpleTestCase

try:  # smart-fyp-management
    workflow_stages = importlib.import_module("app.workflow_stages")
    SIBLING_MODULE = ("Smart-Fyp-Admin", "backend", "app", "services", "workflow_stages.py")
    SIBLING_PROGRESS = ("Smart-Fyp-Admin", "backend", "app", "services", "batch_progress.py")
    LOCAL_PROGRESS = ("utils", "batch_progress.py")
except ImportError:  # Smart-Fyp-Admin
    workflow_stages = importlib.import_module("app.services.workflow_stages")
    SIBLING_MODULE = ("smart-fyp-management", "backend", "app", "workflow_stages.py")
    SIBLING_PROGRESS = ("smart-fyp-management", "backend", "app", "utils", "batch_progress.py")
    LOCAL_PROGRESS = ("services", "batch_progress.py")

TESTS_DIR = Path(__file__).resolve().parent
APP_DIR = TESTS_DIR.parent
WORKSPACE_DIR = APP_DIR.parents[2]
FIXTURE_PATH = TESTS_DIR / "fixtures" / "stage_contract_cases.json"


def load_contract():
    with open(FIXTURE_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def build_objects(case, contract):
    batch = None
    if case.get("batch") is not None:
        batch = SimpleNamespace(**{**contract["batch_defaults"], **case["batch"]})
    project = None
    if case.get("project") is not None:
        project = SimpleNamespace(**{**contract["project_defaults"], **case["project"]}, batch=batch)
    return project, batch


def _normalized(path):
    return Path(path).read_text(encoding="utf-8").replace("\r\n", "\n")


class WorkflowStageContractTests(SimpleTestCase):
    def test_contract_version_matches_fixture(self):
        self.assertEqual(load_contract()["contract_version"], workflow_stages.CONTRACT_VERSION)

    def test_all_contract_cases(self):
        contract = load_contract()
        self.assertGreaterEqual(len(contract["cases"]), 15)
        for case in contract["cases"]:
            with self.subTest(case=case["id"]):
                project, batch = build_objects(case, contract)
                result = workflow_stages.compute_project_progress(project, batch)
                expected = case["expected"]
                for key, value in expected.items():
                    if key == "statuses":
                        self.assertEqual([s["status"] for s in result["stages"]], value, case["description"])
                    elif key == "editable":
                        self.assertEqual([s["editable"] for s in result["stages"]], value, case["description"])
                    elif key == "accessible":
                        self.assertEqual([s["accessible"] for s in result["stages"]], value, case["description"])
                    else:
                        self.assertEqual(result[key], value, f"{case['description']} ({key})")

    def test_payload_shape(self):
        result = workflow_stages.compute_project_progress(None, None)
        for key in (
            "current_stage_number", "current_stage_key", "current_stage_label", "overall_percent",
            "project_status", "batch_status", "stages",
        ):
            self.assertIn(key, result)
        self.assertEqual(len(result["stages"]), 6)
        for stage in result["stages"]:
            self.assertEqual(
                set(stage), {"number", "key", "label", "status", "accessible", "editable", "reason"}
            )
            self.assertIn(stage["status"], {"completed", "active", "locked"})
            if stage["status"] == "locked":
                self.assertFalse(stage["accessible"])
                self.assertTrue(stage["reason"])

    def test_invariants_over_all_cases(self):
        """Đúng một giai đoạn active, chỉ tối đa một giai đoạn được sửa và đó là giai đoạn hiện tại."""
        contract = load_contract()
        for case in contract["cases"]:
            with self.subTest(case=case["id"]):
                project, batch = build_objects(case, contract)
                result = workflow_stages.compute_project_progress(project, batch)
                current = result["current_stage_number"]
                editable = [s["number"] for s in result["stages"] if s["editable"]]
                self.assertIn(editable, ([], [current]))
                active = [s["number"] for s in result["stages"] if s["status"] == "active"]
                self.assertIn(active, ([], [current]))
                self.assertEqual(result["current_stage_key"], result["stages"][current - 1]["key"])

    def test_write_guard_follows_contract(self):
        contract = load_contract()
        for case in contract["cases"]:
            with self.subTest(case=case["id"]):
                project, batch = build_objects(case, contract)
                result = workflow_stages.compute_project_progress(project, batch)
                for stage in result["stages"]:
                    error = workflow_stages.check_stage_write(project, stage["number"], batch)
                    self.assertEqual(error is None, stage["editable"])
                    if error:
                        self.assertEqual(error["current_stage"], result["current_stage_number"])
                        self.assertEqual(error["required_stage"], stage["number"])

    def test_defense_action_requires_eligibility(self):
        contract = load_contract()
        cases = {c["id"]: c for c in contract["cases"]}
        allowed = build_objects(cases["R07_execution_confirmed_opens_gd6"], contract)
        self.assertIsNone(workflow_stages.check_defense_action(*allowed))
        for blocked_id in (
            "R08_not_eligible_for_defense",
            "R08_final_academic_ineligible",
            "R09_deferred_after_supervisor_evaluation",
            "R10_defended_passed_terminal",
        ):
            with self.subTest(case=blocked_id):
                self.assertIsNotNone(workflow_stages.check_defense_action(*build_objects(cases[blocked_id], contract)))

    def test_batch_progress_uses_same_stage_numbers(self):
        progress_module = importlib.import_module(
            "app.utils.batch_progress" if LOCAL_PROGRESS[0] == "utils" else "app.services.batch_progress"
        )
        self.assertEqual(progress_module.DB_STAGE_TO_NUMBER, workflow_stages.BATCH_STAGE_TO_NUMBER)
        self.assertEqual(
            [d["number"] for d in progress_module.BATCH_STAGE_DEFINITIONS], [1, 2, 3, 4, 5, 6]
        )
        for definition in progress_module.BATCH_STAGE_DEFINITIONS:
            self.assertEqual(workflow_stages.BATCH_STAGE_TO_NUMBER[definition["code"]], definition["number"])

    def _sibling(self, parts):
        path = WORKSPACE_DIR.joinpath(*parts)
        if not path.exists():
            raise SkipTest(f"Không tìm thấy repo anh em: {path}")
        return path

    def test_module_identical_to_sibling_repo(self):
        sibling = self._sibling(SIBLING_MODULE)
        self.assertEqual(_normalized(workflow_stages.__file__), _normalized(sibling))

    def test_batch_progress_identical_to_sibling_repo(self):
        sibling = self._sibling(SIBLING_PROGRESS)
        self.assertEqual(_normalized(APP_DIR.joinpath(*LOCAL_PROGRESS)), _normalized(sibling))

    def test_fixture_identical_to_sibling_repo(self):
        sibling_root = SIBLING_MODULE[0]
        sibling = self._sibling(
            (sibling_root, "backend", "app", "tests", "fixtures", "stage_contract_cases.json")
        )
        self.assertEqual(_normalized(FIXTURE_PATH), _normalized(sibling))

    def test_contract_test_identical_to_sibling_repo(self):
        sibling = self._sibling(
            (SIBLING_MODULE[0], "backend", "app", "tests", "test_workflow_stage_contract.py")
        )
        self.assertEqual(_normalized(__file__), _normalized(sibling))
