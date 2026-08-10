import base64
import io
import json
import sys

from PIL import Image, ImageFile


ImageFile.LOAD_TRUNCATED_IMAGES = True


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: repair_legacy_images.py <catalog.json>")

    path = sys.argv[1]
    target_names = {
        "Es Teler Kuah Alpukat",
        "Es Teler Original",
        "Jeruk Hot / Ice",
    }
    with open(path, "r", encoding="utf-8") as source_file:
        catalog = json.load(source_file)

    repaired = []
    for product in catalog["products"]:
        if product["name"] not in target_names:
            continue
        header, encoded = product["image"].split(",", 1)
        encoded += "=" * (-len(encoded) % 4)
        raw = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=88, optimize=True)
        product["image"] = "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")
        repaired.append(product["name"])

    with open(path, "w", encoding="utf-8") as output_file:
        json.dump(catalog, output_file, ensure_ascii=False)
    print(json.dumps({"repaired": repaired, "count": len(repaired)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
