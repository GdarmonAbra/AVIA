# Packer — AX 2012 → D365 F&O code upgrade

Upgrade of the Packer AX 2012 VAR-layer customization to Dynamics 365 Finance &
Operations (target: 10.0.x, verified against extension APIs available since
Platform update 9). Overlayering is not supported in D365FO, so every VAR-layer
change is re-implemented as an **extension** (Chain of Command + class
augmentation) in the `PSSExtensions` model.

## Source material

`ax2012-source/` contains the XPOs as supplied:

| File | Layer | Content |
|---|---|---|
| `Class_FormletterJournalCreate_SYS.xpo` | SYS | Full `FormletterJournalCreate` class (baseline) |
| `Class_FormletterJournalCreate_VAR.xpo` | VAR | Overlayered `newPurchJournalCreate` method only |

## Delta analysis (VAR vs SYS)

Diffing the VAR `newPurchJournalCreate` against the SYS baseline shows two
kinds of differences:

1. **The actual Packer customization** (marker
   `08/04/2013-SSARAGOS-PSS-001-IMPORTFOLDER`), inside the
   `DocumentStatus::PackingSlip` case:

   ```xpp
   if (isConfigurationkeyEnabled(configurationKeyNum(PSSImpFolder)))
       purchPackingSlipJournalCreate.pssParmImpFolderTableRecId(_formletterContract.pssParmImpFolderTableRecId());
   ```

   This hands a "import folder" record reference from the purchase posting
   contract to the packing slip journal creation class. **This is the code
   that was carried forward.**

2. **Baseline drift, not customization**: the VAR method contains
   `case DocumentStatus::ConfirmationRequest → PurchConfirmationRequestJournalCreate`
   and constructs `PurchConfirmationJournalCreate` (instead of
   `PurchPurchOrderJournalCreate`) for `DocumentStatus::PurchaseOrder`. This
   matches the **standard** D365FO implementation of
   `FormletterJournalCreate::newPurchJournalCreate`, so nothing needs to be
   ported for it. (Verify against your local
   `PackagesLocalDirectory\ApplicationSuite\...\AxClass\FormletterJournalCreate.xml`.)

## What was produced

`PackagesLocalDirectory/PSSExtensions/` — a D365FO model in standard metadata
layout, ready to copy into
`C:\Users\gdarmon\AppData\Local\Microsoft\Dynamics365\10.0.2263.74\PackagesLocalDirectory`.

| Artifact | Type | Purpose |
|---|---|---|
| `PSSFormletterJournalCreate_Extension` | Class (CoC, static wrap) | Wraps `newPurchJournalCreate`; after the standard chain builds the journal-create instance, copies `pssParmImpFolderTableRecId` from the contract to `PurchPackingSlipJournalCreate` when the `PSSImpFolder` configuration key is enabled. Replaces the VAR overlayering 1:1. |
| `PSSPurchFormLetterContract_Extension` | Class (augmentation with state) | Adds the `pssImpFolderTableRecId` member and `pssParmImpFolderTableRecId()` accessor to `PurchFormLetterContract`. Decorated `[DataMemberAttribute]` so the value survives SysOperation/batch serialization of the posting contract. In AX 2012 this member was added by overlayering the contract class (XPO not supplied — inferred from the call sites). |
| `PSSPurchPackingSlipJournalCreate_Extension` | Class (augmentation with state) | Adds the matching `pssParmImpFolderTableRecId()` accessor to `PurchPackingSlipJournalCreate` (same inference). |
| `PSSImpFolder` | Configuration key | Recreated in this model because the original PSS configuration key lives in AX 2012 VAR-layer metadata that was not supplied. If the key is delivered in another migrated PSS model, delete this copy and reference that model instead. |

Upgrade pattern notes:

- The VAR code ran inside the `PackingSlip` case of a `switch`; the CoC wrapper
  instead runs **after** `next` and detects the packing slip scenario with
  `as PurchPackingSlipJournalCreate`, which is equivalent and robust against
  future changes to the standard switch.
- Static CoC wrapping and instance state on extension classes are both
  supported platform features (Platform update 9+); no event-handler fallback
  was needed.

## Build / deploy

1. Copy `PackagesLocalDirectory/PSSExtensions` into your
   `PackagesLocalDirectory`.
2. In Visual Studio: **Dynamics 365 → Model Management → Refresh Models**, then
   build the `PSSExtensions` model (full build; sync not required — no tables
   yet).
3. Add the model to your build pipeline / deployable package definition.

## Open items — remaining XPOs needed

Only one class pair was supplied. The customization references PSS objects
whose definitions were **not** in the zip; to finish the upgrade, export and
supply these from the AX 2012 VAR layer:

1. **`PSSImpFolderTable`** (and its EDT/relations) — the table the RecId points
   at.
2. **The producer** — whatever overlayered code populates
   `pssParmImpFolderTableRecId` on `PurchFormLetterContract` before posting
   (likely `PurchFormLetter`/`PurchEditLines` form or class changes).
3. **The consumer** — the VAR changes inside `PurchPackingSlipJournalCreate`
   (e.g., `createJournalHeader`) that read the RecId and stamp it on
   `VendPackingSlipJour`, plus the corresponding table field.
4. Any other `PSS`-prefixed objects under the `PSSImpFolder` configuration key.

Each will be converted the same way: table fields → table extensions,
overlayered methods → CoC, form changes → form extensions.
