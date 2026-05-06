from PIL import Image
import json, os

manifest = {}
for year in ['2021','2022','2023','2024','2025','2026','xo']:
    manifest[year] = []
    folder = f'photos/{year}'
    if not os.path.exists(folder):
        continue
    for f in sorted(os.listdir(folder)):
        if f.lower().endswith(('.jpg','.jpeg','.png')):
            with Image.open(f'{folder}/{f}') as img:
                w, h = img.size
                manifest[year].append({'filename': f, 'w': w, 'h': h})

with open('photos.json', 'w') as out:
    json.dump(manifest, out, indent=2)

with open('MANIFEST_README.txt', 'w') as f:
    f.write("To update photos.json:\n1. Open Terminal\n2. Type: cd  (with a space)\n3. Drag the ilu folder into Terminal, hit enter\n4. Type: python3 generate_manifest.py\n5. Hit enter\n6. Commit and push photos.json\n")

print('Done')
