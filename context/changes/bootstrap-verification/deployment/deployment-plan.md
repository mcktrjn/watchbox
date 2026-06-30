## Plan: Pierwsze wdrożenie Watchbox na Cloudflare Workers

Projekt jest w 90% gotowy do deployu — adapter zainstalowany, wrangler.jsonc skonfigurowany, CI istnieje. Potrzebne są dwie poprawki w plikach, 2 ręczne kroki auth/secrets, jeden deploy, i podpięcie CI.

---

### Phase 1 — Config Fixes _(blokuje wszystko)_

1. **wrangler.jsonc**: zmień `"name": "10x-astro-starter"` → `"name": "watchbox"` _(High-certainty risk z rejestru ryzyk)_
2. **wrangler.jsonc**: dodaj komentarz `// required by @supabase/ssr — do not remove` obok `"nodejs_compat"` w `compatibility_flags` _(Low likelihood / High impact risk)_
3. **wrangler.jsonc**: dodaj `"account_id": "<CF_ACCOUNT_ID>"` — wartość uzupełnia się po `wrangler whoami` w Phase 2
4. Utwórz `context/deployment/deploy-plan.md` _(artifact wymagany przez `infrastructure.md`)_

---

### Phase 2 — Wrangler Auth _(ręczny, jednorazowy)_

5. `npx wrangler login` → OAuth w przeglądarce
6. `npx wrangler whoami` → skopiuj Account ID → wklej do wrangler.jsonc (krok 3)

---

### Phase 3 — Sekrety produkcyjne _(ręczny, zależy od Phase 2)_

7. `npx wrangler secret put SUPABASE_URL` — wartość z Supabase Dashboard → Project Settings → API
8. `npx wrangler secret put SUPABASE_KEY`
9. `npx wrangler secret list` — weryfikacja: muszą pojawić się obie nazwy

---

### Phase 4 — Build & Deploy _(zależy od Phase 1 + 3)_

10. `npm run build`
11. `npx wrangler deploy`
12. Zanotuj wydrukowany URL: `watchbox.<account>.workers.dev`

---

### Phase 5 — Smoke Test _(zależy od Phase 4)_

13. W osobnym terminalu: `npx wrangler tail` (live log stream)
14. Otwórz URL → weryfikuj HTTP 200, brak `require is not defined` w logach
15. Przejdź na `/auth/signin` → zaloguj się → potwierdź redirect na `/dashboard`
16. Wejdź na `/dashboard` bez sesji → potwierdź redirect na `/auth/signin`

---

### Phase 6 — Auto-deploy CI _(równolegle z Phase 2–5; zależy od Phase 1)_

17. **Cloudflare Dashboard** → API Tokens → Custom Token: uprawnienia `Workers Scripts: Edit` + `Account Settings: Read`. Skopiuj token (widoczny tylko raz).
18. **GitHub repo** → Settings → Secrets → Actions — dodaj:
    - `CLOUDFLARE_API_TOKEN` (token z kroku 17)
    - `CLOUDFLARE_ACCOUNT_ID` (ID z Phase 2)
    - `SUPABASE_URL` i `SUPABASE_KEY` (jeśli jeszcze nie ma)
19. Zaktualizuj ci.yml — po kroku `npm run build` dodaj step deploy, **tylko na push do master** (nie na PRy):
    ```yaml
    - name: Deploy to Cloudflare Workers
      if: github.event_name == 'push' && github.ref == 'refs/heads/master'
      run: npx wrangler deploy
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    ```
20. Push zmian → sprawdź zakładkę Actions → job "Deploy" zielony

---

**Pliki do zmiany**

- wrangler.jsonc — `name`, `account_id`, komentarz przy `nodejs_compat`
- ci.yml — dodanie deploy step
- `context/deployment/deploy-plan.md` — nowy plik (artifact)

**Weryfikacja**

1. `npx wrangler secret list` zwraca obie nazwy sekretów
2. `npx wrangler deploy` kończy bez błędów, drukuje URL
3. Live URL → HTTP 200, brak runtime errors w `wrangler tail`
4. Auth flow: sign-in → dashboard → redirect bez sesji
5. GitHub Actions: job "Deploy" zielony na push do master

**Decyzje**

- `account_id` w wrangler.jsonc zapewnia deterministyczność — bez niego wrangler w CI musi sam wykryć konto, co może się posypać gdy token ma dostęp do wielu kont
- CI deploy wyłącznie na push do `master` — PRy nie deployują (brak skonfigurowanego `[env.preview]` w wrangler.jsonc)
- Sekrety w Cloudflare vault (Phase 3) przeżywają redeploy — CI nie musi ich ponownie uploadować
