---
name: angular-standards
description: >
  Angular conventions for components, services, state, routing, forms, HTTP,
  DI, pipes, and folder layout in v20, v21, and v22-next workspaces. Use this
  skill when starting an Angular task, generating or modifying a component,
  service, directive, pipe, guard, resolver, or route, reviewing Angular code
  in a PR, or when the user asks for "the right way", "house style",
  "convention", or "best practice" for an Angular task. Testing rules live in
  the separate angular-testing skill; deep styling rules live in the css
  skill.
license: MIT
---

# Angular standards

Opinionated conventions for Angular work in v20, v21, and v22-next workspaces.
Covers components, services, state, routing, forms, HTTP, DI, pipes, and the
file layout the agent should produce. Testing is intentionally out of scope
(see `angular-testing` skill).

## When this triggers

- Generating or modifying a component, service, directive, pipe, guard,
  resolver, or route.
- Reviewing Angular code in a PR.
- The user asks for "the right way", "house style", "convention", or
  "best practice" for an Angular task.

## Workspace check — do this first

Before applying any rule, inspect the workspace:

1. **Workspace type** — single Angular project or pnpm / Angular multi-project
   workspace. Command paths and shared-config behaviour differ.
2. **Angular version** — read `angular.json` and `package.json`. This skill
   supports:
   - v20 — <https://v20.angular.dev/llms.txt>
   - v21 — <https://v21.angular.dev/llms.txt>
   - v22 (next) — <https://next.angular.dev/llms.txt>

   For anything else, tell the user the version is non-LTS for this skill and
   ask whether to proceed.
3. **Zoneless or zone-based** — v21+ is zoneless by default. Older versions
   need `provideZonelessChangeDetection()` at bootstrap if zoneless is wanted.
4. **State convention already in the codebase** — RxJS-only, Signals, or
   mixed. Match what is there before introducing a different pattern.
5. **CSS preprocessor** — Sass / Less / Tailwind / plain CSS. See **Style**.

## Components

- **Standalone is the default** in v19+. Do not write `standalone: true`. Do
  not write NgModules. Set `standalone: false` only for legacy code awaiting
  migration.
- **`OnPush` change detection always.** Combined with signals, this makes
  zoneless trivial.
- **Inline the template for small HTML**; split into a separate
  `.component.html` only when the template is large enough to hurt
  readability of the `.ts` file.
- **A component does one thing.** Compose smaller components rather than
  parameterising one component heavily. Specific + reusable.
- **Use `protected` for template-only members; mark `input()`, `model()`,
  `output()`, and queries as `readonly`.** Angular-managed values should not
  be reassigned.
- **Prefer `[class.foo]` / `[style.color]` over `NgClass` / `NgStyle`.**
- **Name event handlers by action, not trigger.** `saveUser()`, not
  `onClick()`.
- **Implement lifecycle interfaces explicitly** (`implements OnInit`) for
  type safety. Keep hooks small; extract logic into named methods.

## Services & dependency injection

- **Prefer scoped DI over `providedIn: 'root'` for stateful or feature-bound
  services.** Provide them via:
  - `app.config.ts` providers — for genuine app-wide singletons.
  - Route `providers` — for services scoped to a route subtree.
  - Component `providers` / `viewProviders` — for per-instance services.
- **Exception**: stateless utility services with no per-feature state may
  stay `providedIn: 'root'` because Angular tree-shakes them there. The
  official guidance considers this the default for stateless singletons —
  do not blanket-ban it.
- **Prefer `inject()` over constructor parameters** for type inference and
  readability.
- **`inject()` must run in an injection context.** Constructors, field
  initialisers, functional guards / interceptors / resolvers, and explicit
  `runInInjectionContext(injector, fn)` qualify. Calling `inject()` inside an
  instance method throws NG0203.

## Signals (preferred for synchronous state)

