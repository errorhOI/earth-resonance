# Team push and pull practice

Repository: https://github.com/errorhOI/earth-resonance

- Owner: Hoi Wen Han (`errorhOI`), functions on `main`.
- Collaborator: Hoi Shao Xuan Crystal (`jamesgoime-lgtm`), interface on `ui-crystal`.
- This exercise imports existing work in small, truthful commits and practices exchanging it now.

## The four words

Commit saves a named checkpoint on your computer. Push sends those checkpoints to GitHub. Pull downloads and combines changes from GitHub. A branch is a separate line of work.

## Wen Han

```powershell
git switch main
git pull --ff-only origin main
# Edit and check the function files.
git add <changed-files>
git commit -m "fix: describe the real function change"
git push origin main
```

## Crystal

```powershell
git switch ui-crystal
git pull --ff-only origin ui-crystal
git fetch origin
git merge origin/main
# Edit and check the interface files.
git add <changed-files>
git commit -m "ui: describe the real interface change"
git push origin ui-crystal
```

Open a pull request from `ui-crystal` into `main` to review the UI work. After merging, both people pull again. If Git reports a conflict, stop and inspect the conflicting file together; do not overwrite a whole branch or force-push to solve it.

## Identity

Git's commit name/email and the GitHub login used to push are different things. This computer's practice push uses the owner's existing credential. Crystal's checkout records her explicitly requested contributor identity with a GitHub noreply email. On her own computer she should sign in to GitHub herself before pushing; no password or token belongs in the repository.

## Repeating this on Crystal's computer

Clone the repository, create her local branch from `origin/ui-crystal`, and follow the README to install Python dependencies. Her GitHub account must accept the repository invitation first.

```powershell
git clone https://github.com/errorhOI/earth-resonance.git
cd earth-resonance
git switch --track origin/ui-crystal
git config user.name "Hoi Shao Xuan Crystal"
git config user.email "356622748+jamesgoime-lgtm@users.noreply.github.com"
```

Use actual current commits. Do not backdate commits or present this exercise as past development history.

## Functions practice checkpoint

Wen Han maintains the sound and model behaviour. Before pushing a function change, check that Stop ends playback, Loop stays off when unchecked, and the bright pulse reaches B with the delayed sound. Keep the selected regions and scan speed after refresh.

Useful files: `dist/region-sound.js`, `dist/live-region-audio.js`, `dist/music-nodes.js`, `dist/sound-timing.js`, and `ray_model.py`.

## UI practice checkpoint

Crystal maintains the layout and labels. Keep headings short, controls readable, and map colours visible. Check region cards at narrow and wide window sizes. Keep model explanations inside Sources & method.

Useful files: `dist/index.html`, `dist/style.css`, and `dist/region-cards.css`. Coordinate changes to `dist/region-cards.js` with Wen Han because it includes both drawing and behaviour.

This handoff note is a new practice contribution, not evidence of who authored the earlier imported application.
