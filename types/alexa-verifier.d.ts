declare module "alexa-verifier" {
  type VerifierCallback = (err?: string) => void;

  function alexaVerifier(
    certUrl: string | null | undefined,
    signature: string | null | undefined,
    requestBody: string,
    cb?: VerifierCallback,
  ): Promise<void>;

  export default alexaVerifier;
}
