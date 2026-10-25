# Branch cleanup candidates — future controlled phase

Mission: `VPS-CONSOLIDATION-01`  
Snapshot: 2026-10-25  
Execution in this phase: **NONE**

No GitHub branch or tag was deleted. This file is a proposal for after the Mac reconnects, local-only refs and dirty files are preserved, branch tips are fetched again, and each candidate is re-proven against then-current `main`.

## Conclusively merged remote candidates

“Safe to delete” means safe only after a fresh ancestry/open-PR/dependency check and explicit Mac confirmation. The commits remain reachable from `main`; no claim is made about unpushed Mac work under a similarly named local branch.

| Repository | Branch | Tip SHA | Merged into main? | Equivalent commits present? | Open PR? | Required by another branch? | Tag/recovery protection? | Mac confirmation required? | Safe to delete? |
|---|---|---|---|---|---|---|---|---|---|
| `modula-native` | `fix/composer-moliboo-picker-compact` | `f1e08135282ccfc52311b909d57f9dc52b6ac1d0` | Yes, PR #207 | Yes | No; merged | No known | Main merge `98d6b106…` | Yes | Later, after recheck |
| `modula-native` | `fix/feed-sheets-modula-glass` | `00e5ae5d11800cc31b3b54cc5ba6116009479032` | Yes, PR #208 | Yes | No; merged | No known | Main merge `3e48cc4b…` | Yes | Later, after recheck |
| `modula-native` | `fix/profile-message-opens-chat` | `26a14a1ce4b14fc0f04701bfcae88aafd8d20d39` | Yes, PR #209 | Yes | No; merged | No known | Main merge `be679c86…` | Yes | Later, after recheck |
| `modula-native` | `nodus-release` | `8f5ab068cac0eb7520c95dea785963872dc9644c` | Yes | Yes | No open PR found | No known | Main ancestry | Yes | Later, after R7/R8 recovery |
| `modula-native` | `mol03/acceptance` | `55fc1cbdfbb318ad9235f468439993768d578d15` | Yes | Yes | No open PR found | No known | Main ancestry | Yes | Later, after Moliboo recovery |
| `modula-native` | `mol03/finish` | `915f837af53ab0d5b80350f575f5a65cb4b880d6` | Yes | Yes | No open PR found | No known | Main ancestry | Yes | Later |
| `modula-native` | `mol03/package-hooks` | `1522cc454634dc73f1ed2d08738a6f286ac75c51` | Yes | Yes | No open PR found | Referenced historically by asset packs | Main ancestry | Yes | Later, only after package review |
| `modula-native` | `mol03/registry` | `745afd3fcd17ae0a4ea5f3924ce60c1234b4a3b1` | Yes | Yes | No open PR found | Referenced historically by asset packs | Main ancestry | Yes | Later, only after package review |
| `modula-native` | `mol03/report` | `032844ef07f63ffef6a8c9af02ab8e8e9bf63cd3` | Yes | Yes | No open PR found | No known | Main ancestry | Yes | Later |
| `modula-native` | `feat/moliboo-care-activities` | `a56a6faf546a85240cac84c368c60aee1b94bc37` | Yes | Yes | No open PR found | No known | Main ancestry | Yes | Later |
| `modula-native` | `feat/moliboo-legends` | `3da420dd4fa215fe456dcc620e8e545777e7673d` | Yes | Yes | No open PR found | No known | Main ancestry | Yes | Later |
| `modula-native` | `feat/moliboo-wardrobe-scenes` | `8eeb720ee68dfe97f4705441e0e0a650143f76a9` | Yes | Yes | No open PR found | #211 may depend on behavior, not ref | Main ancestry | Yes | Later, after #211 |
| `modula-native` | `fix/moliboo-home-clipping` | `36fb90ce65a7a2d2c481bf2efaeb79bd5acfa7a8` | Yes | Yes | No open PR found | No known | Main ancestry | Yes | Later |
| `modula-native` | `fix/moliboo-outfit-sync` | `d4835012112b391e89cf02c27eb07cd286150e07` | Yes | Yes | No open PR found | #211 test baseline | Main ancestry | Yes | Later, after #211 |
| `modula-native` | `moliboos/angels-2d` | `d4150fa7daf762fc131011761762d9aadcc43f31` | Yes | Yes | No open PR found | Asset lineage | Main ancestry | Yes | Later, after asset audit |
| `modula-native` | `moliboos/dreamers-2d` | `75813069b234ba9286ea1add15bd0efaf084d691` | Yes | Yes | No open PR found | Asset lineage | Main ancestry | Yes | Later, after asset audit |
| `modula-native` | `moliboos/enchanted-2d` | `0b131dcda9b2f3cafc5ad5ed4982f4c0e36881de` | Yes | Yes | No open PR found | Asset lineage | Main ancestry | Yes | Later, after asset audit |
| `modula-native` | `moliboos/originals-2d` | `ad13e704fccfa3f5b0811d436baaa7d1d1a8e812` | Yes | Yes | No open PR found | Asset lineage | Main ancestry | Yes | Later, after asset audit |
| `modula-native` | `moliboos/originals-redraw` | `176c0e2274dc5851c529ccf53746f3ad827f8f21` | Yes | Yes | No open PR found | Asset lineage | Main ancestry | Yes | Later, after asset audit |
| `modula-native` | `moliboos/stardust-2d` | `89f1af7001aab8f3d7f9d50709c08d427a4da17d` | Yes | Yes | No open PR found | Asset lineage | Main ancestry | Yes | Later, after asset audit |
| `modula-native` | `moliboos/underground-2d` | `568a4cb0d8e71936f4e09eae00e7794ced78ad6e` | Yes | Yes | No open PR found | Asset lineage | Main ancestry | Yes | Later, after asset audit |

