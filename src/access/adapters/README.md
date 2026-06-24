# Provider Adapters

This is the **only** place vendor-specific door/lock code may live. Everything here
implements the brand-neutral [`DoorProvider`](../DoorProvider.ts) interface.

## Today

- `NoopDoorProvider.ts` — safe in-memory stub. No hardware, no network, no vendor.

## Adding a real vendor later (do NOT do this yet)

1. Create a subfolder, e.g. `ttlock/`.
2. Drop the vendor SDK/DLL/API client inside that subfolder — it must not leak outward.
3. Implement `DoorProvider` in e.g. `ttlock/TtlockDoorProvider.ts`, translating between
   the vendor's model and our neutral `DoorKey` / `DoorRef` / `DoorStatus` types.
4. Register the adapter at the composition root (`src/main/`) and select it via config.

The PMS core and `AccessEngine` never change when a vendor is added or swapped.

> **Rules:** no real lock brand is implemented yet; no supplier logic is hard-coded into
> the core; vendor SDKs are integrated only through adapters in this folder.
