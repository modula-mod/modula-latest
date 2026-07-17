import {createSafeFetch} from '../bridges/atproto/ssrf-guard.js'
export async function runRemoteFunction(url: string, input: unknown) {
  const response = await createSafeFetch({timeoutMs: 10_000, maxBytes: 1_048_576})(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(input)})
  return response.text()
}
