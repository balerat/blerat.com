# Hello, world

This is the first note on the site, and also the documentation for how notes work.

## How it works

Notes are plain markdown files living in the `notes/` folder. There is no build step: the page fetches the file and a ~100-line vanilla-JS parser renders it in the browser. To publish a note:

1. Write a markdown file in `notes/`, e.g. `2026-07-01-my-note.md`
2. Add one entry for it in `notes/index.json` with a title, date and summary
3. Push to main — the GitHub action syncs everything to S3

## What markdown is supported

The parser is deliberately small. It handles headings, paragraphs, **bold**, *italic*, `inline code`, [links](https://github.com/balerat), lists like this one:

- unordered lists
- ordered lists
- images

> Blockquotes too, for quoting people wiser than me.

And fenced code blocks:

```python
import numpy as np

def lattice_potential(x, y, beams=4):
    angles = np.pi * np.arange(beams) / beams
    return sum(np.cos(x * np.cos(t) + y * np.sin(t)) for t in angles)
```

That's all. If a note ever needs more than this, it can always be a hand-written HTML page instead.
