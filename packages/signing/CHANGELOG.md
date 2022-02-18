# @vocdoni/signing - Changelog

## 1.16.2

- `JsonSignature.sort` changed for accepting `undefined` values

## 1.16.1

- `JsonSignature.sort` now returns the same type as the input parameter, not `JsonLike`

## 1.16.0

- `sortJson` is now exported as `JsonSignature.sort`
- `JsonSignature` and `BytesSignature` now have `signMessage`, `signTransaction`, `isValidMessage`, `isValidTransaction`, `recoverMessagePublicKey` and `recoverTransactionPublicKey`
- Breaking:
  - `sign`, `isValid` and `recoverPublicKey` no longer exist on `JsonSignature` or `BytesSignature`
  - The signature of `isValidMessage`/`isValidTransaction` is now consistent with `recoverMessagePublicKey`/`recoverTransactionPublicKey`

## 1.15.1

- Exposing `sortJson`, `digestVocdoniSignedPayload` and `normalizeJsonToString`

## 1.15.0

- Adding support for Vocdoni salted signatures

## 1.14.0

- First version of the package, starting from dvote-js version 1.13.2
