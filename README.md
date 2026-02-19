# Smart Folder Photo Memory Game

A polished browser memory card game that builds itself from your own photo folder.

## Better features

- ✅ Drag-and-drop or folder picker input (`webkitdirectory`)
- ✅ Automatic name pairing (`pep.jpg` matches `pep1.jpg`)
- ✅ Smooth card flip animations and match pulse effects
- ✅ Move counter, match counter, streak counter, and live timer
- ✅ Best-time record saved in browser localStorage
- ✅ Restart/shuffle button for replay

## Pairing rules

1. File extension is removed.
2. Name is lowercased.
3. Trailing numbers (and optional separator before them) are removed.
   - `pep`, `pep1`, `pep-2`, `pep_3` all normalize to `pep`.
4. Images with the same normalized base name are grouped.
5. Each group produces pairs in alphabetical file order.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.
