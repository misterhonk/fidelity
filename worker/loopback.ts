/**
 * Whether the app itself runs on this machine (#204).
 *
 * Only then is a hub or catalogue on localhost worth asking for. From a public
 * deployment the probe is a loopback request nobody asked for, and Chromium's
 * Local Network Access answers it with a permission prompt.
 */
export function onThisMachine(hostname = globalThis.location?.hostname): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}
