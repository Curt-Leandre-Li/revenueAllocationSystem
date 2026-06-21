#!/usr/bin/env python3
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


REPO_ROOT = Path(__file__).resolve().parents[1]
UI_ROOT = REPO_ROOT / "ui_prototype"
OUTPUT_DIR = REPO_ROOT / "output" / "phase_2d_screenshots"
API_BASE_URL = os.environ.get("DVAS_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
UI_BASE_URL = os.environ.get("DVAS_UI_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
UI_PORT = os.environ.get("DVAS_UI_PORT", "5173")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def wait_for_http(url, timeout_seconds=60):
    deadline = time.time() + timeout_seconds
    last_error = None
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=2) as response:
                if response.status < 500:
                    return
        except URLError as exc:
            last_error = exc
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error}")


def start_process(command, cwd, env):
    return subprocess.Popen(
        command,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def stop_process(process):
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def run_node_capture(script_source, env):
    with tempfile.NamedTemporaryFile(
        "w",
        suffix=".mjs",
        encoding="utf-8",
        dir=str(UI_ROOT),
        delete=False,
    ) as script:
        script.write(script_source)
        script_path = Path(script.name)
    try:
        completed = subprocess.run(
            ["node", str(script_path)],
            cwd=str(UI_ROOT),
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
    finally:
        script_path.unlink(missing_ok=True)
    if completed.returncode != 0:
        print(completed.stdout, file=sys.stderr)
        print(completed.stderr, file=sys.stderr)
        raise RuntimeError("Playwright screenshot capture failed")
    if completed.stdout:
        print(completed.stdout.strip())


PHASE_2D_CAPTURE_JS = r"""
import { chromium, request } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.DVAS_UI_BASE_URL;
const apiBaseUrl = process.env.DVAS_API_BASE_URL;
const outputDir = process.env.DVAS_SCREENSHOT_OUTPUT_DIR;

async function waitForApp(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);
}

async function capture(page, filename, route) {
  if (route) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  }
  await waitForApp(page);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
}

async function waitForButtonEnabled(page, name) {
  const button = page.getByRole("button", { name }).first();
  await button.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction(
    (label) => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const match = buttons.find((button) => button.textContent?.includes(label));
      return Boolean(match && !match.disabled);
    },
    name,
    { timeout: 10000 },
  );
  return button;
}

async function postApi(api, path) {
  const response = await api.post(path, { data: {} });
  const payload = await response.json().catch(() => null);
  if (!response.ok() || !payload?.success) {
    throw new Error(`POST ${path} failed: ${payload?.code ?? response.status()} ${payload?.message ?? ""}`);
  }
  return payload.data;
}

async function latestProjectId(api) {
  const response = await api.get("/api/projects");
  const payload = await response.json().catch(() => null);
  if (!response.ok() || !payload?.success || !payload.data?.items?.length) {
    throw new Error("project list is empty after operation");
  }
  const projects = [...payload.data.items].sort((left, right) =>
    String(right.updated_at || right.created_at).localeCompare(String(left.updated_at || left.created_at)),
  );
  return projects[0].project_id;
}

async function clickOperation(page, name, responsePart) {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(responsePart) && response.request().method() === "POST",
    { timeout: 120000 },
  );
  const button = await waitForButtonEnabled(page, name);
  await button.click();
  const dialog = page.getByRole("dialog", { name: "确认操作" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: "确认" }).click();
  }
  const response = await responsePromise;
  const payload = await response.json().catch(() => null);
  if (!response.ok() || !payload?.success) {
    throw new Error(`${name} failed: ${payload?.code ?? response.status()} ${payload?.message ?? ""}`);
  }
  await waitForApp(page);
  return payload.data;
}

async function performOperation(page, api, name, responsePart, fallbackPath) {
  try {
    return await clickOperation(page, name, responsePart);
  } catch (error) {
    console.log(`${name} button path fallback to real API: ${error.message}`);
    const data = await postApi(api, fallbackPath);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    return data;
  }
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const api = await request.newContext({ baseURL: apiBaseUrl });

await capture(page, "01_dashboard_initial.png", "/dashboard");
let operation = await performOperation(page, api, "选择演示数据", "/api/demo-cases/load", "/api/demo-cases/load");
let projectId = operation?.project_id ?? await latestProjectId(api);
await capture(page, "02_dashboard_loaded.png", "/dashboard");
operation = await performOperation(page, api, "执行完整链路计算", "/pipeline/run", `/api/projects/${projectId}/pipeline/run`);
projectId = operation?.project_id ?? projectId;
operation = await performOperation(page, api, "确认分配方案", "/allocation/confirm", `/api/projects/${projectId}/allocation/confirm`);
projectId = operation?.project_id ?? projectId;
operation = await performOperation(page, api, "生成报告", "/reports/generate", `/api/projects/${projectId}/reports/generate`);
projectId = operation?.project_id ?? projectId;

const routes = [
  ["03_data_ingestion.png", "/data/ingestion"],
  ["04_data_resources.png", "/data/resources"],
  ["05_parties.png", "/data/parties"],
  ["06_quality.png", "/measure/quality"],
  ["07_shuyuan.png", "/measure/shuyuan"],
  ["08_utility.png", "/measure/utility"],
  ["09_md_dshap.png", "/allocation/md-dshap"],
  ["10_allocation_simulation.png", "/allocation/simulation"],
  ["11_constraints.png", "/allocation/constraints"],
  ["12_reports.png", "/reports"],
  ["13_audit_logs.png", "/system/audit"],
  ["14_parameters.png", "/system/parameters"],
  ["15_users_p1_notice.png", "/system/users"],
];
for (const [filename, route] of routes) {
  await capture(page, filename, route);
}

await api.post("/api/data/upload-json", {
  data: {
    project_name: "Phase 2D 上传失败截图",
    scenario_name: "字段级错误展示",
    revenue_pool: { total_revenue: "-1.00" },
    participants: [
      { party_name: "重复参与方", party_type: "DATA_PROVIDER", include_in_md_dshap: true },
      { party_name: "重复参与方", party_type: "DATA_PROVIDER", include_in_md_dshap: true },
    ],
    resources: [],
  },
});
await api.dispose();
await page.goto(`${baseUrl}/data/ingestion`, { waitUntil: "domcontentloaded" });
await page.reload({ waitUntil: "domcontentloaded" });
await waitForApp(page);
await page.screenshot({ path: path.join(outputDir, "16_upload_error_state.png"), fullPage: true });

await browser.close();
console.log("Phase 2D business screenshots captured");
"""


BACKEND_UNAVAILABLE_CAPTURE_JS = r"""
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.DVAS_UI_BASE_URL;
const outputDir = process.env.DVAS_SCREENSHOT_OUTPUT_DIR;

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outputDir, "17_backend_unavailable_state.png"), fullPage: true });
await browser.close();
console.log("Phase 2D backend-unavailable screenshot captured");
"""


def main():
    require(os.environ.get("DATABASE_URL"), "DATABASE_URL is required for Phase 2D screenshot capture")
    require((UI_ROOT / "node_modules" / "playwright").exists(), "ui_prototype node_modules/playwright is required")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT)
    env["VITE_API_BASE_URL"] = API_BASE_URL
    env["DVAS_API_BASE_URL"] = API_BASE_URL
    env["DVAS_UI_BASE_URL"] = UI_BASE_URL
    env["DVAS_SCREENSHOT_OUTPUT_DIR"] = str(OUTPUT_DIR)

    backend = start_process([sys.executable, "-m", "backend.dvas.server"], REPO_ROOT, env)
    frontend = start_process(["npm", "run", "dev", "--", "--port", UI_PORT], UI_ROOT, env)
    try:
      wait_for_http(f"{API_BASE_URL}/health/db", timeout_seconds=60)
      wait_for_http(UI_BASE_URL, timeout_seconds=60)
      run_node_capture(PHASE_2D_CAPTURE_JS, env)
      stop_process(backend)
      run_node_capture(BACKEND_UNAVAILABLE_CAPTURE_JS, env)
    finally:
      stop_process(backend)
      stop_process(frontend)

    screenshots = sorted(path.name for path in OUTPUT_DIR.glob("*.png"))
    expected_count = 17
    require(len(screenshots) >= expected_count, f"expected at least {expected_count} screenshots, found {len(screenshots)}")
    print("Phase 2D screenshots:")
    for filename in screenshots:
        print(f"- {filename}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"FAIL\tphase 2d screenshot capture error\t{exc}", file=sys.stderr)
        sys.exit(2)
