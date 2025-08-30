#!/usr/bin/env python3
import argparse
import os
import random
import re
import sys
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


def read_ignore_patterns(root: Path):
    patterns = []
    excluded_dirs = set([
        '.git', 'node_modules', 'tmp', '.cache', '.venv', 'venv', 'dist', 'build', '.next', '.nuxt'
    ])
    ignore_files = ['.gitignore', '.stylelintignore', '.eslintignore']
    for name in ignore_files:
        p = root / name
        if not p.exists():
            continue
        try:
            for line in p.read_text(encoding='utf-8', errors='ignore').splitlines():
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                # Normalize windows slashes
                line = line.replace('\\', '/')
                # If pattern ends with '/', treat as directory exclude
                if line.endswith('/') and '*' not in line and '?' not in line and '[' not in line:
                    excluded_dirs.add(line.rstrip('/'))
                patterns.append(line)
        except Exception:
            continue
    return patterns, excluded_dirs


def matches_ignore(rel_path: str, patterns):
    # Very lightweight glob-like matching for common .gitignore patterns.
    # Not a full implementation. Good enough for typical cases.
    # We check both the path and each of its suffixes.
    from fnmatch import fnmatch
    rel_path_unix = rel_path.replace('\\', '/')
    parts = rel_path_unix.split('/')
    suffixes = ['/'.join(parts[i:]) for i in range(len(parts))]
    for pat in patterns:
        anchored = pat.startswith('/')
        p = pat.lstrip('/')
        # Convert gitignore-style to fnmatch-ish
        p = p.replace('**/', '**')
        # Quick dir pattern support
        candidates = [rel_path_unix] if anchored else suffixes
        if any(fnmatch(c, p) for c in candidates):
            return True
    return False


class LinkScriptParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []  # (rel, href, as)
        self.scripts = []  # src

    def handle_starttag(self, tag, attrs):
        tag_l = tag.lower()
        if tag_l == 'link':
            d = {k.lower(): v for k, v in attrs}
            rel = d.get('rel', '')
            href = d.get('href')
            as_attr = d.get('as')
            if href and rel:
                self.links.append((rel.lower(), href, (as_attr or '').lower()))
        elif tag_l == 'script':
            d = {k.lower(): v for k, v in attrs}
            src = d.get('src')
            if src:
                self.scripts.append(src)


CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\(\s*(['\"]?)([^'\")]+)\1\s*\)|(['\"])([^'\"]+)\3)", re.IGNORECASE)
CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)([^'\")]+)\1\s*\)")
FONT_EXTS = {'.woff2', '.woff', '.ttf', '.otf', '.eot', '.svg'}


def is_external(url: str) -> bool:
    return url.startswith('http://') or url.startswith('https://') or url.startswith('//')


def normalize_url(url: str) -> str:
    return url.strip()


def resolve_local(base_dir: Path, path_like: str, repo_root: Path) -> Path | None:
    # Ignore data URLs
    if path_like.startswith('data:'):
        return None
    # Protocol-relative treated as external
    if path_like.startswith('//'):
        return None
    # Absolute URL
    if path_like.startswith('http://') or path_like.startswith('https://'):
        return None
    # Absolute path from site root
    if path_like.startswith('/'):
        candidate = (repo_root / path_like.lstrip('/')).resolve()
        try:
            candidate.relative_to(repo_root.resolve())
        except Exception:
            return None
        return candidate if candidate.exists() else None
    # Relative path
    candidate = (base_dir / path_like).resolve()
    try:
        candidate.relative_to(repo_root.resolve())
    except Exception:
        return None
    return candidate if candidate.exists() else None


def gather_hosts(urls):
    hosts = set()
    for u in urls:
        if u.startswith('//'):
            hosts.add(urlparse('https:' + u).netloc)
        else:
            hosts.add(urlparse(u).netloc)
    return sorted(h for h in hosts if h)


def parse_css_for_assets(css_path: Path, repo_root: Path, visited: set, external_css: set, local_fonts: set, external_fonts: set, all_local_css: set, max_depth=5):
    if css_path in visited or max_depth <= 0:
        return
    visited.add(css_path)
    try:
        text = css_path.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return
    # Collect imports
    for m in CSS_IMPORT_RE.finditer(text):
        url = m.group(2) or m.group(4) or ''
        url = normalize_url(url)
        if not url:
            continue
        if is_external(url):
            external_css.add(url)
        else:
            resolved = resolve_local(css_path.parent, url, repo_root)
            if resolved and resolved.suffix.lower() in {'.css'}:
                all_local_css.add(str(resolved.relative_to(repo_root)))
                parse_css_for_assets(resolved, repo_root, visited, external_css, local_fonts, external_fonts, all_local_css, max_depth=max_depth-1)
    # Collect font urls
    for m in CSS_URL_RE.finditer(text):
        url = normalize_url(m.group(2) or '')
        if not url:
            continue
        # Skip query/hash when checking ext
        path_no_q = url.split('#')[0].split('?')[0]
        ext = Path(path_no_q).suffix.lower()
        if ext in FONT_EXTS:
            if is_external(url):
                external_fonts.add(url)
            else:
                resolved = resolve_local(css_path.parent, url, repo_root)
                if resolved:
                    local_fonts.add(str(resolved.relative_to(repo_root)))


def sample_html_files(root: Path, per_dir: int, use_random: bool, ignore_patterns, excluded_dirs):
    sampled = {}
    rng = random.Random(0)
    for cur, dirs, files in os.walk(root):
        # Filter directories by excludes
        pruned = []
        for d in list(dirs):
            if d in excluded_dirs:
                continue
            rel_d = str(Path(cur, d).relative_to(root))
            if matches_ignore(rel_d + '/', ignore_patterns):
                continue
            pruned.append(d)
        dirs[:] = pruned

        rel_cur = str(Path(cur).relative_to(root)) if Path(cur) != root else ''
        # Collect html files
        htmls = []
        for f in files:
            if not f.lower().endswith('.html'):
                continue
            rel_f = str(Path(cur, f).relative_to(root))
            if matches_ignore(rel_f, ignore_patterns):
                continue
            htmls.append(Path(cur, f))
        if not htmls:
            continue
        htmls_sorted = sorted(htmls)
        pick = htmls_sorted
        if len(htmls_sorted) > per_dir:
            if use_random:
                # Deterministic per directory
                rng.seed(rel_cur)
                pick = rng.sample(htmls_sorted, per_dir)
            else:
                pick = htmls_sorted[:per_dir]
        sampled[rel_cur or '.'] = [str(p.relative_to(root)) for p in sorted(pick)]
    return sampled


def scan(root: Path, per_dir: int, use_random: bool):
    ignore_patterns, excluded_dirs = read_ignore_patterns(root)
    pages_sampled = sample_html_files(root, per_dir, use_random, ignore_patterns, excluded_dirs)

    by_page = {}
    global_css_local = set()
    global_css_external = set()
    global_js_local = set()
    global_js_external = set()
    external_css_from_imports = set()
    local_fonts = set()
    external_fonts = set()
    visited_css = set()

    for _, pages in pages_sampled.items():
        for rel_html in pages:
            html_path = root / rel_html
            try:
                content = html_path.read_text(encoding='utf-8', errors='ignore')
            except Exception:
                continue
            parser = LinkScriptParser()
            try:
                parser.feed(content)
            except Exception:
                # Even if HTML is malformed, best-effort
                pass
            css_list = []
            js_list = []

            # Process links
            for rel, href, as_attr in parser.links:
                href = normalize_url(href)
                rel_l = rel.lower().strip()
                is_stylesheet = 'stylesheet' in rel_l
                is_preload_style = ('preload' in rel_l) and (as_attr == 'style')
                is_preload_font = ('preload' in rel_l) and (as_attr == 'font')
                if is_stylesheet or is_preload_style:
                    if is_external(href):
                        global_css_external.add(href)
                    else:
                        resolved = resolve_local(html_path.parent, href, root)
                        if resolved and resolved.suffix.lower() == '.css':
                            rel_css = str(resolved.relative_to(root))
                            css_list.append(rel_css)
                            global_css_local.add(rel_css)
                            parse_css_for_assets(resolved, root, visited_css, external_css_from_imports, local_fonts, external_fonts, global_css_local)
                        elif resolved and resolved.is_file():
                            # Not .css, still record
                            rel_css = str(resolved.relative_to(root))
                            css_list.append(rel_css)
                            global_css_local.add(rel_css)
                if is_preload_font:
                    # Treat href as a font
                    if is_external(href):
                        external_fonts.add(href)
                    else:
                        resolved = resolve_local(html_path.parent, href, root)
                        if resolved:
                            local_fonts.add(str(resolved.relative_to(root)))

            # Process scripts
            for src in parser.scripts:
                src = normalize_url(src)
                if is_external(src):
                    global_js_external.add(src)
                else:
                    resolved = resolve_local(html_path.parent, src, root)
                    if resolved and resolved.is_file():
                        rel_js = str(resolved.relative_to(root))
                        js_list.append(rel_js)
                        global_js_local.add(rel_js)

            by_page[rel_html] = {
                'css': sorted(set(css_list)),
                'js': sorted(set(js_list)),
            }

    # Merge external CSS from imports
    global_css_external.update(external_css_from_imports)

    # Build hosts
    hosts = {
        'css': gather_hosts(global_css_external),
        'js': gather_hosts(global_js_external),
        'fonts': gather_hosts(external_fonts),
    }

    result = {
        'pages_sampled': pages_sampled,
        'by_page': by_page,
        'css': {
            'local': sorted(global_css_local),
            'external': sorted(global_css_external),
        },
        'js': {
            'local': sorted(global_js_local),
            'external': sorted(global_js_external),
        },
        'fonts': {
            'local': sorted(local_fonts),
            'external': sorted(external_fonts),
        },
    }

    return result, hosts


def write_outputs(root: Path, result: dict, hosts: dict, outdir: Path):
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / 'assets.sampled.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (outdir / 'assets.hosts.json').write_text(json.dumps(hosts, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    # Summary
    lines = []
    lines.append('Sampled pages: {} directories'.format(len(result.get('pages_sampled', {}))))
    total_pages = sum(len(v) for v in result.get('pages_sampled', {}).values())
    lines.append('Pages sampled total: {}'.format(total_pages))
    lines.append('CSS local: {} | external: {}'.format(len(result['css']['local']), len(result['css']['external'])))
    lines.append('JS  local: {} | external: {}'.format(len(result['js']['local']), len(result['js']['external'])))
    lines.append('Fonts local: {} | external: {}'.format(len(result['fonts']['local']), len(result['fonts']['external'])))
    # Include a few examples
    for key in ['css', 'js']:
        loc = result[key]['local'][:5]
        ext = result[key]['external'][:5]
        if loc:
            lines.append(f"{key.upper()} local examples: " + ', '.join(loc))
        if ext:
            lines.append(f"{key.upper()} external examples: " + ', '.join(ext))
    if result['fonts']['local']:
        lines.append('FONTS local examples: ' + ', '.join(result['fonts']['local'][:5]))
    if result['fonts']['external']:
        lines.append('FONTS external examples: ' + ', '.join(result['fonts']['external'][:5]))
    (outdir / 'assets.summary.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description='Sampled HTML asset scanner (CSS/JS/fonts)')
    parser.add_argument('--root', default='.', help='Root directory to scan (default: .)')
    parser.add_argument('--per-dir', type=int, default=2, help='Max HTML files to sample per directory (default: 2)')
    parser.add_argument('--random', action='store_true', help='Use deterministic per-dir random sampling')
    parser.add_argument('--outdir', default='tmp', help='Output directory (default: tmp)')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    outdir = Path(args.outdir)

    result, hosts = scan(root, args.per_dir, args.random)
    write_outputs(root, result, hosts, outdir)

    print(f"Wrote {outdir / 'assets.sampled.json'} and {outdir / 'assets.hosts.json'}")
    print(f"Summary: {outdir / 'assets.summary.txt'}")


if __name__ == '__main__':
    main()

