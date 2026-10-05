# 후보 원본 다운로드: python3 tools/assets/fetch.py <시트키> <번호> [최대폭]
# 위키미디어는 표준 썸네일 폭(…/thumb/…/{w}px-이름)만 허용하고 원본 직접 요청은 쉽게 429가 난다
import sys, json, os, io, time, urllib.request, urllib.parse
from PIL import Image
UA = 'CookingSimulatorAssetBot/1.0 (https://github.com/tjdgus0190/Cooks; game asset research)'
BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
OUT = os.environ.get('ASSET_WORK', '/tmp/claude-0/assets')
SIZES = [330, 500, 960, 1280, 1920]

def thumb(url, w, want):
    path = urllib.parse.urlsplit(url).path  # /wikipedia/commons/a/ab/Name.jpg
    parts = path.split('/'); name = parts[-1]
    fit = [s for s in SIZES if s <= min(w, want)] or [SIZES[0]]
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{parts[-3]}/{parts[-2]}/{name}/{fit[-1]}px-{name}"

def get(url, ua):
    for t in range(5):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': ua}), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(5 + t * 5); continue
            raise
    raise RuntimeError('rate limited')

def fetch(key, idx, maxw=1600):
    meta = next(m for m in json.load(open(f'{OUT}/{key}.json')) if m['i'] == idx)
    if meta.get('source') == 'wikimedia':
        data = get(thumb(meta['url'], meta['w'], maxw), UA)
    else:
        data = get(meta['url'], BROWSER)
    im = Image.open(io.BytesIO(data)).convert('RGB')
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    path = f'{OUT}/orig-{key}-{idx}.jpg'
    im.save(path, quality=92)
    json.dump(meta, open(path + '.json', 'w'), ensure_ascii=False)
    print(path, im.size, meta['license'], meta.get('artist') or meta.get('creator'))
    return path

if __name__ == '__main__':
    fetch(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 1600)
