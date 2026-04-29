import { generateAuthenticationOptions, generateRegistrationOptions, AuthenticatorTransportFuture, Base64URLString } from '@simplewebauthn/server';
import { Db } from 'mongodb';

let rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
let rpName = process.env.WEBAUTHN_RP_NAME || 'ShuttleBus';
let rpOrigin = process.env.WEBAUTHN_RP_ORIGIN || 'http://localhost:4200';

export function setWebAuthnConfig(config: { rpID?: string; rpName?: string; rpOrigin?: string }) {
  if (config.rpID) rpID = config.rpID;
  if (config.rpName) rpName = config.rpName;
  if (config.rpOrigin) rpOrigin = config.rpOrigin;
}

export function getWebAuthnConfig() {
  return { rpID, rpName, rpOrigin };
}

export async function generateRegOptions(
  db: Db,
  email: string,
  existingPasskeys: Array<{ credentialID: Base64URLString }>,
) {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(email),
    userName: email,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'cross-platform',
    },
    excludeCredentials: existingPasskeys.map((pk) => ({
      id: pk.credentialID,
      type: 'public-key',
    })),
  });

  await db.collection('webauthn_challenges').insertOne({
    type: 'registration',
    challenge: options.challenge,
    email,
    createdAt: Date.now(),
  });

  return options;
}

export async function generateAuthOptions(db: Db, email?: string, userPasskeys?: Array<{ credentialID: Base64URLString }>) {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: userPasskeys?.map((pk) => ({
      id: pk.credentialID,
      type: 'public-key' as const,
      transports: ['usb', 'ble', 'nfc', 'internal'] as AuthenticatorTransportFuture[],
    })),
  });

  await db.collection('webauthn_challenges').insertOne({
    type: 'authentication',
    challenge: options.challenge,
    email: email || null,
    createdAt: Date.now(),
  });

  return options;
}

export async function consumeChallenge(db: Db, type: 'registration' | 'authentication', email?: string) {
  const filter: any = { type };
  if (email) {
    filter.email = email;
  }
  const challenge = await db.collection('webauthn_challenges').findOneAndDelete(filter);
  return challenge?.challenge || null;
}

export async function cleanOldChallenges(db: Db) {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  await db.collection('webauthn_challenges').deleteMany({ createdAt: { $lt: fiveMinutesAgo } });
}
