# 사진풍 음식 → "먹음직스러운 그림" 스타일 변환 (실사와 카툰 사이)
# 사용: python3 tools/assets/stylize.py [원본폴더=food-raw] [파일...]
#  1) 쿠와하라 필터로 사진 노이즈를 붓터치 같은 색면으로 정리
#  2) 채도·따뜻함·명암 대비를 올려 식욕을 돋우는 색으로
#  3) 형태 경계에 따뜻한 갈색 선(잉크 라인)을 살짝
#  4) 누끼(투명 배경) 이미지는 가장자리를 매끈하게 다듬고 일러스트 외곽선 + 안쪽 림라이트
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('ASSET_WORK', '/tmp/claude-0/assets'), 'food-raw')
OUT = os.path.join(os.path.dirname(__file__), '../../www/assets/food')
ONLY = set(sys.argv[2:])
SKIP = {'steak_grain.png'}  # 단면 결 하이패스(회색) — 그대로 사용

# 파일별 세기: 큰 텍스처(스테이크 등)는 약하게, 작은 가니쉬는 강하게
STRENGTH = {'steak_raw.jpg': 0.55, 'steak_crust.jpg': 0.45, 'lobster_meat.jpg': 0.8, 'gambas.webp': 0.6, 'gambas_plain.webp': 0.6, 'gratin.jpg': 0.7}
NO_OUTLINE = {'gambas.webp', 'gambas_plain.webp'}  # 팬째 그린 그림은 팬 테두리가 이미 선 역할


def kuwahara(a, r):
    """채널별 4사분면 평균/분산 → 분산이 가장 작은 사분면 평균 (붓터치 같은 평탄화)"""
    lum = a[..., :3].mean(-1)
    k = r + 1
    means, vars_ = [], []
    m_all = [nd.uniform_filter(a[..., c], k) for c in range(3)]
    l1 = nd.uniform_filter(lum, k); l2 = nd.uniform_filter(lum * lum, k)
    v_all = l2 - l1 * l1
    for dy, dx in ((-r // 2, -r // 2), (-r // 2, r // 2), (r // 2, -r // 2), (r // 2, r // 2)):
        sh = lambda x: nd.shift(x, (dy, dx), order=0, mode='nearest')
        means.append(np.stack([sh(m) for m in m_all], -1)); vars_.append(sh(v_all))
    idx = np.argmin(np.stack(vars_, 0), 0)
    M = np.stack(means, 0)
    return np.take_along_axis(M, idx[None, ..., None].repeat(3, -1), 0)[0]


def grade(rgb, s):
    """식욕 색보정: 채도↑, 따뜻하게, 부드러운 S커브"""
    x = rgb / 255
    lum = (x * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    x = lum + (x - lum) * (1 + 0.18 * s)
    x = x * [1 + 0.025 * s, 1 + 0.005 * s, 1 - 0.03 * s]
    x = np.clip(x, 0, 1)
    x = x + (x - x * x) * (x - 0.5) * 0.6 * s  # S커브
    return np.clip(x * 255, 0, 255)


def ink(rgb, s):
    """밝기 경계에 따뜻한 갈색 선을 겹침"""
    lum = rgb.mean(-1)
    g = np.hypot(nd.sobel(lum, 0), nd.sobel(lum, 1))
    g = nd.gaussian_filter(g, 0.7)
    e = np.clip((g - 60) / 160, 0, 1)[..., None] * 0.45 * s
    return rgb * (1 - e) + np.array([70, 34, 18]) * e


def soft_highlight(rgb, s):
    """밝은 부분을 크림색으로 살짝 띄워 촉촉한 윤기"""
    lum = rgb.mean(-1, keepdims=True) / 255
    h = np.clip((lum - 0.72) / 0.28, 0, 1) * 0.35 * s
    return rgb * (1 - h) + np.array([255, 246, 225]) * h


def process(name):
    src = os.path.join(SRC, name)
    im = Image.open(src)
    has_a = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    im = im.convert('RGBA')
    a = np.asarray(im, np.float32)
    s = STRENGTH.get(name, 1.0)
    h, w = a.shape[:2]
    r = max(2, round(min(w, h) / 90 * s))  # 해상도에 비례한 붓 크기
    rgb = a[..., :3]
    alpha = a[..., 3] / 255
    if has_a:
        # 투명 배경 색이 번지지 않게 가장자리 색을 안쪽 색으로 채운 뒤 필터
        inside = alpha > 0.5
        if inside.any():
            _, (iy, ix) = nd.distance_transform_edt(~inside, return_indices=True)
            rgb = rgb[iy, ix]
    # 작은 붓으로 두 번 + 미디언 → 블록 없이 매끈한 색면, 마지막에 살짝 풀어 붓 자국을 부드럽게
    out = kuwahara(rgb, max(2, r - 1))
    out = kuwahara(out, 2)
    out = np.stack([nd.median_filter(out[..., c], size=3) for c in range(3)], -1)
    out = np.stack([nd.gaussian_filter(out[..., c], 0.6) for c in range(3)], -1)
    out = out * (0.75 + 0.25 * s) + rgb * 0.25 * (1 - s)  # 세기가 약하면 원본 결을 조금 남김
    out = grade(out, s)
    out = soft_highlight(out, s)
    out = ink(out, s)
    if has_a:
        # 매끈한 외곽: 알파를 부드럽게 이진화 후 1px 안쪽으로
        al = nd.gaussian_filter(alpha, 1.0)
        al = np.clip((al - 0.45) / 0.12, 0, 1)
        al = nd.grey_erosion(al, size=(2, 2))
        if name not in NO_OUTLINE:
            ow = max(2, round(min(w, h) / 110))
            outer = np.clip(nd.gaussian_filter(nd.grey_dilation(al, size=(ow * 2 + 1, ow * 2 + 1)), 0.8), 0, 1)
            # 안쪽 림: 가장자리 근처를 살짝 어둡게(입체감)
            dist = nd.distance_transform_edt(al > 0.5)
            rim = np.clip(1 - dist / (ow * 2.5), 0, 1)[..., None] * 0.35
            out = out * (1 - rim) + np.array([90, 45, 22]) * rim
            line = np.array([74, 38, 20], np.float32)
            comp = out * al[..., None] + line * (1 - al[..., None])
            alpha_out = np.maximum(al, outer * 0.92)
            out, al = comp, alpha_out
        res = np.dstack([np.clip(out, 0, 255), al * 255]).astype(np.uint8)
        Image.fromarray(res, 'RGBA').save(os.path.join(OUT, name), quality=88, method=6)
    else:
        Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=88)
    print('stylized', name, (w, h), 'r', r)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name in sorted(os.listdir(SRC)):
        if name in SKIP or (ONLY and name not in ONLY):
            if name in SKIP and not ONLY:
                Image.open(os.path.join(SRC, name)).save(os.path.join(OUT, name))
            continue
        if name.split('.')[-1] not in ('jpg', 'png', 'webp'):
            continue
        process(name)
