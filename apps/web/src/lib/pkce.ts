export async function generatePkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  // Generate a random code_verifier (43-128 chars)
  // We use 64 bytes, which yields 86 characters when base64url encoded
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);

  // Convert to base64url string
  const verifier = btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Generate code_challenge as SHA-256 hash of the verifier
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);

  // Convert hash to base64url string
  const hashArray = new Uint8Array(hashBuffer);
  const challenge = btoa(String.fromCharCode.apply(null, Array.from(hashArray)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { verifier, challenge };
}
