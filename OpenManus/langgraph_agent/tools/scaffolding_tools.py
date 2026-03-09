"""
Scaffolding tools for creating complete web apps, presentations, documents, and PDFs.
"""

from typing import Optional, List, Literal
from langchain_core.tools import tool
import os
import json
import uuid
from pathlib import Path


class ScaffoldingTools:
    def __init__(self, workspace_path: str = "/workspace"):
        self.workspace_path = workspace_path
        os.makedirs(workspace_path, exist_ok=True)

    def _safe_path(self, path: str) -> str:
        full_path = os.path.normpath(
            os.path.join(self.workspace_path, path.lstrip("/"))
        )
        if not full_path.startswith(self.workspace_path):
            raise ValueError(f"Path {path} is outside workspace")
        return full_path

    def _write_file(self, path: str, content: str):
        full_path = self._safe_path(path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w") as f:
            f.write(content)

    async def scaffold_landing_page(
        self,
        project_name: str,
        title: str,
        description: str,
        sections: List[dict],
        theme: Literal["dark", "light", "gradient"] = "dark",
        primary_color: str = "#3b82f6",
    ) -> dict:
        project_dir = project_name.lower().replace(" ", "-")

        sections_html = ""
        for i, section in enumerate(sections):
            section_type = section.get("type", "text")
            section_title = section.get("title", "")
            section_content = section.get("content", "")

            if section_type == "hero":
                sections_html += f"""
    <section class="hero">
        <div class="hero-content">
            <h1 class="hero-title">{section_title}</h1>
            <p class="hero-subtitle">{section_content}</p>
            {f'<a href="{section.get("cta_link", "#")}" class="cta-button">{section.get("cta_text", "Get Started")}</a>' if section.get("cta_text") else ""}
        </div>
    </section>"""
            elif section_type == "features":
                features = section.get("features", [])
                features_html = "".join(
                    [
                        f'<div class="feature-card"><div class="feature-icon">{f.get("icon", "✨")}</div><h3>{f.get("title", "")}</h3><p>{f.get("description", "")}</p></div>'
                        for f in features
                    ]
                )
                sections_html += f"""
    <section class="features">
        <h2 class="section-title">{section_title}</h2>
        <div class="features-grid">{features_html}</div>
    </section>"""
            elif section_type == "pricing":
                plans = section.get("plans", [])
                plans_html = "".join(
                    [
                        f'''<div class="pricing-card {"featured" if p.get("featured") else ""}">
                        <h3>{p.get("name", "Plan")}</h3>
                        <div class="price">{p.get("price", "$0")}<span>/mo</span></div>
                        <ul>{"".join([f"<li>{feat}</li>" for feat in p.get("features", [])])}</ul>
                        <a href="{p.get("link", "#")}" class="pricing-button">Choose Plan</a>
                    </div>'''
                        for p in plans
                    ]
                )
                sections_html += f"""
    <section class="pricing">
        <h2 class="section-title">{section_title}</h2>
        <div class="pricing-grid">{plans_html}</div>
    </section>"""
            elif section_type == "testimonials":
                testimonials = section.get("testimonials", [])
                testimonials_html = "".join(
                    [
                        f'''<div class="testimonial-card">
                        <p class="quote">"{t.get("quote", "")}"</p>
                        <div class="author">
                            <strong>{t.get("name", "")}</strong>
                            <span>{t.get("role", "")}</span>
                        </div>
                    </div>'''
                        for t in testimonials
                    ]
                )
                sections_html += f"""
    <section class="testimonials">
        <h2 class="section-title">{section_title}</h2>
        <div class="testimonials-grid">{testimonials_html}</div>
    </section>"""
            elif section_type == "cta":
                sections_html += f'''
    <section class="cta-section">
        <h2>{section_title}</h2>
        <p>{section_content}</p>
        <a href="{section.get("button_link", "#")}" class="cta-button">{section.get("button_text", "Get Started")}</a>
    </section>'''
            elif section_type == "contact":
                sections_html += f"""
    <section class="contact">
        <h2 class="section-title">{section_title}</h2>
        <form class="contact-form">
            <input type="text" placeholder="Your Name" required>
            <input type="email" placeholder="Your Email" required>
            <textarea placeholder="Your Message" rows="4" required></textarea>
            <button type="submit" class="cta-button">Send Message</button>
        </form>
    </section>"""
            else:
                sections_html += f"""
    <section class="content-section">
        <h2 class="section-title">{section_title}</h2>
        <div class="content">{section_content}</div>
    </section>"""

        theme_styles = {
            "dark": """
        :root { --bg: #0a0a0b; --bg-secondary: #18181b; --text: #ffffff; --text-secondary: #a1a1aa; --border: #27272a; }
        body { background: var(--bg); color: var(--text); }""",
            "light": """
        :root { --bg: #ffffff; --bg-secondary: #f4f4f5; --text: #18181b; --text-secondary: #71717a; --border: #e4e4e7; }
        body { background: var(--bg); color: var(--text); }""",
            "gradient": """
        :root { --bg: #0a0a0b; --bg-secondary: #18181b; --text: #ffffff; --text-secondary: #a1a1aa; --border: #27272a; }
        body { background: linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 50%, #16213e 100%); color: var(--text); min-height: 100vh; }""",
        }

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta name="description" content="{description}">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        {theme_styles.get(theme, theme_styles["dark"])}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }}
        
        .hero {{ min-height: 90vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; position: relative; overflow: hidden; }}
        .hero::before {{ content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 30% 50%, {primary_color}22 0%, transparent 50%), radial-gradient(circle at 70% 50%, #8b5cf622 0%, transparent 50%); }}
        .hero-content {{ position: relative; z-index: 1; max-width: 800px; }}
        .hero-title {{ font-size: clamp(2.5rem, 8vw, 5rem); font-weight: 700; margin-bottom: 1.5rem; background: linear-gradient(135deg, var(--text) 0%, {primary_color} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
        .hero-subtitle {{ font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }}
        
        .cta-button {{ display: inline-block; padding: 1rem 2.5rem; background: linear-gradient(135deg, {primary_color}, #8b5cf6); color: white; text-decoration: none; border-radius: 9999px; font-weight: 600; transition: all 0.3s ease; border: none; cursor: pointer; font-size: 1rem; }}
        .cta-button:hover {{ transform: translateY(-2px); box-shadow: 0 10px 40px -10px {primary_color}88; }}
        
        section {{ padding: 5rem 2rem; }}
        .section-title {{ font-size: 2.5rem; font-weight: 700; text-align: center; margin-bottom: 3rem; }}
        
        .features {{ background: var(--bg-secondary); }}
        .features-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; max-width: 1200px; margin: 0 auto; }}
        .feature-card {{ background: var(--bg); padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); transition: all 0.3s ease; }}
        .feature-card:hover {{ transform: translateY(-4px); border-color: {primary_color}44; }}
        .feature-icon {{ font-size: 2.5rem; margin-bottom: 1rem; }}
        .feature-card h3 {{ font-size: 1.25rem; margin-bottom: 0.5rem; }}
        .feature-card p {{ color: var(--text-secondary); }}
        
        .pricing-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; max-width: 1000px; margin: 0 auto; }}
        .pricing-card {{ background: var(--bg-secondary); padding: 2.5rem; border-radius: 1rem; border: 1px solid var(--border); text-align: center; transition: all 0.3s ease; }}
        .pricing-card.featured {{ border-color: {primary_color}; transform: scale(1.05); }}
        .pricing-card h3 {{ font-size: 1.5rem; margin-bottom: 1rem; }}
        .price {{ font-size: 3rem; font-weight: 700; margin-bottom: 1.5rem; }}
        .price span {{ font-size: 1rem; color: var(--text-secondary); }}
        .pricing-card ul {{ list-style: none; margin-bottom: 2rem; }}
        .pricing-card li {{ padding: 0.5rem 0; color: var(--text-secondary); }}
        .pricing-button {{ display: block; padding: 1rem; background: {primary_color}; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; transition: all 0.3s ease; }}
        .pricing-button:hover {{ background: {primary_color}dd; }}
        
        .testimonials-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; max-width: 1200px; margin: 0 auto; }}
        .testimonial-card {{ background: var(--bg-secondary); padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); }}
        .quote {{ font-size: 1.1rem; font-style: italic; margin-bottom: 1.5rem; color: var(--text-secondary); }}
        .author strong {{ display: block; }}
        .author span {{ color: var(--text-secondary); font-size: 0.9rem; }}
        
        .cta-section {{ text-align: center; background: linear-gradient(135deg, {primary_color}22, #8b5cf622); }}
        .cta-section h2 {{ font-size: 2.5rem; margin-bottom: 1rem; }}
        .cta-section p {{ color: var(--text-secondary); margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }}
        
        .contact {{ background: var(--bg-secondary); }}
        .contact-form {{ max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }}
        .contact-form input, .contact-form textarea {{ padding: 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.5rem; color: var(--text); font-size: 1rem; }}
        .contact-form input:focus, .contact-form textarea:focus {{ outline: none; border-color: {primary_color}; }}
        
        .content-section {{ max-width: 800px; margin: 0 auto; }}
        .content {{ color: var(--text-secondary); font-size: 1.1rem; }}
        
        footer {{ text-align: center; padding: 2rem; color: var(--text-secondary); border-top: 1px solid var(--border); }}
    </style>
</head>
<body>
    {sections_html}
    <footer>
        <p>&copy; 2024 {title}. Built with OpenManus.</p>
    </footer>
</body>
</html>'''

        self._write_file(f"{project_dir}/index.html", html)

        manifest = {
            "name": project_name,
            "type": "landing-page",
            "entry": "index.html",
            "created": str(uuid.uuid4())[:8],
        }
        self._write_file(f"{project_dir}/manifest.json", json.dumps(manifest, indent=2))

        return {
            "success": True,
            "project_dir": project_dir,
            "files": ["index.html", "manifest.json"],
            "message": f"Landing page '{title}' created successfully",
        }

    async def scaffold_presentation(
        self,
        project_name: str,
        title: str,
        author: str,
        slides: List[dict],
        theme: Literal["black", "white", "league", "sky", "night"] = "black",
    ) -> dict:
        project_dir = project_name.lower().replace(" ", "-")

        slides_html = ""
        for slide in slides:
            slide_type = slide.get("type", "title")

            if slide_type == "title":
                slides_html += f"""
            <section data-background-gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
                <h1>{slide.get("title", "")}</h1>
                <h3>{slide.get("subtitle", "")}</h3>
                <p><small>{slide.get("author", author)}</small></p>
            </section>"""
            elif slide_type == "content":
                slides_html += f"""
            <section>
                <h2>{slide.get("title", "")}</h2>
                <p>{slide.get("content", "")}</p>
            </section>"""
            elif slide_type == "bullets":
                bullets = slide.get("bullets", [])
                bullets_html = "".join(
                    [f"<li class='fragment'>{b}</li>" for b in bullets]
                )
                slides_html += f"""
            <section>
                <h2>{slide.get("title", "")}</h2>
                <ul>{bullets_html}</ul>
            </section>"""
            elif slide_type == "image":
                slides_html += f'''
            <section data-background-image="{slide.get("image_url", "")}" data-background-size="contain">
                <h2 style="background: rgba(0,0,0,0.7); padding: 1rem; border-radius: 0.5rem;">{slide.get("title", "")}</h2>
            </section>'''
            elif slide_type == "code":
                slides_html += f"""
            <section>
                <h2>{slide.get("title", "")}</h2>
                <pre><code class="language-{slide.get("language", "javascript")}" data-trim data-noescape>{slide.get("code", "")}</code></pre>
            </section>"""
            elif slide_type == "two-column":
                slides_html += f"""
            <section>
                <h2>{slide.get("title", "")}</h2>
                <div style="display: flex; gap: 2rem;">
                    <div style="flex: 1;">{slide.get("left", "")}</div>
                    <div style="flex: 1;">{slide.get("right", "")}</div>
                </div>
            </section>"""
            elif slide_type == "quote":
                slides_html += f'''
            <section>
                <blockquote>
                    <p>"{slide.get("quote", "")}"</p>
                    <cite>— {slide.get("author", "")}</cite>
                </blockquote>
            </section>'''
            elif slide_type == "end":
                slides_html += f"""
            <section data-background-gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
                <h1>{slide.get("title", "Thank You!")}</h1>
                <p>{slide.get("content", "Questions?")}</p>
            </section>"""

        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.6.0/reset.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.6.0/reveal.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.6.0/theme/{theme}.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/monokai.min.css">
    <style>
        .reveal h1 {{ font-size: 2.5em; }}
        .reveal h2 {{ font-size: 1.8em; }}
        .reveal blockquote {{ background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 1rem; border-left: 4px solid #667eea; }}
        .reveal blockquote cite {{ display: block; margin-top: 1rem; font-size: 0.8em; opacity: 0.7; }}
        .reveal ul {{ text-align: left; }}
        .reveal pre {{ width: 100%; }}
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
            {slides_html}
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.6.0/reveal.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.6.0/plugin/highlight/highlight.min.js"></script>
    <script>
        Reveal.initialize({{
            hash: true,
            plugins: [ RevealHighlight ],
            transition: 'slide',
            backgroundTransition: 'fade'
        }});
    </script>
</body>
</html>"""

        self._write_file(f"{project_dir}/index.html", html)

        manifest = {
            "name": project_name,
            "type": "presentation",
            "entry": "index.html",
            "slides": len(slides),
            "created": str(uuid.uuid4())[:8],
        }
        self._write_file(f"{project_dir}/manifest.json", json.dumps(manifest, indent=2))

        return {
            "success": True,
            "project_dir": project_dir,
            "files": ["index.html", "manifest.json"],
            "slides_count": len(slides),
            "message": f"Presentation '{title}' with {len(slides)} slides created successfully",
        }

    async def scaffold_document(
        self,
        project_name: str,
        title: str,
        author: str,
        content_blocks: List[dict],
        theme: Literal["modern", "academic", "minimal"] = "modern",
    ) -> dict:
        project_dir = project_name.lower().replace(" ", "-")

        content_html = ""
        toc_html = ""
        heading_count = 0

        for block in content_blocks:
            block_type = block.get("type", "paragraph")

            if block_type == "heading":
                level = block.get("level", 1)
                text = block.get("text", "")
                heading_count += 1
                anchor = f"section-{heading_count}"
                toc_html += f'<li><a href="#{anchor}">{text}</a></li>'
                content_html += f'<h{level} id="{anchor}">{text}</h{level}>'
            elif block_type == "paragraph":
                content_html += f"<p>{block.get('text', '')}</p>"
            elif block_type == "list":
                items = block.get("items", [])
                ordered = block.get("ordered", False)
                tag = "ol" if ordered else "ul"
                items_html = "".join([f"<li>{item}</li>" for item in items])
                content_html += f"<{tag}>{items_html}</{tag}>"
            elif block_type == "quote":
                content_html += f"<blockquote><p>{block.get('text', '')}</p><cite>— {block.get('author', '')}</cite></blockquote>"
            elif block_type == "code":
                content_html += f'<pre><code class="language-{block.get("language", "")}">{block.get("code", "")}</code></pre>'
            elif block_type == "image":
                content_html += f'<figure><img src="{block.get("url", "")}" alt="{block.get("caption", "")}"><figcaption>{block.get("caption", "")}</figcaption></figure>'
            elif block_type == "table":
                headers = block.get("headers", [])
                rows = block.get("rows", [])
                headers_html = "".join([f"<th>{h}</th>" for h in headers])
                rows_html = "".join(
                    [
                        "<tr>" + "".join([f"<td>{cell}</td>" for cell in row]) + "</tr>"
                        for row in rows
                    ]
                )
                content_html += f"<table><thead><tr>{headers_html}</tr></thead><tbody>{rows_html}</tbody></table>"
            elif block_type == "divider":
                content_html += "<hr>"
            elif block_type == "callout":
                callout_type = block.get("callout_type", "info")
                icons = {"info": "ℹ️", "warning": "⚠️", "success": "✅", "error": "❌"}
                content_html += f'<div class="callout callout-{callout_type}"><span class="callout-icon">{icons.get(callout_type, "ℹ️")}</span><div>{block.get("text", "")}</div></div>'

        theme_styles = {
            "modern": """
                body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0b; color: #e4e4e7; }
                .container { background: #18181b; border-radius: 1rem; }
                h1, h2, h3 { color: #ffffff; }
                a { color: #3b82f6; }
                blockquote { border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.1); }
                code { background: #27272a; }
                table { border-color: #27272a; }
                th { background: #27272a; }
            """,
            "academic": """
                body { font-family: 'Georgia', serif; background: #fffef5; color: #1a1a1a; }
                .container { background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1, h2, h3 { color: #1a1a1a; font-family: 'Times New Roman', serif; }
                a { color: #1e40af; }
                blockquote { border-left: 3px solid #1e40af; background: #f0f4ff; font-style: italic; }
                code { background: #f4f4f5; color: #dc2626; }
            """,
            "minimal": """
                body { font-family: 'Helvetica Neue', sans-serif; background: #ffffff; color: #374151; }
                .container { border: 1px solid #e5e7eb; }
                h1, h2, h3 { color: #111827; font-weight: 600; }
                a { color: #2563eb; }
                blockquote { border-left: 2px solid #d1d5db; background: #f9fafb; }
            """,
        }

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        {theme_styles.get(theme, theme_styles["modern"])}
        body {{ line-height: 1.8; padding: 2rem; min-height: 100vh; }}
        .container {{ max-width: 800px; margin: 0 auto; padding: 3rem; }}
        
        .header {{ margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid rgba(128,128,128,0.2); }}
        .header h1 {{ font-size: 2.5rem; margin-bottom: 0.5rem; }}
        .header .meta {{ opacity: 0.7; }}
        
        .toc {{ background: rgba(128,128,128,0.1); padding: 1.5rem 2rem; border-radius: 0.5rem; margin-bottom: 3rem; }}
        .toc h3 {{ margin-bottom: 1rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }}
        .toc ul {{ list-style: none; }}
        .toc li {{ padding: 0.25rem 0; }}
        .toc a {{ text-decoration: none; }}
        .toc a:hover {{ text-decoration: underline; }}
        
        .content h1 {{ font-size: 2rem; margin: 2rem 0 1rem; }}
        .content h2 {{ font-size: 1.5rem; margin: 2rem 0 1rem; }}
        .content h3 {{ font-size: 1.25rem; margin: 1.5rem 0 0.75rem; }}
        .content p {{ margin: 1rem 0; }}
        .content ul, .content ol {{ margin: 1rem 0; padding-left: 2rem; }}
        .content li {{ margin: 0.5rem 0; }}
        
        blockquote {{ margin: 1.5rem 0; padding: 1rem 1.5rem; border-radius: 0.25rem; }}
        blockquote cite {{ display: block; margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.7; }}
        
        pre {{ margin: 1.5rem 0; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }}
        code {{ padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-family: 'Fira Code', monospace; font-size: 0.9em; }}
        pre code {{ padding: 0; background: none; }}
        
        figure {{ margin: 2rem 0; text-align: center; }}
        figure img {{ max-width: 100%; border-radius: 0.5rem; }}
        figcaption {{ margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.7; }}
        
        table {{ width: 100%; margin: 1.5rem 0; border-collapse: collapse; }}
        th, td {{ padding: 0.75rem 1rem; text-align: left; border: 1px solid; }}
        
        hr {{ margin: 2rem 0; border: none; height: 1px; background: rgba(128,128,128,0.3); }}
        
        .callout {{ display: flex; gap: 1rem; padding: 1rem 1.5rem; margin: 1.5rem 0; border-radius: 0.5rem; }}
        .callout-info {{ background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; }}
        .callout-warning {{ background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; }}
        .callout-success {{ background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; }}
        .callout-error {{ background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; }}
        .callout-icon {{ font-size: 1.25rem; }}
        
        @media print {{
            body {{ background: white; color: black; }}
            .container {{ box-shadow: none; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>{title}</h1>
            <p class="meta">By {author} • Generated with OpenManus</p>
        </header>
        
        {f'<nav class="toc"><h3>Table of Contents</h3><ul>{toc_html}</ul></nav>' if toc_html else ""}
        
        <main class="content">
            {content_html}
        </main>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
</body>
</html>"""

        self._write_file(f"{project_dir}/index.html", html)

        manifest = {
            "name": project_name,
            "type": "document",
            "entry": "index.html",
            "created": str(uuid.uuid4())[:8],
        }
        self._write_file(f"{project_dir}/manifest.json", json.dumps(manifest, indent=2))

        return {
            "success": True,
            "project_dir": project_dir,
            "files": ["index.html", "manifest.json"],
            "message": f"Document '{title}' created successfully",
        }

    async def scaffold_webapp(
        self,
        project_name: str,
        app_type: Literal["react", "static", "dashboard"] = "static",
        title: str = "My App",
        description: str = "",
        pages: Optional[List[dict]] = None,
    ) -> dict:
        project_dir = project_name.lower().replace(" ", "-")

        if app_type == "static":
            pages = pages or [
                {"name": "Home", "path": "index.html", "content": "Welcome!"}
            ]

            for page in pages:
                page_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page.get("name", "Page")} - {title}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, sans-serif; background: #0a0a0b; color: #fff; min-height: 100vh; }}
        nav {{ background: #18181b; padding: 1rem 2rem; display: flex; gap: 2rem; align-items: center; }}
        nav a {{ color: #a1a1aa; text-decoration: none; transition: color 0.2s; }}
        nav a:hover, nav a.active {{ color: #fff; }}
        main {{ padding: 2rem; max-width: 1200px; margin: 0 auto; }}
    </style>
</head>
<body>
    <nav>
        <strong>{title}</strong>
        {" ".join([f'<a href="{p.get("path", "#")}">{p.get("name", "Page")}</a>' for p in pages])}
    </nav>
    <main>
        <h1>{page.get("name", "Page")}</h1>
        <p>{page.get("content", "")}</p>
    </main>
</body>
</html>"""
                self._write_file(
                    f"{project_dir}/{page.get('path', 'index.html')}", page_html
                )

        elif app_type == "dashboard":
            dashboard_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, sans-serif; background: #0a0a0b; color: #fff; }}
        .dashboard {{ display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }}
        .sidebar {{ background: #18181b; padding: 1.5rem; border-right: 1px solid #27272a; }}
        .sidebar h2 {{ font-size: 1.25rem; margin-bottom: 2rem; }}
        .sidebar nav a {{ display: block; padding: 0.75rem 1rem; color: #a1a1aa; text-decoration: none; border-radius: 0.5rem; margin-bottom: 0.25rem; }}
        .sidebar nav a:hover, .sidebar nav a.active {{ background: #27272a; color: #fff; }}
        .main {{ padding: 2rem; }}
        .header {{ margin-bottom: 2rem; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }}
        .stat-card {{ background: #18181b; padding: 1.5rem; border-radius: 1rem; border: 1px solid #27272a; }}
        .stat-card h3 {{ font-size: 0.875rem; color: #a1a1aa; margin-bottom: 0.5rem; }}
        .stat-card .value {{ font-size: 2rem; font-weight: 700; }}
        .stat-card .change {{ font-size: 0.875rem; color: #22c55e; }}
        .charts {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; }}
        .chart-card {{ background: #18181b; padding: 1.5rem; border-radius: 1rem; border: 1px solid #27272a; }}
        .chart-card h3 {{ margin-bottom: 1rem; }}
    </style>
</head>
<body>
    <div class="dashboard">
        <aside class="sidebar">
            <h2>{title}</h2>
            <nav>
                <a href="#" class="active">Dashboard</a>
                <a href="#">Analytics</a>
                <a href="#">Reports</a>
                <a href="#">Settings</a>
            </nav>
        </aside>
        <main class="main">
            <header class="header">
                <h1>Dashboard</h1>
                <p style="color: #a1a1aa;">Welcome back! Here's what's happening.</p>
            </header>
            <div class="stats">
                <div class="stat-card">
                    <h3>Total Users</h3>
                    <div class="value">12,345</div>
                    <div class="change">↑ 12% from last month</div>
                </div>
                <div class="stat-card">
                    <h3>Revenue</h3>
                    <div class="value">$54,321</div>
                    <div class="change">↑ 8% from last month</div>
                </div>
                <div class="stat-card">
                    <h3>Active Sessions</h3>
                    <div class="value">1,234</div>
                    <div class="change">↑ 24% from last hour</div>
                </div>
                <div class="stat-card">
                    <h3>Conversion Rate</h3>
                    <div class="value">3.2%</div>
                    <div class="change">↑ 0.5% from last week</div>
                </div>
            </div>
            <div class="charts">
                <div class="chart-card">
                    <h3>Revenue Over Time</h3>
                    <canvas id="revenueChart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>User Distribution</h3>
                    <canvas id="userChart"></canvas>
                </div>
            </div>
        </main>
    </div>
    <script>
        new Chart(document.getElementById('revenueChart'), {{
            type: 'line',
            data: {{
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{{ label: 'Revenue', data: [30, 45, 35, 50, 55, 60], borderColor: '#3b82f6', tension: 0.4 }}]
            }},
            options: {{ plugins: {{ legend: {{ display: false }} }}, scales: {{ y: {{ grid: {{ color: '#27272a' }} }}, x: {{ grid: {{ color: '#27272a' }} }} }} }}
        }});
        new Chart(document.getElementById('userChart'), {{
            type: 'doughnut',
            data: {{
                labels: ['Desktop', 'Mobile', 'Tablet'],
                datasets: [{{ data: [55, 35, 10], backgroundColor: ['#3b82f6', '#8b5cf6', '#22c55e'] }}]
            }}
        }});
    </script>
</body>
</html>"""
            self._write_file(f"{project_dir}/index.html", dashboard_html)

        manifest = {
            "name": project_name,
            "type": f"webapp-{app_type}",
            "entry": "index.html",
            "created": str(uuid.uuid4())[:8],
        }
        self._write_file(f"{project_dir}/manifest.json", json.dumps(manifest, indent=2))

        return {
            "success": True,
            "project_dir": project_dir,
            "app_type": app_type,
            "message": f"Web app '{title}' ({app_type}) created successfully",
        }


def create_scaffolding_tools(scaffolding: ScaffoldingTools) -> List:
    @tool
    async def scaffold_landing_page(
        project_name: str,
        title: str,
        description: str,
        sections: str,
        theme: str = "dark",
        primary_color: str = "#3b82f6",
    ) -> str:
        """Create a beautiful landing page with hero, features, pricing, testimonials, etc.

        sections should be a JSON array of section objects like:
        [{"type": "hero", "title": "...", "content": "...", "cta_text": "...", "cta_link": "..."},
         {"type": "features", "title": "...", "features": [{"icon": "...", "title": "...", "description": "..."}]},
         {"type": "pricing", "title": "...", "plans": [{"name": "...", "price": "...", "features": [...]}]},
         {"type": "testimonials", "title": "...", "testimonials": [{"quote": "...", "name": "...", "role": "..."}]},
         {"type": "cta", "title": "...", "content": "...", "button_text": "...", "button_link": "..."},
         {"type": "contact", "title": "..."}]

        theme: "dark", "light", or "gradient"
        """
        import json

        sections_list = json.loads(sections) if isinstance(sections, str) else sections
        result = await scaffolding.scaffold_landing_page(
            project_name, title, description, sections_list, theme, primary_color
        )
        return str(result)

    @tool
    async def scaffold_presentation(
        project_name: str, title: str, author: str, slides: str, theme: str = "black"
    ) -> str:
        """Create a reveal.js presentation with beautiful slides.

        slides should be a JSON array like:
        [{"type": "title", "title": "...", "subtitle": "..."},
         {"type": "content", "title": "...", "content": "..."},
         {"type": "bullets", "title": "...", "bullets": ["...", "..."]},
         {"type": "code", "title": "...", "language": "python", "code": "..."},
         {"type": "quote", "quote": "...", "author": "..."},
         {"type": "two-column", "title": "...", "left": "...", "right": "..."},
         {"type": "end", "title": "Thank You!", "content": "Questions?"}]

        theme: "black", "white", "league", "sky", "night"
        """
        import json

        slides_list = json.loads(slides) if isinstance(slides, str) else slides
        result = await scaffolding.scaffold_presentation(
            project_name, title, author, slides_list, theme
        )
        return str(result)

    @tool
    async def scaffold_document(
        project_name: str,
        title: str,
        author: str,
        content_blocks: str,
        theme: str = "modern",
    ) -> str:
        """Create a rich document with headings, paragraphs, lists, code, tables, etc.

        content_blocks should be a JSON array like:
        [{"type": "heading", "level": 1, "text": "..."},
         {"type": "paragraph", "text": "..."},
         {"type": "list", "items": ["...", "..."], "ordered": false},
         {"type": "quote", "text": "...", "author": "..."},
         {"type": "code", "language": "python", "code": "..."},
         {"type": "table", "headers": ["...", "..."], "rows": [["...", "..."]]},
         {"type": "callout", "callout_type": "info", "text": "..."},
         {"type": "divider"}]

        theme: "modern", "academic", "minimal"
        """
        import json

        blocks = (
            json.loads(content_blocks)
            if isinstance(content_blocks, str)
            else content_blocks
        )
        result = await scaffolding.scaffold_document(
            project_name, title, author, blocks, theme
        )
        return str(result)

    @tool
    async def scaffold_webapp(
        project_name: str,
        title: str,
        app_type: str = "static",
        description: str = "",
        pages: str = "[]",
    ) -> str:
        """Create a complete web application.

        app_type: "static" (multi-page site), "dashboard" (admin dashboard with charts)

        For static sites, pages should be JSON array like:
        [{"name": "Home", "path": "index.html", "content": "Welcome!"},
         {"name": "About", "path": "about.html", "content": "About us..."}]
        """
        import json

        pages_list = json.loads(pages) if isinstance(pages, str) else pages
        result = await scaffolding.scaffold_webapp(
            project_name, app_type, title, description, pages_list or None
        )
        return str(result)

    return [
        scaffold_landing_page,
        scaffold_presentation,
        scaffold_document,
        scaffold_webapp,
    ]