The following additional UI refs were also proven ancestors of `origin/main`, but should be expanded into individual rows with fresh tips before cleanup because they are numerous and may have Mac-local namesakes: `ui/messages-inbox`, `ui/messages-thread-polish`, `ui/moliboo-family-picker`, `ui/moliboo-fit-number-wave`, `ui/moliboo-section-switcher`, `ui/moliboo-studio-fullbleed`, `ui/moliboos-2d-only`, all seven `ui/moliboos-art-*` branches, and the `ui/moliboos-*` card/studio/polish/performance/settings branches.

## Preserve — active, stacked, unknown, or Mac-only

| Repository | Branch | Tip SHA | Merged into main? | Equivalent commits present? | Open PR? | Required by another branch? | Tag/recovery protection? | Mac confirmation required? | Safe to delete? |
|---|---|---|---|---|---|---|---|---|---|
| `modula-native` | `fix/new-message-picker` | `41fb92843b543ef6111a0782cc8f69dda202417a` | No | No | #210 | Possibly #213 | Remote branch | Yes | **No — active** |
| `modula-native` | `fix/moliboo-home-tabs-tiles` | `0f75692f2f63f257c7b668873d07bbda9c462ba6` | No | No | #211 | Moliboo current work | Remote branch | Yes | **No — active** |
| `modula-native` | `feat/comments-quick-emoji` | `5cd3e74db157f0c5300130ce42d1e8442fdd3766` | No | No | #212 | No known | Remote branch | Yes | **No — active** |
| `modula-native` | `feat/share-message-direct` | `c4cc7f3f5b9c94c0772e6a178a7ec6a3a9ae982f` | No | No | #213 | May consume #210 | Remote branch | Yes | **No — active** |
| `modula-native` | `ui/messages-new-chat-v2` | `691deb9d769562ee5bc0770b4a800e24a62f5230` | No | Unknown overlap | #206 | Reported stack/overlap with #210 | Remote branch | Yes | **No — reconcile** |
| `modula-native` | `premium/hub-and-tiers` | `5c020488e9a04eb25b08ae4378a3f87e969c674a` | No | No | No | Premium/Verification Mac work | Remote branch | Yes | **No — active** |
| `modula-native` | `phase/product-ui-polish-01` | `95bfc6b75ff0b6588dd05365f96bd6d06f9fa235` | No | No | #77 draft/DIRTY | Product UI work | Remote branch | Yes | **No — conflict** |
| `modula-native` | `feature/game-platform-02` | `163fd7b6012423fc9c51514d19293baeb9d3fd9b` | No | No | #99 draft | Base of #168 | Remote branch | Yes | **No — stacked** |
| `modula-native` | `codex/on-demand-packages-02` | `9cbfa13440922bad14411de43ccfb982971650a9` | No | No | #168 draft | Depends on #99 and upstream repos | Remote branch | Yes | **No — stacked** |
| `modula-native` | `fix/shell-chrome-tests` | `cae757832285afd782393a661daf7b6f1c6f6257` | No | Unknown | No PR found | AppLock/test recovery | Remote branch | Yes | **No — active/unknown** |
| `modula-native` | `cursor/notes-account-records-ac33` | `4f20d36031a26324e9bc5e3ff53dc14e4f10f70d` | Unknown | Unknown | No PR found | Vault compatibility unknown | Remote branch | Yes | **No — unknown** |
| `modula-latest` | `codex/on-demand-packages-02` | `ca43b2f311151d60c267521e54011dd10b12eb04` | No | No | #137 draft | Package stack; migration renumber required | Remote branch | Mac confirmation prudent | **No — stacked** |
| `modula-product-standard` | `codex/on-demand-packages-02` | `b137df2a4e2eaf8549db8dc06745a93b6c23b00a` | No | No | #9 draft | Package contract root | Remote branch | Yes | **No — stacked** |
| `modula-module-generator` | `codex/on-demand-packages-02` | `858a8d104c8b0a294e37f4451b141e8983251a79` | No | No | #5 draft | Depends on Product Standard | Remote branch | Yes | **No — stacked** |
| `modula-game-lab` | `codex/on-demand-packages-02` | `a94b1415d9e7df1f4ffd2d24d29ddb88f10525d7` | No | No | #2 draft | Depends on Product Standard/Generator | Remote branch | Yes | **No — stacked** |

Mac-only Verification, Modula Unit, Premium follow-up, Nodus R8, and any other unpushed branches cannot be named or protected from the VPS. Therefore **all cleanup is blocked until the Mac returns and creates recovery refs for local-only work**.

## Future cleanup procedure

For each candidate, fetch with pruning disabled, record the remote tip, prove it is an ancestor of then-current main, confirm no open PR or downstream base refers to it, create a recovery tag/ref when policy requires one, obtain Mac confirmation, and only then request explicit deletion authorization. Never batch-delete unknown names, tags, or branches merely to reduce branch count.
