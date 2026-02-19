# Smart Folder Photo Memory Game

A polished browser memory card game that builds itself from your own photo folder.

## New upgrades

- ✅ Folder picker + drag/drop input
- ✅ Smart pairing (`pep.jpg` matches `pep1.jpg`)
- ✅ Difficulty modes (easy, normal, hard, expert)
- ✅ Peek button to briefly reveal all unmatched cards
- ✅ Pair-group preview list before starting
- ✅ Move, match, streak, accuracy, timer, and best-time stats
- ✅ Progress bar and responsive compact board layout for bigger games

## Pairing rules

1. File extension is removed.
2. Name is lowercased.
3. Trailing numbers (and optional separator before them) are removed.
   - `pep`, `pep1`, `pep-2`, `pep_3` all normalize to `pep`.
4. Images with the same normalized base name are grouped.
5. Every two files in a group become one playable pair.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.
