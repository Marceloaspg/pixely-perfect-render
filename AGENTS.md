<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Keep public pages in top-level TanStack routes with page-specific metadata so categories and products can be shared separately.
- Keep quotation message generation in a pure helper and cart state in a shared provider so all catalog surfaces use the same list.
- Store the uploaded brand asset through Lovable Assets; the favicon is a downscaled local copy for browser compatibility.