- **Use signal-based APIs throughout when the workspace supports them**:
  `signal`, `computed`, `effect`, `model`, `input`, `output`, `linkedSignal`,
  route inputs via `withComponentInputBinding()`.
- **`computed()` is lazy and memoised.** Never put side effects inside.
- **`effect()` runs only in an injection context**, and **reactive tracking
  stops at the first `await`**. Read every signal you depend on *before* any
  `await`.
- **Do not use `effect()` for derived state.** Use `computed()` for read-only
  derivations; `linkedSignal({source, computation})` for writable derived
  values that need to reset when the source changes.
- **`untracked(fn)`** when reading a signal inside an effect or computed
  without subscribing to it.
- **`asReadonly()` does not prevent deep mutation** of object values.
- **Pass a custom `equal`** on signals holding objects to avoid spurious
  notifications.

## State management

Decide layer-by-layer:

1. **Sync state in a component or feature** — use signals if the workspace
   already uses them. If the workspace is RxJS-only, stay with RxJS.
2. **Async state (HTTP, websockets, debounced inputs)** — use RxJS operators
   meaningfully. Document where RxJS still plays a role.
3. **Global state** — ask the user whether global state with a Redux pattern
   is actually required. If yes:
   - **NgRx Store** — for the full Redux pattern (actions / reducers / effects).
   - **Component Store** — for RxJS-based scoped state without Redux ceremony.
   - **Signal Store** (with extensions / plugin approach) — when the workspace
     is signal-first.
4. **RxJS ↔ Signals interop** — `toSignal(obs$)` and `toObservable(sig)`.
   `toSignal` needs `initialValue` in zoneless mode or an injection context.

## Routing

- **Functional guards and resolvers only**: `CanActivateFn`, `CanMatchFn`,
  `ResolveFn`. They run in an injection context, so `inject()` works directly.
- **Lazy-load with `loadComponent`** for a single component, **`loadChildren`**
  for a child route tree.
- **Bind route params to signal inputs** via
  `provideRouter(routes, withComponentInputBinding())` — declare
  `id = input<string>()` in the component and skip the manual
  `ActivatedRoute` subscription.
- **Route `providers`** for feature-scoped services.
- **Wildcard `**` route goes last** (first-match-wins).

## Forms

- **Reactive Forms, strictly typed.** Use `FormGroup<Shape>` and
  `FormBuilder.nonNullable.group(...)`. Avoid `UntypedFormGroup` unless the
  controls are genuinely heterogeneous.
- **Use `getRawValue()` for disabled-control values** — `.value` omits them.
- **Custom validators return `ValidationErrors | null`**; async validators
  return `Observable<ValidationErrors | null>`.
- **Signal Forms are experimental in v21** and the dedicated guide is not yet
  published. Do not adopt for production code; the team has committed to a
  migration path from Reactive Forms.
- **In zoneless apps**, programmatic form updates do not trigger CD — bind
  through signals or `AsyncPipe`.

## HTTP

- **Bootstrap with**
  `provideHttpClient(withFetch(), withInterceptors([authInterceptor, logInterceptor]))`.
- **Functional interceptors only.** They run in injection context, so
  `inject()` works directly. Class-based interceptors via
  `withInterceptorsFromDi()` are discouraged because of ordering.
- **Always `req.clone()` when mutating** a request body or headers inside an
  interceptor.
- **`httpResource()`** is experimental in v21. Do not use for
  production-critical code; reach for it only on a feature-flagged path.

## Pipes

- **Always pure.** `pure: true` is the default — never set `pure: false`.
- **If a pipe argument can be a non-primitive (object / array)**, double-check
  with the user before writing it. Pure pipes only re-evaluate on reference
  change, which often surprises callers.
- **Use pipes for primitive transformations.** For non-primitive transforms,
  prefer a `computed()` signal or a memoised function.

## Control flow & defer

