# Wikimedia Commons 후보 수집 (CC0·PD·CC BY·CC BY-SA) → 콘택트 시트
# 사용: python3 tools/assets/commons.py <키> "<검색어>" [개수]
import sys, json, os, io, re, time, urllib.request, urllib.parse
from PIL import Image, ImageDraw
UA = 'CookingSimulatorAssetBot/1.0 (https://github.com/tjdgus0190/Cooks; game asset research)'
OUT = os.environ.get('ASSET_WORK', '/tmp/claude-0/assets')
os.makedirs(OUT, exist_ok=True)
OK = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+|CC BY(-SA)?)', re.I)

def get(url, timeout=30):
    for t in range(6):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(5 + t * 6); continue
            raise
    raise RuntimeError('rate limited')

def search(key, q, n=30):
    params = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': f'filetype:bitmap {q}', 'gsrnamespace': 6,
                                     'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 330, 'gsrlimit': n})
    d = json.loads(get(f'https://commons.wikimedia.org/w/api.php?{params}'))
    pages = sorted(d.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
    meta, thumbs = [], []
    for p in pages:
        ii = p['imageinfo'][0]; m = ii.get('extmetadata', {})
        lic = (m.get('LicenseShortName', {}) or {}).get('value', '')
        if not OK.match(lic or ''): continue
        try:
            im = Image.open(io.BytesIO(get(ii['thumburl'], 20))).convert('RGB'); im.thumbnail((240, 240))
        except Exception: continue
        i = len(meta)
        artist = re.sub('<[^>]+>', '', (m.get('Artist', {}) or {}).get('value', ''))[:80]
        meta.append({'i': i, 'title': p['title'], 'url': ii['url'], 'w': ii['width'], 'h': ii['height'], 'license': lic,
                     'artist': artist, 'page': ii.get('descriptionurl'), 'source': 'wikimedia'})
        thumbs.append(im)
        time.sleep(0.6)
    cols = 6; rows = max(1, (len(thumbs) + cols - 1) // cols)
    sheet = Image.new('RGB', (cols * 250, rows * 262), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
    for k, im in enumerate(thumbs):
        x, y = (k % cols) * 250, (k // cols) * 262
        sheet.paste(im, (x + 5, y + 18)); m = meta[k]
        dr.text((x + 6, y + 3), f"#{k} {m['license'][:12]} {m['w']}x{m['h']}", fill=(255, 220, 120))
    sheet.save(f'{OUT}/{key}-sheet.jpg', quality=85)
    json.dump(meta, open(f'{OUT}/{key}.json', 'w'), ensure_ascii=False, indent=1)
    print(key, len(thumbs))

if __name__ == '__main__':
    search(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 30)
