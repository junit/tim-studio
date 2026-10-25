import os
import shutil
import time
import json
from playwright.sync_api import sync_playwright
from PIL import Image

OUT_DIR = "docs/images"
os.makedirs(OUT_DIR, exist_ok=True)

CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE_URL = "http://127.0.0.1:8000"

CONFIG_PATH = "config.json"
BAK_PATH = "config.json.bak"
EXAMPLE_PATH = "config.example.json"

MOCK_CONFIG_DATA = {
    "status": "success",
    "data": {
        "active_env_id": "env_dev",
        "environments": [
            {
                "id": "env_dev",
                "name": "开发联调沙箱",
                "tag": "DEV",
                "remark": "开发联调与测试沙箱环境",
                "sdkappid": 1400000000,
                "secret_key": "YOUR****************HERE",
                "has_secret": True,
                "admin_user": "administrator",
                "domain": "console.tim.qq.com",
                "delay_sec": 0.05
            },
            {
                "id": "env_prod",
                "name": "正式生产环境",
                "tag": "PROD",
                "remark": "腾讯云 IM 官方主业务正式生产环境",
                "sdkappid": 1400000001,
                "secret_key": "YOUR****************HERE",
                "has_secret": True,
                "admin_user": "administrator",
                "domain": "console.tim.qq.com",
                "delay_sec": 0.05
            }
        ],
        "sdkappid": 1400000000,
        "secret_key": "YOUR****************HERE",
        "has_secret": True,
        "admin_user": "administrator",
        "domain": "console.tim.qq.com",
        "delay_sec": 0.05
    }
}

def optimize_image(filepath, target_size=(1440, 900)):
    im = Image.open(filepath)
    if im.size != target_size:
        im = im.resize(target_size, Image.Resampling.LANCZOS)
    im = im.convert("RGB")
    im.save(filepath, "PNG", optimize=True)
    print(f"Saved {filepath} ({im.size[0]}x{im.size[1]}, {os.path.getsize(filepath)//1024} KB)")

def main():
    # 1. 临时切换为示例脱敏配置，双重保险防泄密
    has_backup = False
    try:
        if os.path.exists(CONFIG_PATH):
            shutil.copyfile(CONFIG_PATH, BAK_PATH)
            has_backup = True
        if os.path.exists(EXAMPLE_PATH):
            shutil.copyfile(EXAMPLE_PATH, CONFIG_PATH)
            time.sleep(1)
            
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=CHROME_PATH,
                headless=True
            )
            
            # 1. Desktop Context
            desktop = browser.new_page(
                viewport={"width": 1440, "height": 900},
                device_scale_factor=2
            )
            
            # 全链路网络拦截与脱敏：强制将 /api/config 响应替换为 1400000000 示例数据
            def handle_config_route(route):
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(MOCK_CONFIG_DATA)
                )
            desktop.route("**/api/config", handle_config_route)
            
            desktop.goto(BASE_URL)
            desktop.wait_for_timeout(1500)
            
            # --- 1.1 Workbench ---
            print("Capturing workbench.png (Sanitized)...")
            desktop.click('button:has-text("接口调试")')
            desktop.wait_for_timeout(1500)
            wb_path = os.path.join(OUT_DIR, "workbench.png")
            desktop.screenshot(path=wb_path)
            optimize_image(wb_path, (1440, 900))
            
            # --- 1.2 Docs Center ---
            print("Capturing docs_center.png (Sanitized)...")
            desktop.click('button:has-text("API 文档中心")')
            desktop.wait_for_timeout(1500)
            docs_path = os.path.join(OUT_DIR, "docs_center.png")
            desktop.screenshot(path=docs_path)
            optimize_image(docs_path, (1440, 900))
            
            # --- 1.3 Batch Runner ---
            print("Capturing batch_runner.png (Sanitized)...")
            desktop.click('button:has-text("批量调用")')
            desktop.wait_for_timeout(1500)
            batch_path = os.path.join(OUT_DIR, "batch_runner.png")
            desktop.screenshot(path=batch_path)
            optimize_image(batch_path, (1440, 900))
            
            # --- 1.4 Environments (重点脱敏) ---
            print("Capturing environments.png (Sanitized)...")
            desktop.click('button:has-text("环境配置")')
            desktop.wait_for_timeout(1500)
            env_path = os.path.join(OUT_DIR, "environments.png")
            desktop.screenshot(path=env_path)
            optimize_image(env_path, (1440, 900))
            
            # --- 1.5 AI Agent Workbench ---
            print("Capturing agent_workbench.png (Sanitized)...")
            desktop.click('button:has-text("AI 智能体")')
            desktop.wait_for_timeout(1500)
            
            # Position scroll to showcase clean structured investigation without floating prompt
            desktop.evaluate('''() => {
                const style = document.createElement('style');
                style.id = 'hide-float-btn';
                style.innerHTML = 'button[class*="animate-bounce"], button:has(svg.lucide-arrow-down) { display: none !important; }';
                document.head.appendChild(style);
                
                const el = document.querySelector('div.overflow-y-auto.overflow-x-hidden');
                if (el) {
                    el.scrollTop = 20850;
                }
            }''')
            desktop.wait_for_timeout(800)
            agent_path = os.path.join(OUT_DIR, "agent_workbench.png")
            desktop.screenshot(path=agent_path)
            optimize_image(agent_path, (1440, 900))
            
            # --- 1.6 Agent Topology Modal ---
            print("Capturing agent_topology.png (Sanitized)...")
            topo_btn = desktop.query_selector('button:has-text("协同拓扑")')
            if topo_btn:
                topo_btn.click()
                desktop.wait_for_timeout(1000)
                topo_path = os.path.join(OUT_DIR, "agent_topology.png")
                desktop.screenshot(path=topo_path)
                optimize_image(topo_path, (1440, 900))
                desktop.keyboard.press("Escape")
                desktop.wait_for_timeout(500)
            
            desktop.close()
            
            # --- 2. Mobile View ---
            print("Capturing mobile.png (Sanitized)...")
            mobile = browser.new_page(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2
            )
            mobile.route("**/api/config", handle_config_route)
            mobile.goto(BASE_URL)
            mobile.wait_for_timeout(1500)
            mobile_path = os.path.join(OUT_DIR, "mobile.png")
            mobile.screenshot(path=mobile_path)
            optimize_image(mobile_path, (390, 844))
            mobile.close()
            
            browser.close()
            print("All sanitized screenshots captured successfully!")
    finally:
        # 恢复用户的真实配置
        if has_backup and os.path.exists(BAK_PATH):
            shutil.copyfile(BAK_PATH, CONFIG_PATH)
            os.remove(BAK_PATH)
            print("Restored real config.json successfully.")

if __name__ == "__main__":
    main()
