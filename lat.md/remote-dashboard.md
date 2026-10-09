# Remote dashboard screens

Direct Remote mode talks to the Hermes dashboard REST API. This file records how each screen that used to be hidden behind a "not available in remote mode" notice is backed, and the safety rules those backends follow.

## Authenticated requests

Every dashboard call from the main process must carry the OAuth cookie or session token, so remote modules go through [[src/main/remote-api.ts#remoteDashboardRequestJson]] or [[src/main/remote-oauth.ts#remoteAuthFetch]], never a bare `fetch`.

A bare `fetch` has no OAuth cookie, so the dashboard answers 401. Several modules used to swallow that error and render an empty list, which looked like "no data" instead of "not signed in".

## Schedules

Cron jobs prefer the dashboard `/api/cron/jobs` and fall back to the gateway `/api/jobs` only on 404 or 405, mapping `/trigger` to `/run`. See [[src/main/cronjobs.ts]].

An HTML 200 from `/health` is the dashboard SPA, not a gateway, and is never treated as a healthy api_server.

## Skills

Skills list, content, install and uninstall use `/api/skills*` through [[src/main/remote-skills.ts]]. Install and uninstall spawn a CLI on the server, so success means "started".

## Gateway

Start, stop and restart post to `/api/gateway/*` and liveness comes from `/api/status`. See [[src/main/remote-gateway.ts]]. The local API server key block is hidden remotely because it describes the local `.env`.

## Providers

API keys and the credential pool use `/api/env` and `/api/credentials/pool` ([[src/main/remote-providers.ts]]). The server only returns redacted previews, so an untouched preview is never written back and an empty value deletes the key.

Removing pool credentials is limited to one entry per call; a larger diff means the renderer list is stale and is refused rather than deleting server secrets.

## Agents

The Agents screen lists and creates profiles with `/api/profiles` ([[src/main/remote-profiles.ts]]). Which profile the desktop has selected stays a local choice and never changes the server's sticky `profile use` default.

## Memory

Memory is read-only remotely ([[src/main/remote-memory.ts]]). The dashboard has no content API for `MEMORY.md` and `USER.md`, so they are read through `/api/fs/read-text`, and every memory write handler refuses instead of falling through to local files.

A locked dashboard answers that read with 403 (outside the managed read boundary). Then the screen shows only the file sizes and providers from `/api/memory` and says the contents are not exposed, instead of failing.

`SOUL.md` has a first-class API (`/api/profiles/{name}/soul`) and is read and written there; reset is not offered remotely.

## Kanban

Boards, tasks, status changes, comments and dispatch use `/api/plugins/kanban/*` ([[src/main/remote-kanban.ts]]). Status verbs are `PATCH /tasks/{id}`, so the server's dependency refusal (409) is shown rather than forced.

The selected board is kept client-side and sent as `?board=`. The server-wide current board is never switched because the CLI and slash commands read it.

## Discover

Discover is browse-only remotely ([[src/main/remote-discover.ts]]). The community catalog comes from the public registry and the "installed" markers come from the server. Registry installs are refused because they unpack into the local profile directory.
