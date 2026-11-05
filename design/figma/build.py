"""Build and package the offline Figma plugin using Python's standard library."""
from pathlib import Path
import hashlib
import json
import zipfile
import base64

root = Path(__file__).resolve().parent
data = json.loads((root / 'src/data.json').read_text(encoding='utf-8'))
source = (root / 'src/plugin.js').read_text(encoding='utf-8')
project = root.parents[1]
logos = json.loads((project / 'frontend/src/lib/brands.json').read_text(encoding='utf-8'))
assert len(logos) == 10
data['brands'] = []
for logo in logos:
    asset = project / 'frontend/public' / logo['src'].lstrip('/')
    content = asset.read_bytes()
    assert hashlib.sha256(content).hexdigest() == logo['sha256'], logo['name']
    data['brands'].append({**logo, 'image': base64.b64encode(content).decode('ascii')})
data['brandSvgs'] = {tone: (project / f'frontend/public/brand/logo-{tone}.svg').read_text(encoding='utf-8') for tone in ['dark', 'light']}
data['build'] = {'version': 35, 'source_sha256': hashlib.sha256((root / 'src/plugin.js').read_bytes()).hexdigest(), 'logo_count': len(logos)}
data['bestsellerIds'] = list(dict.fromkeys(data['bestsellerIds'] + [p['id'] for p in data['products']]))[:10]
assert source.count('/*__DATA__*/') == 1
(root / 'code.js').write_text(source.replace('/*__DATA__*/', 'const DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';'), encoding='utf-8')
target = project / 'output/figma/THUTHANH-FIGMA-V35.zip'
target.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in ['manifest.json', 'code.js', 'ui.html', 'ICONS-LICENSE.txt', 'HUONG-DAN.md']:
        archive.write(root / name, name)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
print(json.dumps({'version': 35, 'products': len(data['products']), 'logo_count': len(logos), 'archive': str(target), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}))
