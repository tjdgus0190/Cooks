# 사진 후보 수집: Openverse(CC0·PDM·CC BY)에서 검색해 썸네일 콘택트 시트를 만든다
# 사용: python3 tools/assets/search.py <키> "<검색어>" [개수]
import sys, json, os, io, urllib.request, urllib.parse
from PIL import Image, ImageDraw

OUT = os.environ.get('ASSET_WORK', '/tmp/claude-0/assets')
os.makedirs(OUT, exist_ok=True)

def get(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'CookingSimulator/1.0 (asset research)'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def search(key, q, n=24):
    params = urllib.parse.urlencode({'q': q, 'license': 'cc0,pdm,by', 'page_size': min(n, 20), 'mature': 'false'})
    d = json.loads(get(f'https://api.openverse.org/v1/images/?{params}'))
    res = d['results']
    meta = []
    thumbs = []
    for i, r in enumerate(res):
        try:
            im = Image.open(io.BytesIO(get(r.get('thumbnail') or r['url'], 20))).convert('RGB')
            im.thumbnail((240, 240))
            thumbs.append((i, im))
            meta.append({'i': i, 'id': r['id'], 'title': r['title'], 'url': r['url'], 'license': r['license'], 'license_version': r.get('license_version'),
                         'creator': r.get('creator'), 'creator_url': r.get('creator_url'), 'foreign_landing_url': r.get('foreign_landing_url'),
                         'source': r.get('source'), 'w': r.get('width'), 'h': r.get('height')})
        except Exception as e:
            pass
    cols = 6
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 250, rows * 262), (30, 30, 30))
    dr = ImageDraw.Draw(sheet)
    for k, (i, im) in enumerate(thumbs):
        x, y = (k % cols) * 250, (k // cols) * 262
        sheet.paste(im, (x + 5, y + 18))
        m = next(mm for mm in meta if mm['i'] == i)
        dr.text((x + 6, y + 3), f"#{i} {m['license']} {m['w']}x{m['h']}", fill=(255, 220, 120))
    sheet.save(f'{OUT}/{key}-sheet.jpg', quality=85)
    json.dump(meta, open(f'{OUT}/{key}.json', 'w'), ensure_ascii=False, indent=1)
    print(key, len(thumbs), f'{OUT}/{key}-sheet.jpg')

if __name__ == '__main__':
    search(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 24)
