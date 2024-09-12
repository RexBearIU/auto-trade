import ServiceTerm from './constants/contracts/service_term';
import {
  DeWT_VALIDITY_PERIOD,
  DOMAIN,
  PRIVATE_POLICY,
  SERVICE_TERM_TITLE,
  TERM_OF_SERVICE,
} from './constants/config';
import RLP from 'rlp';

export const getTimestamp = () => Math.ceil(Date.now() / 1000);

export const getServiceTermContract = (address: string) => {
  const serviceTermsContract = ServiceTerm;
  const message = {
    title: SERVICE_TERM_TITLE,
    domain: DOMAIN,
    agree: [TERM_OF_SERVICE, PRIVATE_POLICY],
    signer: address,
    expired: getTimestamp() + DeWT_VALIDITY_PERIOD,
    iat: getTimestamp() - 2, // Info: (20240911 - Jacky) Set iat to 2 seconds ago
  };
  serviceTermsContract.message = message;
  return serviceTermsContract;
};
const convertServiceTermToObject = (serviceTerm) => {
  const message = serviceTerm.message;
  const data = {
    primaryType: serviceTerm.primaryType as string,
    domain: { ...serviceTerm.domain },
    message: {
      title: message.title as string,
      domain: message.domain as string,
      agree: message.agree as string[],
      signer: message.signer as string,
      expired: message.expired as number,
      iat: message.iat as number,
    },
  };
  return data;
};

export const rlpEncodeServiceTerm = (serviceTerm) => {
  const data = convertServiceTermToObject(serviceTerm);
  const encodedData = RLP.encode([
    data.message.title,
    data.message.domain,
    data.message.agree,
    data.message.signer,
    data.message.expired,
    data.message.iat,
  ]);
  const dataToHex = Buffer.from(encodedData).toString('hex');
  return dataToHex;
};

export const randomHex = (length: number) =>
  `0x${[...Array(length)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('')}`;