- **Use `@if`, `@for`, `@switch`** — not `*ngIf` / `*ngFor`.
- **`@for` requires a `track` expression.** Track by a stable id. Do not
  track by reference or `$index` except for primitive lists.
- **`@switch` uses `===` and has no fallthrough.**
- **`@defer` for below-the-fold content only.** Deferring above-the-fold
  hurts LCP. Wrap deferred regions in `aria-live="polite"`. Avoid nested
  `@defer` blocks with the same trigger.

## Performance

- **`OnPush` + signals + zoneless** is the target. v21+ is zoneless by
  default.
- **`NgOptimizedImage`** — use `ngSrc` with `width`/`height` (or `fill` on a
  positioned parent). Add `priority` to the LCP image.
- **Hydration** —
  `provideClientHydration(withEventReplay(), withIncrementalHydration())`.
  Server and client DOM must match exactly; do not mutate the native DOM.
  `ngSkipHydration` is a last resort.

## Style — quick reference

Full rules live in the separate `css` skill. Quick reference here:

- **Find the preprocessor first** (Sass / Less / Tailwind / plain CSS) and
  follow the project's choice.
- **Avoid inline styles in templates.** Put rules in the component stylesheet.
- **Custom CSS uses BEM naming.**
- **Tailwind v4 has no `tailwind.config.js`** — configuration lives in the
  root SCSS / CSS file. Always prefer token-based utilities.

## File structure

One building block per file. Organise by **feature**, not by type — no
`components/` / `services/` buckets at the root.

```text
feature-name/
├── feature-name.component.ts
├── feature-name.component.html         (when the template is not inline)
├── feature-name.component.scss
├── feature-name.directive.ts
├── feature-name.pipe.ts
├── feature-name.model.ts
├── feature-name.service.ts
├── feature-name.store.ts               (signal store / component store)
├── feature-name.guard.ts
├── feature-name.resolver.ts
├── feature-name.form.ts                (large reactive forms only)
└── feature-name.endpoints.ts           (HTTP endpoint constants)
```

## Gotchas

- **`providedIn: 'root'` is not blanket-bad.** Scope when stateful or
  feature-bound; root is fine for stateless app-wide utilities.
- **Signal reads after `await` inside `effect()` are untracked.** Read
  dependencies before any async wait.
- **`asReadonly()` does not deep-freeze object values** — exposure ≠
  immutability.
- **`inject()` inside an instance method throws NG0203.** Wrap with
  `runInInjectionContext(injector, fn)` if unavoidable.
- **`@for` without `track`** is a performance bug, not a style nit.
- **Signal Forms, `resource()`, and `httpResource()`** are experimental in
  v21 — do not adopt for production-critical code yet.
- **Vitest is the default test runner from v21**; Karma is on a migration
  path. (Testing rules live in the `angular-testing` skill.)

## Reference

- Angular 20 index — <https://v20.angular.dev/llms.txt>
- Angular 21 index — <https://v21.angular.dev/llms.txt>
- Angular 22 (next) index — <https://next.angular.dev/llms.txt>
- Style guide — <https://next.angular.dev/style-guide>
- Roadmap — <https://angular.dev/roadmap>
- DI context — <https://angular.dev/guide/di/dependency-injection-context>
- Signals — <https://angular.dev/guide/signals>
- Linked signal — <https://angular.dev/guide/signals/linked-signal>
- Routing inputs — <https://angular.dev/guide/routing/read-route-state>
- Typed forms — <https://angular.dev/guide/forms/typed-forms>
- HTTP setup — <https://angular.dev/guide/http/setup>
- HTTP interceptors — <https://angular.dev/guide/http/interceptors>
- Control flow — <https://angular.dev/guide/templates/control-flow>
- Defer — <https://angular.dev/guide/templates/defer>
- Hydration — <https://angular.dev/guide/hydration>
- Image directive — <https://angular.dev/guide/image-optimization>
- Zoneless — <https://angular.dev/guide/zoneless>
