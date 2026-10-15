# visual-diff

Zero-dependency pixel diff for screenshot folders. Agents use it to prove visual parity: take screenshots before and after a change, then confirm nothing moved. It uses only Node built-ins and needs Node 20 or newer.

## Usage

```
node visual-diff.mjs <before-dir> <after-dir> [--out <diff-dir>] [--tolerance <0-255>] [--json <file>]
```

- Every `*.png` in `before-dir` is paired with the file of the same name in `after-dir`.
- A pixel counts as changed when any RGBA channel differs by more than `--tolerance` (default `0`).
- For each pair with matching sizes, a diff PNG is written to `<diff-dir>/<name>` (default `<after-dir>/../diff`). Changed pixels are solid red. Unchanged pixels show the after image at 30% opacity over white.
- A table prints each page's size, changed pixel count and changed percentage.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | Every pair is identical and nothing is missing |
| 1 | At least one page is `changed`, `size_mismatch`, `missing_before` or `missing_after` |
| 2 | Bad arguments, an unreadable directory, or a PNG that can't be decoded |

## JSON report (`--json <file>`)

```json
{
  "pages": [
    {
      "name": "home.png",
      "width": 1280,
      "height": 720,
      "changed_pixels": 0,
      "changed_ratio": 0,
      "status": "same",
      "diff": "/abs/or/relative/diff/home.png"
    }
  ],
  "total_changed_pixels": 0,
  "pass": true
}
```

`status` is one of `same`, `changed`, `size_mismatch`, `missing_before` or `missing_after`. For missing pages, `width`, `height`, `changed_pixels`, `changed_ratio` and `diff` are `null`. For `size_mismatch`, `width` and `height` are the after image's size, and the other three fields are `null`.

## PNG support

Chromium screenshots are 8-bit RGB/RGBA non-interlaced, which this decodes. It also decodes 8-bit grayscale, grayscale with alpha, and palette images (with `tRNS`), using all five filter types. Interlaced images and bit depths other than 8 are rejected with a clear error.

## Programmatic use

```js
import { decodePng, encodePng, diffImages, compareDirs } from "./visual-diff.mjs";
```

## Tests

```
node --test 'factory-skills/tools/*.test.mjs'
```

On Node 22 and later, `node --test` treats its arguments as globs and does not search a bare directory, so pass the file pattern.
