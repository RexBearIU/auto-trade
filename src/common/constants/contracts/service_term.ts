import { DOMAIN, SERVICE_TERM_TITLE } from '../config';

const ServiceTerm = {
  domain: {
    // Defining the chain aka Rinkeby testnet or Ethereum Main Net
    chainId: '0x1',
    // Give a user friendly name to the specific contract you are signing for.
    name: 'TideBit-DeFi',
    // If name isn't enough add verifying contract to make sure you are establishing contracts with the proper entity
    verifyingContract: '0xCAFECA5CCD019431B17B132e45e6638Ee2397be8',
    // Just let's you know the latest version. Definitely make sure the field name is correct.
    version: 'v1.0.0',
  },
  // Defining the message signing data content.
  message: {
    /*
  - Anything you want. Just a JSON Blob that encodes the data you want to send
  - No required fields
  - This is DApp Specific
  - Be as explicit as possible when building out the message schema.
  */
    title: SERVICE_TERM_TITLE,
    /* Deprecate: replace with following content (20230407 - tzuhan)
    content: 'You are going to use TideBit-DeFi and agree every rules in TideBit',
    from: '0xCAFECAAd15f96E1EfcD846e1ae27115645C6D606',
    to: 'TideBit-DeFi',
    */
    domain: DOMAIN,
    agree: [
      `${DOMAIN}/term_of_service/{hash}`,
      `${DOMAIN}/private_policy/{hash}`,
    ],
    // signer: '0xfc657dAf7D901982a75ee4eCD4bDCF93bd767CA4',
    // expired: getTimestamp() + 3600,
    // iat: getTimestamp(),
  },
  // Refers to the keys of the *types* object below.
  primaryType: 'ServiceTerm',
  types: {
    // TODO: Clarify if EIP712Domain refers to the domain the contract is hosted on
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'string' },
      { name: 'verifyingContract', type: 'address' },
    ],
    // Refer to PrimaryType
    /* Deprecate: replace with following content (20230407 - tzuhan)
    ServiceTerm: [
      {name: 'title', type: 'string'},
      {name: 'content', type: 'string'},
      {name: 'from', type: 'string'},
      {name: 'to', type: 'string'},
    ],
    */
    ServiceTerm: [
      { name: 'domain', type: 'string' },
      { name: 'agree', type: 'string[2]' },
      { name: 'signer', type: 'string' },
      { name: 'expired', type: 'uint256' },
      { name: 'iat', type: 'uint256' },
    ],
  },
};

export default ServiceTerm;
