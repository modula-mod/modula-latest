# Shell / Product Boundary

This boundary is normative for MPS 1.0 products.

> The Shell owns platform UI. The Product owns product UI. The Host bridges
> them.

## Shell-owned

- global tabs and navigation
- Home/social shell, global Search, Activity and Notifications
- global Settings and account management
- authentication and onboarding
- global profile shell
- Product Hub and marketplace Product Detail shell
- install, permission review, enable, update, disable and uninstall UI
- Module Host chrome, failure boundary and platform diagnostics
- semantic typography, colours, surfaces, motion and accessibility adaptation
- generic web/iOS/Android rendering and native capability adapters

Product Hub cards and Product Detail install controls remain Shell UI. Their
product names, icons, covers and screenshots come from release metadata/assets.

## Product-owned

- Vault Notes root, collection, detail, editor, search/filter, empty states and
  product settings
- Vault Formatting commands, toolbar/menu presentation and product settings
- Vault AI actions, panels/settings and provider-unavailable states
- Vault Voice dictation/record/transcribe presentation, permission explanation
  and provider-unavailable states
- future Tasks, CRM, Calendar, Gubic, creator, game and third-party product
  experiences

Settings → Modules → Product is a Shell management surface containing a
product-declared settings view. Product Hub → Open resolves an enabled release
through the generic product route.

## Location rule

If a feature belongs to one installable product, its default source location is
that product repository. A normal new product must not require a Greenfield
product-name branch. A normal new module must not require product-specific
source in `modula-latest`.

Products may request a new generic primitive only when existing MPS semantics
cannot express the behavior. Admission requires contract, validator, testkit,
renderer and neutral-fixture coverage before product use.

## Prohibited shortcuts

- `/vault-notes/*`, `/tasks/*` or `/crm/*` global application routes
- `if (productId === ...)` in the Module Host or generic renderer
- raw JSX/React Native/Node bundles activated from a product release
- arbitrary HTML, JavaScript, CSS, native code or generic WebView product UI
- product-to-product UI imports
- direct record access outside Greenfield product/account scope
- product settings branches in global Settings

Historical shortcuts are compatibility debt, not the path for new MPS
releases. They must be version-bounded or removed and cannot intercept the
generic MPS frontend route.
