export function ensure0x(value: string): string {
  return value.startsWith("0x") ? value : "0x" + value
}
export function strip0x(value: string): string {
  return value.startsWith("0x") ? value.substr(2) : value
}
