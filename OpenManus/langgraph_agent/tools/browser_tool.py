from typing import Optional, Callable, Awaitable
from langchain_core.tools import tool
from pydantic import BaseModel, Field
import asyncio


class BrowserAction(BaseModel):
    action: str = Field(description="Action: navigate, click, type, scroll, screenshot, extract_text")
    url: Optional[str] = Field(default=None, description="URL for navigate action")
    selector: Optional[str] = Field(default=None, description="CSS selector for click/type actions")
    text: Optional[str] = Field(default=None, description="Text for type action")
    direction: Optional[str] = Field(default=None, description="Scroll direction: up, down")


class BrowserTools:
    def __init__(self, on_screenshot: Optional[Callable[[str], Awaitable[None]]] = None):
        self._browser = None
        self._context = None
        self._page = None
        self.on_screenshot = on_screenshot
    
    async def _ensure_browser(self):
        if self._browser is None:
            from playwright.async_api import async_playwright
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(headless=True)
            self._context = await self._browser.new_context(
                viewport={"width": 1280, "height": 720}
            )
            self._page = await self._context.new_page()
        return self._page

    async def navigate(self, url: str) -> dict:
        page = await self._ensure_browser()
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        screenshot = await page.screenshot(type="png")
        import base64
        screenshot_b64 = base64.b64encode(screenshot).decode()
        if self.on_screenshot:
            await self.on_screenshot(screenshot_b64)
        return {
            "success": True,
            "url": page.url,
            "title": await page.title(),
            "screenshot": screenshot_b64
        }

    async def click(self, selector: str) -> dict:
        page = await self._ensure_browser()
        try:
            await page.click(selector, timeout=5000)
            await page.wait_for_load_state("domcontentloaded", timeout=10000)
            screenshot = await page.screenshot(type="png")
            import base64
            screenshot_b64 = base64.b64encode(screenshot).decode()
            if self.on_screenshot:
                await self.on_screenshot(screenshot_b64)
            return {"success": True, "screenshot": screenshot_b64}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def type_text(self, selector: str, text: str) -> dict:
        page = await self._ensure_browser()
        try:
            await page.fill(selector, text, timeout=5000)
            screenshot = await page.screenshot(type="png")
            import base64
            screenshot_b64 = base64.b64encode(screenshot).decode()
            if self.on_screenshot:
                await self.on_screenshot(screenshot_b64)
            return {"success": True, "screenshot": screenshot_b64}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def screenshot(self) -> dict:
        page = await self._ensure_browser()
        screenshot = await page.screenshot(type="png")
        import base64
        screenshot_b64 = base64.b64encode(screenshot).decode()
        if self.on_screenshot:
            await self.on_screenshot(screenshot_b64)
        return {
            "success": True,
            "url": page.url,
            "title": await page.title(),
            "screenshot": screenshot_b64
        }

    async def extract_text(self) -> dict:
        page = await self._ensure_browser()
        text = await page.evaluate("document.body.innerText")
        return {"success": True, "text": text[:5000]}

    async def scroll(self, direction: str = "down") -> dict:
        page = await self._ensure_browser()
        delta = 500 if direction == "down" else -500
        await page.mouse.wheel(0, delta)
        await asyncio.sleep(0.5)
        screenshot = await page.screenshot(type="png")
        import base64
        screenshot_b64 = base64.b64encode(screenshot).decode()
        if self.on_screenshot:
            await self.on_screenshot(screenshot_b64)
        return {"success": True, "screenshot": screenshot_b64}

    async def execute(self, action: BrowserAction) -> dict:
        if action.action == "navigate" and action.url:
            return await self.navigate(action.url)
        elif action.action == "click" and action.selector:
            return await self.click(action.selector)
        elif action.action == "type" and action.selector and action.text:
            return await self.type_text(action.selector, action.text)
        elif action.action == "screenshot":
            return await self.screenshot()
        elif action.action == "extract_text":
            return await self.extract_text()
        elif action.action == "scroll":
            return await self.scroll(action.direction or "down")
        else:
            return {"success": False, "error": f"Unknown action: {action.action}"}

    async def cleanup(self):
        if self._browser:
            await self._browser.close()
        if hasattr(self, '_playwright') and self._playwright:
            await self._playwright.stop()


def create_browser_tool(browser_tools: BrowserTools):
    @tool
    async def browser_use(
        action: str,
        url: Optional[str] = None,
        selector: Optional[str] = None, 
        text: Optional[str] = None,
        direction: Optional[str] = None
    ) -> str:
        """Control a web browser to navigate, click, type, scroll, or extract content.
        
        Args:
            action: One of: navigate, click, type, scroll, screenshot, extract_text
            url: URL to navigate to (for navigate action)
            selector: CSS selector (for click/type actions)
            text: Text to type (for type action)
            direction: Scroll direction: up or down (for scroll action)
        """
        browser_action = BrowserAction(
            action=action,
            url=url,
            selector=selector,
            text=text,
            direction=direction
        )
        result = await browser_tools.execute(browser_action)
        if "screenshot" in result:
            result_copy = result.copy()
            result_copy["screenshot"] = "[screenshot captured]"
            return str(result_copy)
        return str(result)
    
    return browser_use
